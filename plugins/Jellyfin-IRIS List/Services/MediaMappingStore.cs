using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Aquila.Models;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Aquila.Services;

/// <summary>
/// Thread-safe local storage manager for Jellyfin Item ID -> Aquila Media ID mappings.
/// </summary>
public class MediaMappingStore
{
    private readonly string _filePath;
    private readonly ILogger<MediaMappingStore> _logger;
    private readonly ConcurrentDictionary<string, JellyfinItemMapping> _mappings = new();

    /// <summary>
    /// Initializes a new instance of the <see cref="MediaMappingStore"/> class.
    /// </summary>
    public MediaMappingStore(IApplicationPaths applicationPaths, ILogger<MediaMappingStore> logger)
    {
        _logger = logger;
        var dataFolder = Path.Combine(applicationPaths.PluginConfigurationsPath, "Aquila");
        Directory.CreateDirectory(dataFolder);
        _filePath = Path.Combine(dataFolder, "item-mappings.json");
        _logger.LogInformation("[Aquila MappingStore] Storage path: {FilePath}", _filePath);
        Load();
    }

    private void Load()
    {
        try
        {
            if (File.Exists(_filePath))
            {
                var json = File.ReadAllText(_filePath);
                var items = JsonSerializer.Deserialize<List<JellyfinItemMapping>>(json);
                if (items != null)
                {
                    foreach (var item in items)
                    {
                        var key = GetKey(item.UserId, item.JellyfinItemId);
                        _mappings[key] = item;
                    }
                }
                _logger.LogInformation("[Aquila MappingStore] Loaded {Count} mappings from storage.", _mappings.Count);
            }
            else
            {
                _logger.LogInformation("[Aquila MappingStore] No existing mappings file found at {FilePath}. Starting empty.", _filePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Aquila MappingStore] Failed to load Aquila item mappings from {FilePath}", _filePath);
        }
    }

    private async Task SaveAsync()
    {
        try
        {
            var list = _mappings.Values.ToList();
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(_filePath, json).ConfigureAwait(false);
            _logger.LogInformation("[Aquila MappingStore] Saved {Count} item mappings to disk.", list.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Aquila MappingStore] Failed to save Aquila item mappings to {FilePath}", _filePath);
        }
    }

    private static string NormalizeGuid(string? id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Equals("undefined", StringComparison.OrdinalIgnoreCase) || id.Equals("null", StringComparison.OrdinalIgnoreCase))
        {
            return "";
        }
        return id.Replace("-", "").ToLowerInvariant();
    }

    private static string GetKey(string? userId, string itemId) => $"{NormalizeGuid(userId)}_{NormalizeGuid(itemId)}";

    /// <summary>
    /// Gets the mapping for a user and Jellyfin item.
    /// </summary>
    public JellyfinItemMapping? GetMapping(string userId, string itemId)
    {
        var key = GetKey(userId, itemId);
        if (_mappings.TryGetValue(key, out var mapping) && mapping != null)
        {
            _logger.LogInformation("[Aquila MappingStore] FOUND mapping for User={UserId}, Item={ItemId} -> AquilaId={AquilaId}",
                userId, itemId, mapping.AquilaMediaId);
            return mapping;
        }

        var normItem = NormalizeGuid(itemId);
        mapping = _mappings.Values.FirstOrDefault(m => NormalizeGuid(m.JellyfinItemId) == normItem);
        if (mapping != null)
        {
            _logger.LogInformation("[Aquila MappingStore] FOUND mapping via itemId fallback for User={UserId}, Item={ItemId} -> AquilaId={AquilaId}",
                userId, itemId, mapping.AquilaMediaId);
            return mapping;
        }

        _logger.LogInformation("[Aquila MappingStore] MISSING mapping for User={UserId}, Item={ItemId}", userId, itemId);
        return null;
    }

