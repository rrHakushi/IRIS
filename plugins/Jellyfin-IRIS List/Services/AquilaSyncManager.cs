using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Aquila.Api;
using Jellyfin.Plugin.Aquila.Configuration;
using Jellyfin.Plugin.Aquila.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Aquila.Services;

/// <summary>
/// Scrobble decision engine enforcing duplicate watch safeguards and unscored completion logic.
/// </summary>
public class AquilaSyncManager
{
    private readonly AquilaApiClient _apiClient;
    private readonly MediaMappingStore _mappingStore;
    private readonly ILogger<AquilaSyncManager> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="AquilaSyncManager"/> class.
    /// </summary>
    public AquilaSyncManager(AquilaApiClient apiClient, MediaMappingStore mappingStore, ILogger<AquilaSyncManager> logger)
    {
        _apiClient = apiClient;
        _mappingStore = mappingStore;
        _logger = logger;
    }

    /// <summary>
    /// Handles episode/movie scrobble when playback threshold (90%) or manual watch event is triggered.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, string jellyfinItemId, int episodeNumber, int? totalEpisodes, UserAquilaConfig userConfig, string mediaType)
    {
        await HandleScrobbleAsync(userId, new System.Collections.Generic.List<string> { jellyfinItemId }, episodeNumber, totalEpisodes, userConfig, mediaType).ConfigureAwait(false);
    }

    /// <summary>
    /// Handles episode/movie scrobble using candidate Jellyfin item IDs (SeriesId, SeasonId, EpisodeId) and media title.
    /// </summary>
    public async Task HandleScrobbleAsync(string userId, System.Collections.Generic.List<string> candidateItemIds, int episodeNumber, int? totalEpisodes, UserAquilaConfig userConfig, string mediaType, string itemTitle = "")
    {
        var primaryId = candidateItemIds.FirstOrDefault() ?? "unknown";
        var episodeId = candidateItemIds.LastOrDefault() ?? primaryId;
        var seriesId = candidateItemIds.FirstOrDefault() ?? episodeId;
        _logger.LogInformation("[Aquila SyncManager] Processing scrobble request for Title '{ItemTitle}': User={UserId}, PrimaryItem={ItemId}, EpisodeId={EpId}, SeriesId={SeriesId}, EpNum={EpNum}, TotalEp={TotalEp}, Type={MediaType}",
            itemTitle, userId, primaryId, episodeId, seriesId, episodeNumber, totalEpisodes, mediaType);
        Console.WriteLine($"[Aquila SyncManager] SCROBBLE START: Title='{itemTitle}', User={userId}, ItemId={primaryId}, EpNum={episodeNumber}");

        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            _logger.LogWarning("[Aquila SyncManager] Aborting scrobble: User {UserId} has no Aquila API key configured.", userId);
            return;
        }

        // Fetch Jellyfin Item -> Aquila Media ID mapping using candidate IDs
        var mapping = _mappingStore.GetMappingForCandidateIds(userId, candidateItemIds);
        if (mapping == null)
        {
            _logger.LogWarning("[Aquila SyncManager] No media link mapping found for Title '{ItemTitle}' (User {UserId}) across candidate IDs [{CandidateIds}]. Use the Aquila in-player button to link media.",
                itemTitle, userId, string.Join(", ", candidateItemIds));
            Console.WriteLine($"[Aquila SyncManager] NO MAPPING: Title='{itemTitle}', User={userId}");
            return;
        }

        var orderedEntries = mapping.GetOrderedEntries();
        if (orderedEntries.Count == 0)
        {
            _logger.LogWarning("[Aquila SyncManager] Mapping for Title '{ItemTitle}' (User {UserId}) has empty linked entries list.", itemTitle, userId);
            return;
        }

