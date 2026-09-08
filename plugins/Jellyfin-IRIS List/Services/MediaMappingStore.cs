using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Iris.Models;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Services;

/// <summary>
/// Thread-safe local storage manager for Jellyfin Item ID -> Iris Media ID mappings.
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
        var dataFolder = Path.Combine(applicationPaths.PluginConfigurationsPath, "Iris");
        Directory.CreateDirectory(dataFolder);
        _filePath = Path.Combine(dataFolder, "item-mappings.json");
        _logger.LogInformation("[Iris MappingStore] Storage path: {FilePath}", _filePath);
        Load(applicationPaths);
    }

    private void Load(IApplicationPaths applicationPaths)
    {
        try
        {
            string fileToRead = _filePath;
            if (!File.Exists(fileToRead))
            {
                // Check legacy Aquila folder for migration
                var legacyPath = Path.Combine(applicationPaths.PluginConfigurationsPath, "Aquila", "item-mappings.json");
                if (File.Exists(legacyPath))
                {
                    fileToRead = legacyPath;
                    _logger.LogInformation("[Iris MappingStore] Migrating existing mappings from legacy Aquila folder: {LegacyPath}", legacyPath);
                }
            }

            if (File.Exists(fileToRead))
            {
                var json = File.ReadAllText(fileToRead);
                var items = JsonSerializer.Deserialize<List<JellyfinItemMapping>>(json);
                if (items != null)
                {
                    foreach (var item in items)
                    {
                        var key = GetKey(item.UserId, item.JellyfinItemId);
                        _mappings[key] = item;
                    }
                }
                _logger.LogInformation("[Iris MappingStore] Loaded {Count} mappings from storage.", _mappings.Count);

                // If read from legacy path, persist immediately to Iris path
                if (fileToRead != _filePath)
                {
                    _ = SaveAsync();
                }
            }
            else
            {
                _logger.LogInformation("[Iris MappingStore] No existing mappings file found at {FilePath}. Starting empty.", _filePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Iris MappingStore] Failed to load Iris item mappings from {FilePath}", _filePath);
        }
    }

    private async Task SaveAsync()
    {
        try
        {
            var list = _mappings.Values.ToList();
            var json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
            await File.WriteAllTextAsync(_filePath, json).ConfigureAwait(false);
            _logger.LogInformation("[Iris MappingStore] Saved {Count} item mappings to disk.", list.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Iris MappingStore] Failed to save Iris item mappings to {FilePath}", _filePath);
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
            _logger.LogInformation("[Iris MappingStore] FOUND mapping for User={UserId}, Item={ItemId} -> IrisId={IrisId}",
                userId, itemId, mapping.IrisMediaId);
            return mapping;
        }

        var globalKey = GetKey(null, itemId);
        if (_mappings.TryGetValue(globalKey, out var globalMapping) && globalMapping != null)
        {
            _logger.LogInformation("[Iris MappingStore] FOUND global fallback mapping for Item={ItemId} -> IrisId={IrisId}",
                itemId, globalMapping.IrisMediaId);
            return globalMapping;
        }

        return null;
    }

    /// <summary>
    /// Attempts to find an item mapping matching the user and any of the candidate IDs (e.g. EpisodeId -> SeasonId -> SeriesId).
    /// </summary>
    public JellyfinItemMapping? GetMappingForCandidateIds(string userId, IEnumerable<string> candidateIds)
    {
        if (candidateIds == null) return null;

        var list = candidateIds.Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
        foreach (var id in list)
        {
            var mapping = GetMapping(userId, id);
            if (mapping != null)
            {
                _logger.LogInformation("[Iris MappingStore] Resolved candidate ID '{CandidateId}' -> IrisId {IrisId}", id, mapping.IrisMediaId);
                return mapping;
            }
        }

        return null;
    }

    /// <summary>
    /// Persists or updates a mapping for a user and Jellyfin item to a single Iris Media ID.
    /// </summary>
    public async Task SetMappingAsync(string userId, string itemId, int irisMediaId, string mediaType)
    {
        var key = GetKey(userId, itemId);
        var mapping = new JellyfinItemMapping
        {
            UserId = userId ?? string.Empty,
            JellyfinItemId = itemId,
            IrisMediaId = irisMediaId,
            MediaType = mediaType,
            LinkedAt = DateTime.UtcNow,
            Entries = new List<LinkedMediaEntry>
            {
                new LinkedMediaEntry
                {
                    IrisMediaId = irisMediaId,
                    MediaType = mediaType,
                    Order = 1
                }
            }
        };

        _mappings[key] = mapping;
        await SaveAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Persists an ordered list of linked media entries for a user and Jellyfin item.
    /// </summary>
    public async Task SetMappingAsync(string userId, string itemId, List<LinkedMediaEntry> entries)
    {
        var key = GetKey(userId, itemId);
        var first = entries.FirstOrDefault();
        var mapping = new JellyfinItemMapping
        {
            UserId = userId ?? string.Empty,
            JellyfinItemId = itemId,
            IrisMediaId = first?.IrisMediaId ?? 0,
            MediaType = first?.MediaType ?? "tv",
            LinkedAt = DateTime.UtcNow,
            Entries = entries.OrderBy(e => e.Order).ToList()
        };

        _mappings[key] = mapping;
        await SaveAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Adds or updates a single entry in a user's ordered entries list for a Jellyfin item.
    /// </summary>
    public async Task AddOrUpdateEntryAsync(string userId, string itemId, LinkedMediaEntry entry)
    {
        var mapping = GetMapping(userId, itemId) ?? new JellyfinItemMapping
        {
            UserId = userId ?? string.Empty,
            JellyfinItemId = itemId,
            IrisMediaId = entry.IrisMediaId,
            MediaType = entry.MediaType,
            LinkedAt = DateTime.UtcNow
        };

        var existing = mapping.Entries.FirstOrDefault(e => e.IrisMediaId == entry.IrisMediaId);
        if (existing != null)
        {
            existing.DisplayTitle = entry.DisplayTitle;
            existing.MaxProgress = entry.MaxProgress;
            existing.MediaType = entry.MediaType;
            if (entry.Order > 0) existing.Order = entry.Order;
        }
        else
        {
            if (entry.Order <= 0)
            {
                entry.Order = mapping.Entries.Count > 0 ? mapping.Entries.Max(e => e.Order) + 1 : 1;
            }
            mapping.Entries.Add(entry);
        }

        mapping.Entries = mapping.Entries.OrderBy(e => e.Order).ToList();
        for (int i = 0; i < mapping.Entries.Count; i++)
        {
            mapping.Entries[i].Order = i + 1;
        }

        if (mapping.Entries.Count > 0)
        {
            mapping.IrisMediaId = mapping.Entries[0].IrisMediaId;
            mapping.MediaType = mapping.Entries[0].MediaType;
        }

        var key = GetKey(userId, itemId);
        _mappings[key] = mapping;
        await SaveAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Removes a specific entry by Iris Media ID from a user's item mapping.
    /// </summary>
    public async Task<bool> RemoveEntryAsync(string userId, string itemId, int irisMediaId)
    {
        var mapping = GetMapping(userId, itemId);
        if (mapping == null) return false;

        var removed = mapping.Entries.RemoveAll(e => e.IrisMediaId == irisMediaId) > 0;
        if (removed)
        {
            for (int i = 0; i < mapping.Entries.Count; i++)
            {
                mapping.Entries[i].Order = i + 1;
            }

            if (mapping.Entries.Count > 0)
            {
                mapping.IrisMediaId = mapping.Entries[0].IrisMediaId;
                mapping.MediaType = mapping.Entries[0].MediaType;
            }
            else
            {
                mapping.IrisMediaId = 0;
            }

            var key = GetKey(userId, itemId);
            _mappings[key] = mapping;
            await SaveAsync().ConfigureAwait(false);
        }

        return removed;
    }

    /// <summary>
    /// Reorders the entries list for a user and Jellyfin item based on an array of Iris Media IDs in desired order.
    /// </summary>
    public async Task<bool> ReorderEntriesAsync(string userId, string itemId, List<int> irisMediaIdsInOrder)
    {
        var mapping = GetMapping(userId, itemId);
        if (mapping == null || mapping.Entries.Count == 0) return false;

        var newEntries = new List<LinkedMediaEntry>();
        int order = 1;

        foreach (var id in irisMediaIdsInOrder)
        {
            var match = mapping.Entries.FirstOrDefault(e => e.IrisMediaId == id);
            if (match != null)
            {
                match.Order = order++;
                newEntries.Add(match);
            }
        }

        foreach (var remaining in mapping.Entries.Where(e => !irisMediaIdsInOrder.Contains(e.IrisMediaId)))
        {
            remaining.Order = order++;
            newEntries.Add(remaining);
        }

        mapping.Entries = newEntries;
        if (mapping.Entries.Count > 0)
        {
            mapping.IrisMediaId = mapping.Entries[0].IrisMediaId;
            mapping.MediaType = mapping.Entries[0].MediaType;
        }

        var key = GetKey(userId, itemId);
        _mappings[key] = mapping;
        await SaveAsync().ConfigureAwait(false);
        return true;
    }

    /// <summary>
    /// Removes a mapping for a user and Jellyfin item (with optional candidate IDs).
    /// </summary>
    public async Task<bool> RemoveMappingAsync(string? userId, string itemId, IEnumerable<string>? candidateIds = null)
    {
        bool anyRemoved = false;
        var keysToCheck = new List<string>
        {
            GetKey(userId, itemId),
            GetKey(null, itemId)
        };

        if (candidateIds != null)
        {
            foreach (var cand in candidateIds)
            {
                if (!string.IsNullOrWhiteSpace(cand))
                {
                    keysToCheck.Add(GetKey(userId, cand));
                    keysToCheck.Add(GetKey(null, cand));
                }
            }
        }

        foreach (var key in keysToCheck)
        {
            if (_mappings.TryRemove(key, out _))
            {
                anyRemoved = true;
                _logger.LogInformation("[Iris MappingStore] Removed mapping for key: {Key}", key);
            }
        }

        if (anyRemoved)
        {
            await SaveAsync().ConfigureAwait(false);
        }
        return anyRemoved;
    }

    /// <summary>
    /// Returns all saved item mappings (optionally filtered by user ID).
    /// </summary>
    public List<JellyfinItemMapping> GetAllMappings(string? userId = null)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return _mappings.Values.ToList();
        }

        return _mappings.Values
            .Where(m => string.Equals(NormalizeGuid(m.UserId), NormalizeGuid(userId), StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    /// <summary>
    /// Removes all saved item mappings.
    /// </summary>
    public async Task<int> RemoveAllMappingsAsync(string? userId = null)
    {
        int count;
        if (string.IsNullOrWhiteSpace(userId))
        {
            count = _mappings.Count;
            _mappings.Clear();
        }
        else
        {
            var keysToRemove = _mappings
                .Where(kvp => string.Equals(NormalizeGuid(kvp.Value.UserId), NormalizeGuid(userId), StringComparison.OrdinalIgnoreCase))
                .Select(kvp => kvp.Key)
                .ToList();

            count = keysToRemove.Count;
            foreach (var key in keysToRemove)
            {
                _mappings.TryRemove(key, out _);
            }
        }

        await SaveAsync().ConfigureAwait(false);
        _logger.LogInformation("[Iris MappingStore] Cleared {Count} item mappings (UserId: {UserId}).", count, userId ?? "ALL");
        return count;
    }
}
