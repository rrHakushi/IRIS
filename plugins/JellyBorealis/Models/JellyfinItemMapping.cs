using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Borealis.Models;

/// <summary>
/// Persisted map linking Jellyfin Item ID to Borealis Internal Media ID per user.
/// </summary>
public class JellyfinItemMapping
{
    /// <summary>
    /// Gets or sets the Jellyfin User ID.
    /// </summary>
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Jellyfin Item ID.
    /// </summary>
    [JsonPropertyName("jellyfinItemId")]
    public string JellyfinItemId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the internal Borealis Media ID.
    /// </summary>
    [JsonPropertyName("borealisMediaId")]
    public int BorealisMediaId { get; set; }

    /// <summary>
    /// Backward-compatible alias for BorealisMediaId.
    /// </summary>
    [JsonPropertyName("irisMediaId")]
    public int IrisMediaId
    {
        get => BorealisMediaId;
        set { if (value > 0 && BorealisMediaId == 0) BorealisMediaId = value; }
    }

    /// <summary>
    /// Backward-compatible alias for BorealisMediaId.
    /// </summary>
    [JsonPropertyName("aquilaMediaId")]
    public int AquilaMediaId
    {
        get => BorealisMediaId;
        set { if (value > 0 && BorealisMediaId == 0) BorealisMediaId = value; }
    }

    /// <summary>
    /// Gets or sets the mapped Media Type ("anime" | "tv" | "movies" | "movie").
    /// </summary>
    [JsonPropertyName("mediaType")]
    public string MediaType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the timestamp when the mapping was created.
    /// </summary>
    [JsonPropertyName("linkedAt")]
    public DateTime LinkedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets or sets the ordered list of linked media entries for this user and item.
    /// </summary>
    [JsonPropertyName("entries")]
    public List<LinkedMediaEntry> Entries { get; set; } = new();

    /// <summary>
    /// Gets the list of linked media entries sorted by sequence order.
    /// Falls back to a single entry created from BorealisMediaId for legacy mappings.
    /// </summary>
    public List<LinkedMediaEntry> GetOrderedEntries()
    {
        if (Entries != null && Entries.Count > 0)
        {
            return Entries.OrderBy(e => e.Order).ToList();
        }

        if (BorealisMediaId > 0)
        {
            return new List<LinkedMediaEntry>
            {
                new LinkedMediaEntry
                {
                    BorealisMediaId = BorealisMediaId,
                    MediaType = MediaType,
                    Order = 1
                }
            };
        }

        return new List<LinkedMediaEntry>();
    }
}
