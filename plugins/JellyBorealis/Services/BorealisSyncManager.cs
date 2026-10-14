using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Borealis.Api;
using Jellyfin.Plugin.Borealis.Configuration;
using Jellyfin.Plugin.Borealis.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Borealis.Services;

/// <summary>
/// Scrobble decision engine enforcing duplicate watch safeguards, auto-advance, and upsert fallback.
/// </summary>
public class BorealisSyncManager
{
    private readonly BorealisApiClient _apiClient;
    private readonly MediaMappingStore _mappingStore;
    private readonly ILogger<BorealisSyncManager> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="BorealisSyncManager"/> class.
    /// </summary>
    public BorealisSyncManager(BorealisApiClient apiClient, MediaMappingStore mappingStore, ILogger<BorealisSyncManager> logger)
    {
        _apiClient = apiClient;
        _mappingStore = mappingStore;
        _logger = logger;
    }

    /// <summary>
    /// Handles episode/movie scrobble when playback threshold or manual watch event is triggered.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, string jellyfinItemId, int episodeNumber, int? totalEpisodes, UserBorealisConfig userConfig, string mediaType)
    {
        await HandleScrobbleAsync(userId, new List<string> { jellyfinItemId }, episodeNumber, totalEpisodes, userConfig, mediaType).ConfigureAwait(false);
    }

    /// <summary>
    /// Handles episode/movie scrobble using candidate Jellyfin item IDs (SeriesId, SeasonId, EpisodeId) and media title.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, List<string> candidateItemIds, int episodeNumber, int? totalEpisodes, UserBorealisConfig userConfig, string mediaType, string itemTitle = "")
    {
        var primaryId = candidateItemIds.FirstOrDefault() ?? "unknown";
        var episodeId = candidateItemIds.LastOrDefault() ?? primaryId;
        var seriesId = candidateItemIds.FirstOrDefault() ?? episodeId;

        _logger.LogInformation("[Borealis SyncManager] Processing scrobble request for Title '{ItemTitle}': User={UserId}, PrimaryItem={ItemId}, EpisodeId={EpId}, SeriesId={SeriesId}, EpNum={EpNum}, TotalEp={TotalEp}, Type={MediaType}",
            itemTitle, userId, primaryId, episodeId, seriesId, episodeNumber, totalEpisodes, mediaType);

        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            _logger.LogWarning("[Borealis SyncManager] Aborting scrobble: User {UserId} has no Borealis API key configured.", userId);
            return;
        }

        // Fetch Jellyfin Item -> Borealis Media ID mapping using candidate IDs
        var mapping = _mappingStore.GetMappingForCandidateIds(userId, candidateItemIds);
        if (mapping == null)
        {
            _logger.LogWarning("[Borealis SyncManager] No media link mapping found for Title '{ItemTitle}' (User {UserId}) across candidate IDs [{CandidateIds}]. Use the Borealis in-player button to link media.",
                itemTitle, userId, string.Join(", ", candidateItemIds));
            return;
        }

        var orderedEntries = mapping.GetOrderedEntries();
        if (orderedEntries.Count == 0)
        {
            _logger.LogWarning("[Borealis SyncManager] Mapping for Title '{ItemTitle}' (User {UserId}) has empty linked entries list.", itemTitle, userId);
            return;
        }

        _logger.LogInformation("[Borealis SyncManager] Found mapping for Title '{ItemTitle}' (User {UserId}): {Count} ordered linked entries", itemTitle, userId, orderedEntries.Count);

