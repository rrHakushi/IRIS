using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.Iris.Configuration;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Services;

/// <summary>
/// SessionManager event listener for tracking playback progress and triggering completion scrobbles
/// based on independent per-library scrobble thresholds.
/// </summary>
public class PlaybackTracker : IHostedService, IDisposable
{
    private readonly ISessionManager _sessionManager;
    private readonly ILibraryManager _libraryManager;
    private readonly IUserDataManager _userDataManager;
    private readonly IUserManager _userManager;
    private readonly IrisSyncManager _syncManager;
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
        IrisSyncManager syncManager,
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
        _logger.LogInformation("[Iris PlaybackTracker] Service starting... Registering PlaybackProgress, PlaybackStopped, and UserDataSaved listeners.");
        _sessionManager.PlaybackProgress += OnPlaybackProgress;
        _sessionManager.PlaybackStopped += OnPlaybackStopped;
        _userDataManager.UserDataSaved += OnUserDataSaved;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[Iris PlaybackTracker] Service stopping... Unregistering listeners.");
        _sessionManager.PlaybackProgress -= OnPlaybackProgress;
        _sessionManager.PlaybackStopped -= OnPlaybackStopped;
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        return Task.CompletedTask;
    }

    private bool TryMarkItemScrobbled(string userId, string itemId)
    {
        string normUser = userId.Replace("-", "").ToLowerInvariant();
        string normItem = itemId.Replace("-", "").ToLowerInvariant();
        string key = $"{normUser}_{normItem}";

        if (_scrobbledSessions.TryGetValue(key, out var lastScrobbledTime))
        {
            if (DateTime.UtcNow - lastScrobbledTime < TimeSpan.FromHours(12))
            {
                _logger.LogDebug("[Iris PlaybackTracker] Scrobble skipped (already scrobbled in active session) for key {Key}", key);
                return false;
            }
        }

        _scrobbledSessions[key] = DateTime.UtcNow;
        return true;
    }

    private void OnPlaybackProgress(object? sender, PlaybackProgressEventArgs e)
    {
        _ = ProcessPlaybackProgressAsync(e);
    }

    private void OnPlaybackStopped(object? sender, PlaybackStopEventArgs e)
    {
        _ = ProcessPlaybackStopAsync(e);
    }

    private static LibraryMappingConfig? ResolveLibraryMapping(BaseItem item, PluginConfiguration config)
    {
        if (config.LibraryMappings == null || !config.LibraryMappings.Any())
        {
            return null;
        }

        var ancestorIds = new List<string>();
        var parent = item.GetParent();
        while (parent != null)
        {
            ancestorIds.Add(parent.Id.ToString());
            parent = parent.GetParent();
        }
        var topParentId = item.GetTopParent()?.Id.ToString();
        if (!string.IsNullOrEmpty(topParentId) && !ancestorIds.Contains(topParentId))
        {
            ancestorIds.Add(topParentId);
        }

        return config.LibraryMappings.FirstOrDefault(m => ancestorIds.Contains(m.LibraryId, StringComparer.OrdinalIgnoreCase));
    }

    private static double ResolveScrobbleThreshold(BaseItem item, UserIrisConfig userConfig, PluginConfiguration config)
    {
        var libMapping = ResolveLibraryMapping(item, config);
        if (libMapping != null && libMapping.ScrobbleThreshold > 0)
        {
            return libMapping.ScrobbleThreshold;
        }

        return userConfig.CompletionThreshold > 0 ? userConfig.CompletionThreshold : 90.0;
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

        double threshold = ResolveScrobbleThreshold(e.Item, userConfig, config);
        if (percentWatched >= threshold)
        {
            if (!TryMarkItemScrobbled(userId, e.Item.Id.ToString()))
            {
                return;
            }

            _logger.LogInformation("[Iris PlaybackTracker] Library Scrobble Threshold {Threshold}% met for item '{ItemName}' (ID: {ItemId}, Watched: {Percent:F1}%). Triggering scrobble...",
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
        double threshold = ResolveScrobbleThreshold(e.Item, userConfig, config);

        if (!shouldScrobble && e.PlaybackPositionTicks.HasValue && e.Item.RunTimeTicks.HasValue && e.Item.RunTimeTicks.Value > 0)
        {
            double percentWatched = ((double)e.PlaybackPositionTicks.Value / e.Item.RunTimeTicks.Value) * 100.0;
            if (percentWatched >= threshold)
            {
                shouldScrobble = true;
            }
        }

        if (shouldScrobble)
        {
            if (TryMarkItemScrobbled(userId, itemId))
            {
                _logger.LogInformation("[Iris PlaybackTracker] Playback stopped/completed for item '{ItemName}' (ID: {ItemId}, Threshold: {Threshold}%). Triggering scrobble...",
                    e.Item.Name, e.Item.Id, threshold);
                await TriggerScrobbleAsync(e.Item, user, userConfig, config).ConfigureAwait(false);
            }
        }
    }

    private async Task TriggerScrobbleAsync(BaseItem item, object user, UserIrisConfig userConfig, PluginConfiguration config)
    {
        try
        {
            string userId = ((dynamic)user).Id.ToString();
            var fullItem = _libraryManager.GetItemById(item.Id) ?? item;

            var matchedMapping = ResolveLibraryMapping(fullItem, config);
            string mediaType = matchedMapping?.MediaType ?? "tv";

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

            }
            else
            {
                candidateIds.Add(fullItem.Id.ToString());
                var parent = fullItem.GetParent();
                while (parent != null)
                {
                    candidateIds.Add(parent.Id.ToString());
                    parent = parent.GetParent();
                }
            }

            string itemTitle = fullItem.Name ?? string.Empty;
            if (fullItem is Episode epItem && !string.IsNullOrEmpty(epItem.SeriesName))
            {
                itemTitle = epItem.SeriesName;
            }

            await _syncManager.HandleScrobbleAsync(userId, candidateIds, episodeNumber, totalEpisodes, userConfig, mediaType, itemTitle).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Iris PlaybackTracker] Error during scrobble trigger for item ID: {ItemId}", item.Id);
        }
    }

    private void OnUserDataSaved(object? sender, UserDataSaveEventArgs e)
    {
        if (e.UserData == null || !e.UserData.Played)
        {
            return;
        }

        var config = Plugin.Instance?.Configuration;
        if (config == null || config.UserConfigs == null || !config.UserConfigs.Any())
        {
            return;
        }

        var userId = e.UserId.ToString();
        var userConfig = config.UserConfigs.FirstOrDefault(u => MatchUserId(u.JellyfinUserId, userId))
                      ?? config.UserConfigs.FirstOrDefault();

        if (userConfig == null)
        {
            return;
        }

        var item = _libraryManager.GetItemById(e.Item.Id);
        if (item == null)
        {
            return;
        }

        if (TryMarkItemScrobbled(userId, item.Id.ToString()))
        {
            _logger.LogInformation("[Iris PlaybackTracker] UserDataSaved manual marked-as-played for item '{ItemName}' (ID: {ItemId}). Triggering scrobble...", item.Name, item.Id);
            _ = TriggerScrobbleAsync(item, new { Id = e.UserId }, userConfig, config);
        }
    }

    private static bool MatchUserId(string? configuredId, string actualId)
    {
        if (string.IsNullOrWhiteSpace(configuredId)) return false;
        return string.Equals(configuredId.Replace("-", ""), actualId.Replace("-", ""), StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public void Dispose()
    {
        _sessionManager.PlaybackProgress -= OnPlaybackProgress;
        _sessionManager.PlaybackStopped -= OnPlaybackStopped;
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        GC.SuppressFinalize(this);
    }
}
