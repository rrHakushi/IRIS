using System;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Aquila.Models;

/// <summary>
/// Persisted map linking Jellyfin Item ID to Aquila Internal Media ID per user.
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
    /// Gets or sets the internal Aquila Media ID.
    /// </summary>
    [JsonPropertyName("aquilaMediaId")]
    public int AquilaMediaId { get; set; }

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
    public System.Collections.Generic.List<LinkedMediaEntry> Entries { get; set; } = new();

    /// <summary>
    /// Gets the list of linked media entries sorted by sequence order.
    /// Falls back to a single entry created from AquilaMediaId for legacy mappings.
    /// </summary>
    public System.Collections.Generic.List<LinkedMediaEntry> GetOrderedEntries()
    {
        if (Entries != null && Entries.Count > 0)
        {
            return System.Linq.Enumerable.ToList(System.Linq.Enumerable.OrderBy(Entries, e => e.Order));
        }

        if (AquilaMediaId > 0)
        {
            return new System.Collections.Generic.List<LinkedMediaEntry>
            {
                new LinkedMediaEntry
                {
                    AquilaMediaId = AquilaMediaId,
                    MediaType = MediaType,
                    Order = 1
                }
            };
        }

        return new System.Collections.Generic.List<LinkedMediaEntry>();
    }
}
