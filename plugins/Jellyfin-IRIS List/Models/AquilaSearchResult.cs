using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Aquila.Models;

/// <summary>
/// Media search result model from Aquila API.
/// </summary>
public class AquilaSearchResult
{
    /// <summary>
    /// Gets or sets the internal Aquila Media ID.
    /// </summary>
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the title of the media.
    /// </summary>
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the cover image URL.
    /// </summary>
    [JsonPropertyName("coverImage")]
    public string? CoverImage { get; set; }

    /// <summary>
    /// Gets or sets total episode count (if available).
    /// </summary>
    [JsonPropertyName("episodes")]
    public int? Episodes { get; set; }
}