        _logger.LogInformation("[Aquila SyncManager] Found mapping for Title '{ItemTitle}' (User {UserId}): {Count} ordered linked entries", itemTitle, userId, orderedEntries.Count);
        Console.WriteLine($"[Aquila SyncManager] MAPPING FOUND: Title='{itemTitle}', EntriesCount={orderedEntries.Count}");

        for (int i = 0; i < orderedEntries.Count; i++)
        {
            var entry = orderedEntries[i];
            int aquilaMediaId = entry.AquilaMediaId;
            string effectiveMediaType = !string.IsNullOrWhiteSpace(entry.MediaType) ? entry.MediaType : mediaType;
            string entryTitle = !string.IsNullOrWhiteSpace(entry.DisplayTitle) ? entry.DisplayTitle : itemTitle;

            // Fetch current list entry details from Aquila
            var listEntryDoc = await _apiClient.GetListEntryAsync(effectiveMediaType, aquilaMediaId, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);

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
                    if (root.TryGetProperty("totalEpisodes", out var teProp) && teProp.ValueKind == JsonValueKind.Number)
                    {
                        entryMaxProgress = teProp.GetInt32();
                    }
                    else if (root.TryGetProperty("episodes", out var epProp) && epProp.ValueKind == JsonValueKind.Number)
                    {
                        entryMaxProgress = epProp.GetInt32();
                    }
                    else if (root.TryGetProperty("media", out var mediaProp) && mediaProp.ValueKind == JsonValueKind.Object)
                    {
                        if (mediaProp.TryGetProperty("episodeCount", out var ecProp) && ecProp.ValueKind == JsonValueKind.Number)
                        {
                            entryMaxProgress = ecProp.GetInt32();
                        }
                    }
                }
                _logger.LogInformation("[Aquila SyncManager] Checked Entry #{Order} (Aquila ID {AquilaId}, Title='{EntryTitle}'): Progress={Progress}/{MaxProgress}, Status={Status}, Score={Score}",
                    entry.Order, aquilaMediaId, entryTitle, currentProgress, entryMaxProgress?.ToString() ?? "?", status, score);
                Console.WriteLine($"[Aquila SyncManager] CHECK ENTRY #{entry.Order}: Aquila ID={aquilaMediaId}, Title='{entryTitle}', Progress={currentProgress}/{entryMaxProgress?.ToString() ?? "?"}, Status={status}");
            }
            else
            {
                _logger.LogInformation("[Aquila SyncManager] Entry #{Order} (Aquila ID {AquilaId}, Title='{EntryTitle}') has no prior list entry.", entry.Order, aquilaMediaId, entryTitle);
                Console.WriteLine($"[Aquila SyncManager] NO PRIOR LIST ENTRY: Entry #{entry.Order}, Aquila ID={aquilaMediaId}, Title='{entryTitle}'");
            }

            bool isCompletedStatus = string.Equals(status, "COMPLETED", StringComparison.OrdinalIgnoreCase) ||
                                     string.Equals(status, "FINISHED", StringComparison.OrdinalIgnoreCase);
            bool isMaxedProgress = entryMaxProgress.HasValue && entryMaxProgress.Value > 0 && currentProgress >= entryMaxProgress.Value;
            bool isCompleted = isCompletedStatus || isMaxedProgress;

            bool isLastEntry = (i == orderedEntries.Count - 1);

            if (isCompleted && !isLastEntry)
            {
                var nextEntry = orderedEntries[i + 1];
                _logger.LogInformation("[Aquila SyncManager] AUTO-ADVANCE: Entry #{Order} (Aquila ID {AquilaId}, Title='{EntryTitle}') is COMPLETED/MAXED (Progress: {Progress}/{Max}). Auto-advancing to Entry #{NextOrder} (Aquila ID {NextId}, Title='{NextTitle}')...",
                    entry.Order, aquilaMediaId, entryTitle, currentProgress, entryMaxProgress?.ToString() ?? "?", nextEntry.Order, nextEntry.AquilaMediaId, nextEntry.DisplayTitle ?? itemTitle);
                Console.WriteLine($"[Aquila SyncManager] AUTO-ADVANCE: '{entryTitle}' is maxed. Auto-advancing to '{nextEntry.DisplayTitle ?? itemTitle}' (Aquila ID {nextEntry.AquilaMediaId})");
                continue;
            }

            // Scrobble to this active entry
            _logger.LogInformation("[Aquila SyncManager] TARGET ENTRY IDENTIFIED: Scrobbled Title '{Title}' to Entry #{Order} (Aquila ID {AquilaId}, Type={MediaType})", entryTitle, entry.Order, aquilaMediaId, effectiveMediaType);
            Console.WriteLine($"[Aquila SyncManager] TARGET ENTRY: Title='{entryTitle}', Aquila ID={aquilaMediaId}, Order={entry.Order}, Type={effectiveMediaType}");

            var incrementDto = new AquilaIncrementDto
            {
                MediaType = effectiveMediaType,
                Id = aquilaMediaId,
                Count = 1
            };
            bool success = await _apiClient.IncrementProgressAsync(incrementDto, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
            if (success)
            {
                _logger.LogInformation("[Aquila SyncManager] SUCCESS: Scrobbled progress for Title '{Title}' (Aquila Media ID {AquilaId}, Entry #{Order})", entryTitle, aquilaMediaId, entry.Order);
                Console.WriteLine($"[Aquila SyncManager] SUCCESS: Incremented progress for Title='{entryTitle}' (Aquila ID={aquilaMediaId})");
            }
            else
            {
                // If entry doesn't exist on list yet, create fresh entry with progress = 1
                int targetProgress = Math.Max(currentProgress + 1, 1);
                var saveDto = new AquilaSaveEntryDto
                {
                    Status = "WATCHING",
                    Progress = targetProgress
                };
                SetSaveDtoMediaId(saveDto, effectiveMediaType, aquilaMediaId);
                _logger.LogInformation("[Aquila SyncManager] FALLBACK UPSERT: Creating entry for Title '{Title}' (Aquila ID {AquilaId}) with Status=WATCHING, Progress={Progress}",
                    entryTitle, aquilaMediaId, targetProgress);
                Console.WriteLine($"[Aquila SyncManager] FALLBACK UPSERT: Creating entry for Title='{entryTitle}', Aquila ID={aquilaMediaId}, Progress={targetProgress}");

                bool saveSuccess = await _apiClient.SaveListEntryAsync(effectiveMediaType, saveDto, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
                if (saveSuccess)
                {
                    _logger.LogInformation("[Aquila SyncManager] SUCCESS (Fallback Upsert): Created list entry for Title '{Title}' with progress {Progress} (Aquila Media ID {AquilaId})", entryTitle, targetProgress, aquilaMediaId);
                    Console.WriteLine($"[Aquila SyncManager] SUCCESS (Fallback): Created list entry for Title='{entryTitle}' (Aquila ID={aquilaMediaId})");
                }
                else
                {
                    _logger.LogError("[Aquila SyncManager] FAILED to scrobble or upsert progress for Title '{Title}' (Aquila Media ID {AquilaId})", entryTitle, aquilaMediaId);
                    Console.WriteLine($"[Aquila SyncManager] ERROR: Failed fallback upsert for Title='{entryTitle}' (Aquila ID={aquilaMediaId})");
                }
            }

            break; // Stop after scrobbled to target entry
        }
    }

    private static void SetSaveDtoMediaId(AquilaSaveEntryDto dto, string mediaType, int mediaId)
    {
        switch (mediaType.ToUpperInvariant())
        {
            case "ANIME":
                dto.AnimeId = mediaId;
                break;
            case "MOVIE":
                dto.MovieId = mediaId;
                break;
            case "TV":
            default:
                dto.TvId = mediaId;
                break;
        }
    }
}
