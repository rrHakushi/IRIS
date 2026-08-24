using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.Aquila.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Aquila.Services;

/// <summary>
/// SessionManager event listener for tracking playback progress and triggering completion scrobbles at 90%.
/// </summary>
public class PlaybackTracker : IHostedService, IDisposable
{
    private readonly ISessionManager _sessionManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly IUserManager _userManager;
    private readonly AquilaSyncManager _syncManager;
    private readonly ILogger<PlaybackTracker> _logger;

    private readonly ConcurrentDictionary<string, DateTime> _scrobbledSessions = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="PlaybackTracker"/> class.
    /// </summary>
    public PlaybackTracker(
        ISessionManager sessionManager,
        ILibraryManager libraryManager,
        IUserDataManager userDataManager,
        IUserManager userManager,
        AquilaSyncManager syncManager,
        ILogger<PlaybackTracker> logger)
    {
        _sessionManager = sessionManager;
        _libraryManager = libraryManager;
        _userDataManager = userDataManager;
        _userManager = userManager;
        _syncManager = syncManager;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[Aquila PlaybackTracker] Service starting... Registering PlaybackProgress, PlaybackStopped, and UserDataSaved listeners.");
        _sessionManager.PlaybackProgress += OnPlaybackProgress;
        _sessionManager.PlaybackStopped += OnPlaybackStopped;
        _userDataManager.UserDataSaved += OnUserDataSaved;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[Aquila PlaybackTracker] Service stopping... Unregistering listeners.");
        _sessionManager.PlaybackProgress -= OnPlaybackProgress;
        _sessionManager.PlaybackStopped -= OnPlaybackStopped;
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        return Task.CompletedTask;
    }

    /// <summary>
    /// Attempts to mark an item as scrobbled for the active user session.
    /// Returns true if this is the first scrobble trigger for this item playback session; false if already scrobbled.
    /// </summary>
    private bool TryMarkItemScrobbled(string userId, string itemId)
    {
        string normUser = userId.Replace("-", "").ToLowerInvariant();
        string normItem = itemId.Replace("-", "").ToLowerInvariant();
        string key = $"{normUser}_{normItem}";

        if (_scrobbledSessions.TryGetValue(key, out var lastScrobbledTime))
        {
            if (DateTime.UtcNow - lastScrobbledTime < TimeSpan.FromHours(12))
            {
                _logger.LogDebug("[Aquila PlaybackTracker] Scrobble skipped (already scrobbled in active session) for key {Key}", key);
                return false;
            }
        }

        _scrobbledSessions[key] = DateTime.UtcNow;
        return true;
    }



    private async void OnPlaybackProgress(object? sender, PlaybackProgressEventArgs e)
    {
        await ProcessPlaybackProgressAsync(e).ConfigureAwait(false);
    }

    private async void OnPlaybackStopped(object? sender, PlaybackStopEventArgs e)
    {
        await ProcessPlaybackStopAsync(e).ConfigureAwait(false);
    }

    private async Task ProcessPlaybackProgressAsync(PlaybackProgressEventArgs e)
    {
        if (e.Item == null || e.Users == null || !e.Users.Any())
        {
            return;
        }

        if (!e.PlaybackPositionTicks.HasValue || !e.Item.RunTimeTicks.HasValue || e.Item.RunTimeTicks.Value <= 0)
        {
            return;
        }

        double percentWatched = ((double)e.PlaybackPositionTicks.Value / e.Item.RunTimeTicks.Value) * 100.0;
        var config = Plugin.Instance?.Configuration;
        if (config == null || config.UserConfigs == null || !config.UserConfigs.Any())
        {
            return;
        }

        var user = e.Users.First();
        var userId = user.Id.ToString();
        var userConfig = config.UserConfigs.FirstOrDefault(u => MatchUserId(u.JellyfinUserId, userId))
                      ?? config.UserConfigs.FirstOrDefault();

        if (userConfig == null)
        {
            return;
        }

        double threshold = userConfig.CompletionThreshold > 0 ? userConfig.CompletionThreshold : 90.0;
        if (percentWatched >= threshold)
        {
            if (!TryMarkItemScrobbled(userId, e.Item.Id.ToString()))
            {
                return;
            }

            _logger.LogInformation("[Aquila PlaybackTracker] Completion threshold {Threshold}% met for item '{ItemName}' (ID: {ItemId}, Watched: {Percent:F1}%). Triggering scrobble...",
                threshold, e.Item.Name, e.Item.Id, percentWatched);
            await TriggerScrobbleAsync(e.Item, user, userConfig, config).ConfigureAwait(false);
        }
    }

