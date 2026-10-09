using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Iris.Api;
using Jellyfin.Plugin.Iris.Configuration;
using Jellyfin.Plugin.Iris.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Services;

/// <summary>
/// Scrobble decision engine enforcing duplicate watch safeguards, auto-advance, and upsert fallback.
/// </summary>
public class IrisSyncManager
{
    private readonly IrisApiClient _apiClient;
    private readonly MediaMappingStore _mappingStore;
    private readonly ILogger<IrisSyncManager> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="IrisSyncManager"/> class.
    /// </summary>
    public IrisSyncManager(IrisApiClient apiClient, MediaMappingStore mappingStore, ILogger<IrisSyncManager> logger)
    {
        _apiClient = apiClient;
        _mappingStore = mappingStore;
        _logger = logger;
    }

    /// <summary>
    /// Handles episode/movie scrobble when playback threshold or manual watch event is triggered.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, string jellyfinItemId, int episodeNumber, int? totalEpisodes, UserIrisConfig userConfig, string mediaType)
    {
        await HandleScrobbleAsync(userId, new List<string> { jellyfinItemId }, episodeNumber, totalEpisodes, userConfig, mediaType).ConfigureAwait(false);
    }

    /// <summary>
    /// Handles episode/movie scrobble using candidate Jellyfin item IDs (SeriesId, SeasonId, EpisodeId) and media title.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, List<string> candidateItemIds, int episodeNumber, int? totalEpisodes, UserIrisConfig userConfig, string mediaType, string itemTitle = "")
    {
        var primaryId = candidateItemIds.FirstOrDefault() ?? "unknown";
        var episodeId = candidateItemIds.LastOrDefault() ?? primaryId;
        var seriesId = candidateItemIds.FirstOrDefault() ?? episodeId;

        _logger.LogInformation("[Iris SyncManager] Processing scrobble request for Title '{ItemTitle}': User={UserId}, PrimaryItem={ItemId}, EpisodeId={EpId}, SeriesId={SeriesId}, EpNum={EpNum}, TotalEp={TotalEp}, Type={MediaType}",
            itemTitle, userId, primaryId, episodeId, seriesId, episodeNumber, totalEpisodes, mediaType);

        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            _logger.LogWarning("[Iris SyncManager] Aborting scrobble: User {UserId} has no Iris API key configured.", userId);
            return;
        }

        // Fetch Jellyfin Item -> Iris Media ID mapping using candidate IDs
        var mapping = _mappingStore.GetMappingForCandidateIds(userId, candidateItemIds);
        if (mapping == null)
        {
            _logger.LogWarning("[Iris SyncManager] No media link mapping found for Title '{ItemTitle}' (User {UserId}) across candidate IDs [{CandidateIds}]. Use the Iris in-player button to link media.",
                itemTitle, userId, string.Join(", ", candidateItemIds));
            return;
        }

        var orderedEntries = mapping.GetOrderedEntries();
        if (orderedEntries.Count == 0)
        {
            _logger.LogWarning("[Iris SyncManager] Mapping for Title '{ItemTitle}' (User {UserId}) has empty linked entries list.", itemTitle, userId);
            return;
        }

        _logger.LogInformation("[Iris SyncManager] Found mapping for Title '{ItemTitle}' (User {UserId}): {Count} ordered linked entries", itemTitle, userId, orderedEntries.Count);

