using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Aquila.Models;

/// <summary>
/// DTO payload for POST /list/increment.
/// </summary>
public class AquilaIncrementDto
{
    /// <summary>
    /// Gets or sets the media type ("anime" | "tv" | "movie").
    /// </summary>
    [JsonPropertyName("mediaType")]
    public string MediaType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Aquila internal media ID.
    /// </summary>
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the increment count (default 1).
    /// </summary>
    [JsonPropertyName("count")]
    public int Count { get; set; } = 1;
}