    private async Task ProcessPlaybackStopAsync(PlaybackStopEventArgs e)
    {
        if (e.Item == null || e.Users == null || !e.Users.Any())
        {
            return;
        }

        var user = e.Users.First();
        var userId = user.Id.ToString();
        var itemId = e.Item.Id.ToString();

        var config = Plugin.Instance?.Configuration;
        if (config == null || config.UserConfigs == null || !config.UserConfigs.Any())
        {
            return;
        }

        var userConfig = config.UserConfigs.FirstOrDefault(u => MatchUserId(u.JellyfinUserId, userId))
                      ?? config.UserConfigs.FirstOrDefault();

        if (userConfig == null)
        {
            return;
        }

        bool shouldScrobble = e.PlayedToCompletion;
        if (!shouldScrobble && e.PlaybackPositionTicks.HasValue && e.Item.RunTimeTicks.HasValue && e.Item.RunTimeTicks.Value > 0)
        {
            double percentWatched = ((double)e.PlaybackPositionTicks.Value / e.Item.RunTimeTicks.Value) * 100.0;
            double threshold = userConfig.CompletionThreshold > 0 ? userConfig.CompletionThreshold : 90.0;
            if (percentWatched >= threshold)
            {
                shouldScrobble = true;
            }
        }

        if (shouldScrobble)
        {
            if (TryMarkItemScrobbled(userId, itemId))
            {
                _logger.LogInformation("[Aquila PlaybackTracker] Playback stopped/completed for item '{ItemName}' (ID: {ItemId}, PlayedToCompletion: {Completed}). Triggering scrobble...",
                    e.Item.Name, e.Item.Id, e.PlayedToCompletion);
                await TriggerScrobbleAsync(e.Item, user, userConfig, config).ConfigureAwait(false);
            }
        }
    }