        for (int i = 0; i < orderedEntries.Count; i++)
        {
            var entry = orderedEntries[i];
            int irisMediaId = entry.IrisMediaId;
            string effectiveMediaType = !string.IsNullOrWhiteSpace(entry.MediaType) ? entry.MediaType : mediaType;
            string entryTitle = !string.IsNullOrWhiteSpace(entry.DisplayTitle) ? entry.DisplayTitle : itemTitle;

            // Fetch current list entry details from Iris
            var listEntryDoc = await _apiClient.GetListEntryAsync(effectiveMediaType, irisMediaId, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);

            int currentProgress = 0;
            string status = "WATCHING";
            double score = 0;
            bool entryExists = listEntryDoc.HasValue;
            int? entryMaxProgress = entry.MaxProgress;

            if (entryExists)
            {
                var root = listEntryDoc.Value;
                if (root.TryGetProperty("progress", out var pProp) && pProp.ValueKind == JsonValueKind.Number)
                {
                    currentProgress = pProp.GetInt32();
                }
                if (root.TryGetProperty("status", out var sProp) && sProp.ValueKind == JsonValueKind.String)
                {
                    status = sProp.GetString() ?? "WATCHING";
                }
                if (root.TryGetProperty("score", out var scProp) && scProp.ValueKind == JsonValueKind.Number)
                {
                    score = scProp.GetDouble();
                }
                if (!entryMaxProgress.HasValue)
                {
                    if (root.TryGetProperty("media", out var mediaProp) && mediaProp.ValueKind == JsonValueKind.Object)
                    {
                        if (mediaProp.TryGetProperty("episodeCount", out var ecProp) && ecProp.ValueKind == JsonValueKind.Number)
                        {
                            entryMaxProgress = ecProp.GetInt32();
                        }
                    }
                }

                _logger.LogInformation("[Iris SyncManager] Checked Entry #{Order} (Iris ID {IrisId}, Title='{EntryTitle}'): Progress={Progress}/{MaxProgress}, Status={Status}, Score={Score}",
                    entry.Order, irisMediaId, entryTitle, currentProgress, entryMaxProgress?.ToString() ?? "?", status, score);
            }
            else
            {
                _logger.LogInformation("[Iris SyncManager] Entry #{Order} (Iris ID {IrisId}, Title='{EntryTitle}') has no prior list entry.", entry.Order, irisMediaId, entryTitle);
            }

            bool isCompletedStatus = string.Equals(status, "COMPLETED", StringComparison.OrdinalIgnoreCase);
            bool isMaxedProgress = entryMaxProgress.HasValue && entryMaxProgress.Value > 0 && currentProgress >= entryMaxProgress.Value;
            bool isCompleted = isCompletedStatus || isMaxedProgress;

            bool isLastEntry = (i == orderedEntries.Count - 1);

            if (isCompleted && !isLastEntry)
            {
                var nextEntry = orderedEntries[i + 1];
                _logger.LogInformation("[Iris SyncManager] AUTO-ADVANCE: Entry #{Order} (Iris ID {IrisId}, Title='{EntryTitle}') is COMPLETED/MAXED. Auto-advancing to Entry #{NextOrder} (Iris ID {NextId}, Title='{NextTitle}')...",
                    entry.Order, irisMediaId, entryTitle, nextEntry.Order, nextEntry.IrisMediaId, nextEntry.DisplayTitle ?? itemTitle);
                continue;
            }

            // Scrobble to this active entry
            _logger.LogInformation("[Iris SyncManager] TARGET ENTRY: Scrobbled Title '{Title}' to Entry #{Order} (Iris ID {IrisId}, Type={MediaType})", entryTitle, entry.Order, irisMediaId, effectiveMediaType);

            bool success = await _apiClient.IncrementProgressAsync(effectiveMediaType, irisMediaId, 1, userConfig.ApiKey, userConfig.IrisServerUrl, "EPISODE", userConfig.CachedUsername).ConfigureAwait(false);
            if (success)
            {
                _logger.LogInformation("[Iris SyncManager] SUCCESS: Incremented progress for Title '{Title}' (Iris ID {IrisId}, Entry #{Order})", entryTitle, irisMediaId, entry.Order);
            }
            else
            {
                // Fallback: If entry doesn't exist on list yet, upsert entry with progress = 1
                int targetProgress = Math.Max(currentProgress + 1, 1);
                var saveDto = new IrisSaveEntryDto
                {
                    Status = "WATCHING",
                    Progress = targetProgress
                };

                _logger.LogInformation("[Iris SyncManager] FALLBACK UPSERT: Creating entry for Title '{Title}' (Iris ID {IrisId}) with Status=WATCHING, Progress={Progress}",
                    entryTitle, irisMediaId, targetProgress);

                bool saveSuccess = await _apiClient.SaveListEntryAsync(effectiveMediaType, irisMediaId, saveDto, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
                if (saveSuccess)
                {
                    _logger.LogInformation("[Iris SyncManager] SUCCESS (Fallback Upsert): Created list entry for Title '{Title}' with progress {Progress} (Iris ID {IrisId})", entryTitle, targetProgress, irisMediaId);
                }
                else
                {
                    _logger.LogError("[Iris SyncManager] FAILED to scrobble or upsert progress for Title '{Title}' (Iris ID {IrisId})", entryTitle, irisMediaId);
                }
            }

            break; // Stop after scrobbling to target entry
        }
    }
}
