using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Models;

/// <summary>
/// Persisted map linking Jellyfin Item ID to Iris Internal Media ID per user.
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
    /// Gets or sets the internal Iris Media ID.
    /// </summary>
    [JsonPropertyName("irisMediaId")]
    public int IrisMediaId { get; set; }

    /// <summary>
    /// Backward-compatible alias for IrisMediaId.
    /// </summary>
    [JsonPropertyName("aquilaMediaId")]
    public int AquilaMediaId
    {
        get => IrisMediaId;
        set { if (value > 0 && IrisMediaId == 0) IrisMediaId = value; }
    }

    /// <summary>
    /// Gets or sets the mapped Media Type ("anime" | "tv" | "movie").
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
    /// Falls back to a single entry created from IrisMediaId for legacy mappings.
    /// </summary>
    public List<LinkedMediaEntry> GetOrderedEntries()
    {
        if (Entries != null && Entries.Count > 0)
        {
            return Entries.OrderBy(e => e.Order).ToList();
        }

        if (IrisMediaId > 0)
        {
            return new List<LinkedMediaEntry>
            {
                new LinkedMediaEntry
                {
                    IrisMediaId = IrisMediaId,
                    MediaType = MediaType,
                    Order = 1
                }
            };
        }

        return new List<LinkedMediaEntry>();
    }
}