        for (int i = 0; i < orderedEntries.Count; i++)
        {
            var entry = orderedEntries[i];
            int borealisMediaId = entry.BorealisMediaId > 0 ? entry.BorealisMediaId : entry.IrisMediaId;
            string effectiveMediaType = !string.IsNullOrWhiteSpace(entry.MediaType) ? entry.MediaType : mediaType;
            string entryTitle = !string.IsNullOrWhiteSpace(entry.DisplayTitle) ? entry.DisplayTitle : itemTitle;

            // Fetch current list entry details from Borealis
            var listEntryDoc = await _apiClient.GetListEntryAsync(effectiveMediaType, borealisMediaId, userConfig.ApiKey, userConfig.BorealisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);

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

                _logger.LogInformation("[Borealis SyncManager] Checked Entry #{Order} (Borealis ID {BorealisId}, Title='{EntryTitle}'): Progress={Progress}/{MaxProgress}, Status={Status}, Score={Score}",
                    entry.Order, borealisMediaId, entryTitle, currentProgress, entryMaxProgress?.ToString() ?? "?", status, score);
            }
            else
            {
                _logger.LogInformation("[Borealis SyncManager] Entry #{Order} (Borealis ID {BorealisId}, Title='{EntryTitle}') has no prior list entry.", entry.Order, borealisMediaId, entryTitle);
            }

            bool isCompletedStatus = string.Equals(status, "COMPLETED", StringComparison.OrdinalIgnoreCase);
            bool isMaxedProgress = entryMaxProgress.HasValue && entryMaxProgress.Value > 0 && currentProgress >= entryMaxProgress.Value;
            bool isCompleted = isCompletedStatus || isMaxedProgress;

            bool isLastEntry = (i == orderedEntries.Count - 1);

            if (isCompleted && !isLastEntry)
            {
                var nextEntry = orderedEntries[i + 1];
                int nextId = nextEntry.BorealisMediaId > 0 ? nextEntry.BorealisMediaId : nextEntry.IrisMediaId;
                _logger.LogInformation("[Borealis SyncManager] AUTO-ADVANCE: Entry #{Order} (Borealis ID {BorealisId}, Title='{EntryTitle}') is COMPLETED/MAXED. Auto-advancing to Entry #{NextOrder} (Borealis ID {NextId}, Title='{NextTitle}')...",
                    entry.Order, borealisMediaId, entryTitle, nextEntry.Order, nextId, nextEntry.DisplayTitle ?? itemTitle);
                continue;
            }

            // Scrobble to this active entry
            _logger.LogInformation("[Borealis SyncManager] TARGET ENTRY: Scrobbled Title '{Title}' to Entry #{Order} (Borealis ID {BorealisId}, Type={MediaType})", entryTitle, entry.Order, borealisMediaId, effectiveMediaType);

            bool success = await _apiClient.IncrementProgressAsync(effectiveMediaType, borealisMediaId, 1, userConfig.ApiKey, userConfig.BorealisServerUrl, "EPISODE", userConfig.CachedUsername).ConfigureAwait(false);
            if (success)
            {
                _logger.LogInformation("[Borealis SyncManager] SUCCESS: Incremented progress for Title '{Title}' (Borealis ID {BorealisId}, Entry #{Order})", entryTitle, borealisMediaId, entry.Order);
            }
            else
            {
                // Fallback: If entry doesn't exist on list yet, upsert entry with progress = 1
                int targetProgress = Math.Max(currentProgress + 1, 1);
                var saveDto = new BorealisSaveEntryDto
                {
                    Status = "WATCHING",
                    Progress = targetProgress
                };

                _logger.LogInformation("[Borealis SyncManager] FALLBACK UPSERT: Creating entry for Title '{Title}' (Borealis ID {BorealisId}) with Status=WATCHING, Progress={Progress}",
                    entryTitle, borealisMediaId, targetProgress);

                bool saveSuccess = await _apiClient.SaveListEntryAsync(effectiveMediaType, borealisMediaId, saveDto, userConfig.ApiKey, userConfig.BorealisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
                if (saveSuccess)
                {
                    _logger.LogInformation("[Borealis SyncManager] SUCCESS (Fallback Upsert): Created list entry for Title '{Title}' with progress {Progress} (Borealis ID {BorealisId})", entryTitle, targetProgress, borealisMediaId);
                }
                else
                {
                    _logger.LogError("[Borealis SyncManager] FAILED to scrobble or upsert progress for Title '{Title}' (Borealis ID {BorealisId})", entryTitle, borealisMediaId);
                }
            }

            break; // Stop after scrobbling to target entry
        }
    }
}