    /// <summary>
    /// Gets the mapping for a user by searching multiple candidate item IDs (SeriesId, SeasonId, ItemId).
    /// </summary>
    public JellyfinItemMapping? GetMappingForCandidateIds(string userId, IEnumerable<string> candidateIds)
    {
        var normUser = NormalizeGuid(userId);
        var normCandidates = candidateIds.Select(NormalizeGuid).Where(id => !string.IsNullOrEmpty(id)).ToList();

        foreach (var itemId in normCandidates)
        {
            var key = $"{normUser}_{itemId}";
            if (_mappings.TryGetValue(key, out var mapping) && mapping != null)
            {
                _logger.LogInformation("[Aquila MappingStore] FOUND candidate mapping for User={UserId}, MatchedItem={ItemId} -> AquilaId={AquilaId}",
                    userId, itemId, mapping.AquilaMediaId);
                return mapping;
            }
        }

        // Fallback: search by candidate itemId across all stored mappings
        foreach (var itemId in normCandidates)
        {
            var mapping = _mappings.Values.FirstOrDefault(m => NormalizeGuid(m.JellyfinItemId) == itemId);
            if (mapping != null)
            {
                _logger.LogInformation("[Aquila MappingStore] FOUND candidate mapping via itemId fallback: MatchedItem={ItemId} -> AquilaId={AquilaId}",
                    itemId, mapping.AquilaMediaId);
                return mapping;
            }
        }

        _logger.LogInformation("[Aquila MappingStore] MISSING mapping for User={UserId} across candidate IDs: {CandidateIds}",
            userId, string.Join(", ", candidateIds));
        return null;
    }

    /// <summary>
    /// Saves or updates a mapping with a list of ordered linked entries for a user.
    /// </summary>
    public async Task SetMappingAsync(string userId, string itemId, List<LinkedMediaEntry> entries)
    {
        var key = GetKey(userId, itemId);

        // Normalize order sequence (1-indexed)
        var orderedEntries = entries.Select((e, idx) => new LinkedMediaEntry
        {
            AquilaMediaId = e.AquilaMediaId,
            MediaType = e.MediaType,
            Order = idx + 1,
            MaxProgress = e.MaxProgress,
            DisplayTitle = e.DisplayTitle
        }).ToList();

        var first = orderedEntries.FirstOrDefault();

        var mapping = new JellyfinItemMapping
        {
            UserId = userId,
            JellyfinItemId = itemId,
            AquilaMediaId = first?.AquilaMediaId ?? 0,
            MediaType = first?.MediaType ?? string.Empty,
            LinkedAt = DateTime.UtcNow,
            Entries = orderedEntries
        };

        _mappings[key] = mapping;
        _logger.LogInformation("[Aquila MappingStore] SET mapping: User={UserId}, Item={ItemId} -> {Count} ordered entries",
            userId, itemId, orderedEntries.Count);
        await SaveAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Saves or updates a single mapping for backward compatibility.
    /// </summary>
    public async Task SetMappingAsync(string userId, string itemId, int aquilaMediaId, string mediaType)
    {
        var entries = new List<LinkedMediaEntry>
        {
            new LinkedMediaEntry
            {
                AquilaMediaId = aquilaMediaId,
                MediaType = mediaType,
                Order = 1
            }
        };
        await SetMappingAsync(userId, itemId, entries).ConfigureAwait(false);
    }

    /// <summary>
    /// Appends or updates a single entry in a user's ordered entries list for a Jellyfin item.
    /// </summary>
    public async Task AddOrUpdateEntryAsync(string userId, string itemId, LinkedMediaEntry entry)
    {
        var mapping = GetMapping(userId, itemId);
        var entries = mapping?.GetOrderedEntries() ?? new List<LinkedMediaEntry>();

        var existing = entries.FirstOrDefault(e => e.AquilaMediaId == entry.AquilaMediaId);
        if (existing != null)
        {
            existing.MediaType = !string.IsNullOrWhiteSpace(entry.MediaType) ? entry.MediaType : existing.MediaType;
            if (entry.MaxProgress.HasValue) existing.MaxProgress = entry.MaxProgress;
            if (!string.IsNullOrWhiteSpace(entry.DisplayTitle)) existing.DisplayTitle = entry.DisplayTitle;
        }
        else
        {
            entry.Order = entries.Count + 1;
            entries.Add(entry);
        }

        await SetMappingAsync(userId, itemId, entries).ConfigureAwait(false);
    }

    /// <summary>
    /// Removes a specific linked entry from a user's item mapping by Aquila Media ID.
    /// </summary>
    public async Task<bool> RemoveEntryAsync(string userId, string itemId, int aquilaMediaId)
    {
        var mapping = GetMapping(userId, itemId);
        if (mapping == null) return false;

        var entries = mapping.GetOrderedEntries();
        int removedCount = entries.RemoveAll(e => e.AquilaMediaId == aquilaMediaId);
        if (removedCount == 0) return false;

        if (entries.Count == 0)
        {
            await RemoveMappingAsync(userId, itemId).ConfigureAwait(false);
        }
        else
        {
            await SetMappingAsync(userId, itemId, entries).ConfigureAwait(false);
        }

        return true;
    }

    /// <summary>
    /// Reorders the linked entries for a user and Jellyfin item given an ordered list of Aquila Media IDs.
    /// </summary>
    public async Task<bool> ReorderEntriesAsync(string userId, string itemId, List<int> aquilaMediaIdsInOrder)
    {
        var mapping = GetMapping(userId, itemId);
        if (mapping == null) return false;

        var currentEntries = mapping.GetOrderedEntries();
        var entryMap = currentEntries.ToDictionary(e => e.AquilaMediaId);

        var newEntries = new List<LinkedMediaEntry>();
        foreach (var id in aquilaMediaIdsInOrder)
        {
            if (entryMap.TryGetValue(id, out var entry))
            {
                newEntries.Add(entry);
                entryMap.Remove(id);
            }
        }

        // Append any remaining entries that weren't specified in the order array
        foreach (var remaining in entryMap.Values)
        {
            newEntries.Add(remaining);
        }

        await SetMappingAsync(userId, itemId, newEntries).ConfigureAwait(false);
        return true;
    }

    /// <summary>
    /// Gets all item mappings, optionally filtered by user ID.
    /// </summary>
    public List<JellyfinItemMapping> GetAllMappings(string? userId = null)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return _mappings.Values.OrderByDescending(m => m.LinkedAt).ToList();
        }

