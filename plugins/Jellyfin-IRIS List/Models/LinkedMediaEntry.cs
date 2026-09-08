using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Models;

/// <summary>
/// Represents a single linked media entry in an ordered sequence for a user and Jellyfin item.
/// </summary>
public class LinkedMediaEntry
{
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
    /// Gets or sets the sequence order (1-indexed).
    /// </summary>
    [JsonPropertyName("order")]
    public int Order { get; set; } = 1;

    /// <summary>
    /// Gets or sets the maximum progress / total episode count for this entry (if known).
    /// </summary>
    [JsonPropertyName("maxProgress")]
    public int? MaxProgress { get; set; }

    /// <summary>
    /// Gets or sets the display title for UI rendering.
    /// </summary>
    [JsonPropertyName("displayTitle")]
    public string DisplayTitle { get; set; } = string.Empty;
}