    private async Task TriggerScrobbleAsync(BaseItem item, object user, UserAquilaConfig userConfig, PluginConfiguration config)
    {
        try
        {
            string userId = ((dynamic)user).Id.ToString();
            var fullItem = _libraryManager.GetItemById(item.Id) ?? item;

            string mediaType = "tv";
            if (config.LibraryMappings != null && config.LibraryMappings.Any())
            {
                List<string> ancestorIds = new List<string>();
                var parent = fullItem.GetParent();
                while (parent != null)
                {
                    ancestorIds.Add(parent.Id.ToString());
                    parent = parent.GetParent();
                }
                var topParentId = fullItem.GetTopParent()?.Id.ToString();
                if (!string.IsNullOrEmpty(topParentId) && !ancestorIds.Contains(topParentId)) ancestorIds.Add(topParentId);

                var matchedMapping = config.LibraryMappings.FirstOrDefault(m => ancestorIds.Contains(m.LibraryId, StringComparer.OrdinalIgnoreCase));
                if (matchedMapping != null)
                {
                    mediaType = matchedMapping.MediaType;
                }
            }

            List<string> candidateIds = new List<string>();
            int episodeNumber = 1;
            int? totalEpisodes = null;

            if (fullItem is Episode episode)
            {
                episodeNumber = episode.IndexNumber ?? 1;

                // Priority: Episode -> Season -> Series
                candidateIds.Add(episode.Id.ToString());

                if (episode.SeasonId != Guid.Empty && !candidateIds.Contains(episode.SeasonId.ToString(), StringComparer.OrdinalIgnoreCase))
                    candidateIds.Add(episode.SeasonId.ToString());
                if (episode.Season != null && episode.Season.Id != Guid.Empty && !candidateIds.Contains(episode.Season.Id.ToString(), StringComparer.OrdinalIgnoreCase))
                    candidateIds.Add(episode.Season.Id.ToString());

                if (episode.SeriesId != Guid.Empty && !candidateIds.Contains(episode.SeriesId.ToString(), StringComparer.OrdinalIgnoreCase))
                    candidateIds.Add(episode.SeriesId.ToString());
                if (episode.Series != null && episode.Series.Id != Guid.Empty && !candidateIds.Contains(episode.Series.Id.ToString(), StringComparer.OrdinalIgnoreCase))
                    candidateIds.Add(episode.Series.Id.ToString());

                var series = episode.Series ?? (episode.SeriesId != Guid.Empty ? _libraryManager.GetItemById(episode.SeriesId) as Series : null);
                if (series != null)
                {
                    if (episode.ParentIndexNumber.HasValue && episode.ParentIndexNumber.Value > 1 && episode.IndexNumber.HasValue)
                    {
                        try
                        {
                            int currentSeason = episode.ParentIndexNumber.Value;
                            int currentEpInSeason = episode.IndexNumber.Value;
                            var allSeriesEpisodes = series.GetEpisodes((dynamic)user, new MediaBrowser.Controller.Dto.DtoOptions(), false);
                            int calculatedAbsolute = 0;
                            bool foundCurrent = false;
                            foreach (var seriesEp in allSeriesEpisodes)
                            {
                                if (seriesEp is Episode ep)
                                {
                                    int sNum = ep.ParentIndexNumber ?? ep.AiredSeasonNumber ?? 1;
                                    int eNum = ep.IndexNumber ?? 1;
                                    if (sNum < currentSeason || (sNum == currentSeason && eNum <= currentEpInSeason))
                                    {
                                        calculatedAbsolute++;
                                    }
                                    if (ep.Id == episode.Id)
                                    {
                                        foundCurrent = true;
                                        break;
                                    }
                                }
                            }
                            if (foundCurrent && calculatedAbsolute > 0)
                            {
                                episodeNumber = calculatedAbsolute;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug(ex, "[Aquila PlaybackTracker] Could not calculate cumulative episode number for '{EpName}'", episode.Name);
                        }
                    }

                    try
                    {
                        System.Collections.IEnumerable episodesList = series.GetEpisodes((dynamic)user, new MediaBrowser.Controller.Dto.DtoOptions(), false);
                        int count = 0;
                        foreach (var _ in episodesList)
                        {
                            count++;
                        }
                        totalEpisodes = count;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "[Aquila PlaybackTracker] Failed to count series episodes for '{SeriesName}'", series.Name);
                    }
                }

                _logger.LogInformation("[Aquila PlaybackTracker] Episode '{EpName}' Ep #{EpNum} of Series '{SeriesName}' (Candidates: {Candidates}, TotalEp: {TotalEp})",
                    episode.Name, episodeNumber, series?.Name, string.Join(", ", candidateIds), totalEpisodes);
            }
            else if (fullItem is Movie)
            {
                mediaType = "movie";
                episodeNumber = 1;
                totalEpisodes = 1;
                _logger.LogInformation("[Aquila PlaybackTracker] Movie '{MovieName}' (MovieId: {MovieId})", fullItem.Name, fullItem.Id);
            }

            if (!candidateIds.Contains(fullItem.Id.ToString(), StringComparer.OrdinalIgnoreCase))
            {
                candidateIds.Add(fullItem.Id.ToString());
            }

            await _syncManager.HandleScrobbleAsync(userId, candidateIds, episodeNumber, totalEpisodes, userConfig, mediaType).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Aquila PlaybackTracker] Error processing scrobble trigger for item '{ItemName}'", item.Name);
        }
    }

    private async void OnUserDataSaved(object? sender, UserDataSaveEventArgs e)
    {
        try
        {
            _logger.LogInformation("[Aquila PlaybackTracker] UserDataSaved event fired: ItemId={ItemId}, ItemName='{ItemName}', UserId={UserId}, Played={Played}, SaveReason={Reason}",
                e.Item?.Id, e.Item?.Name, e.UserId, e.UserData?.Played, e.SaveReason);

            if (e.Item == null || e.UserData == null || e.UserId == Guid.Empty)
            {
                _logger.LogWarning("[Aquila PlaybackTracker] UserDataSaved ignored: missing Item, UserData, or UserId.");
                return;
            }

            if (e.UserData.Played)
            {
                string userIdStr = e.UserId.ToString();
                if (!TryMarkItemScrobbled(userIdStr, e.Item.Id.ToString()))
                {
                    return;
                }

                var config = Plugin.Instance?.Configuration;
                if (config == null || config.UserConfigs == null || !config.UserConfigs.Any())
                {
                    _logger.LogWarning("[Aquila PlaybackTracker] Plugin configuration or UserConfigs is empty.");
                    return;
                }

                var userConfig = config.UserConfigs.FirstOrDefault(u => MatchUserId(u.JellyfinUserId, userIdStr))
                              ?? config.UserConfigs.FirstOrDefault();

                if (userConfig == null)
                {
                    _logger.LogWarning("[Aquila PlaybackTracker] Could not find UserAquilaConfig for UserId {UserId}", userIdStr);
                    return;
                }

                var user = _userManager.GetUserById(e.UserId);
                if (user == null)
                {
                    _logger.LogWarning("[Aquila PlaybackTracker] Could not resolve User from IUserManager for UserId {UserId}", userIdStr);
                    return;
                }

                _logger.LogInformation("[Aquila PlaybackTracker] Item '{ItemName}' (ID: {ItemId}) was marked as watched by User {UserId}. Triggering scrobble...",
                    e.Item.Name, e.Item.Id, userIdStr);

                await TriggerScrobbleAsync(e.Item, user, userConfig, config).ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Aquila PlaybackTracker] Error handling manual watch event for item '{ItemName}'", e.Item?.Name);
        }
    }

    private static bool MatchUserId(string id1, string id2)
    {
        if (string.IsNullOrWhiteSpace(id1) || string.IsNullOrWhiteSpace(id2)) return false;
        return string.Equals(id1.Replace("-", ""), id2.Replace("-", ""), StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public void Dispose()
    {
        _sessionManager.PlaybackProgress -= OnPlaybackProgress;
        _sessionManager.PlaybackStopped -= OnPlaybackStopped;
        _userDataManager.UserDataSaved -= OnUserDataSaved;
    }
}