        var normUser = NormalizeGuid(userId);
        return _mappings.Values
            .Where(m => NormalizeGuid(m.UserId) == normUser)
            .OrderByDescending(m => m.LinkedAt)
            .ToList();
    }

    /// <summary>
    /// Removes a specific mapping for a user and Jellyfin item (and optional candidate IDs).
    /// </summary>
    public async Task<bool> RemoveMappingAsync(string? userId, string itemId, IEnumerable<string>? candidateIds = null)
    {
        var normUser = NormalizeGuid(userId);
        var normItem = NormalizeGuid(itemId);

        var normCandidateSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrEmpty(normItem))
        {
            normCandidateSet.Add(normItem);
        }

        if (candidateIds != null)
        {
            foreach (var cand in candidateIds)
            {
                var normCand = NormalizeGuid(cand);
                if (!string.IsNullOrEmpty(normCand))
                {
                    normCandidateSet.Add(normCand);
                }
            }
        }

        var removed = false;

        // Try direct key removals if user is provided
        if (!string.IsNullOrEmpty(normUser))
        {
            foreach (var cand in normCandidateSet)
            {
                if (_mappings.TryRemove($"{normUser}_{cand}", out _))
                {
                    removed = true;
                }
            }
        }

        // Also remove all mappings matching any of the candidate item IDs (handling item fallback mappings and all user variations)
        var matchingKeys = _mappings.Where(kvp =>
            normCandidateSet.Contains(NormalizeGuid(kvp.Value.JellyfinItemId)) ||
            normCandidateSet.Contains(NormalizeGuid(kvp.Key.Split('_').LastOrDefault() ?? ""))
        ).Select(kvp => kvp.Key).ToList();

        foreach (var k in matchingKeys)
        {
            if (_mappings.TryRemove(k, out _))
            {
                removed = true;
            }
        }

        if (removed)
        {
            _logger.LogInformation("[Aquila MappingStore] REMOVED mapping: User={UserId}, Item={ItemId}, Candidates=[{CandidateIds}]",
                userId, itemId, string.Join(", ", normCandidateSet));
            await SaveAsync().ConfigureAwait(false);
        }
        else
        {
            _logger.LogInformation("[Aquila MappingStore] REMOVE skipped, mapping not found: User={UserId}, Item={ItemId}, Candidates=[{CandidateIds}]",
                userId, itemId, string.Join(", ", normCandidateSet));
        }

        return removed;
    }

    /// <summary>
    /// Removes all stored mappings, or all mappings for a specific user ID.
    /// </summary>
    public async Task<int> RemoveAllMappingsAsync(string? userId = null)
    {
        int removedCount = 0;
        if (string.IsNullOrWhiteSpace(userId))
        {
            removedCount = _mappings.Count;
            _mappings.Clear();
        }
        else
        {
            var normUser = NormalizeGuid(userId);
            var keysToRemove = _mappings
                .Where(kvp => NormalizeGuid(kvp.Value.UserId) == normUser)
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var key in keysToRemove)
            {
                if (_mappings.TryRemove(key, out _))
                {
                    removedCount++;
                }
            }
        }

        _logger.LogInformation("[Aquila MappingStore] REMOVED {Count} mappings for User={UserId}", removedCount, userId ?? "ALL");
        await SaveAsync().ConfigureAwait(false);
        return removedCount;
    }
}

