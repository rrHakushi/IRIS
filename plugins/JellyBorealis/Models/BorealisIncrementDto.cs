using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Borealis.Models;

/// <summary>
/// DTO payload for scrobbling progress increments.
/// </summary>
public class BorealisIncrementDto
{
    /// <summary>
    /// Gets or sets the media type ("anime" | "tv" | "movies" | "movie").
    /// </summary>
    [JsonPropertyName("mediaType")]
    public string MediaType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Borealis internal media ID.
    /// </summary>
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the increment count (default 1).
    /// </summary>
    [JsonPropertyName("count")]
    public int Count { get; set; } = 1;

    /// <summary>
    /// Gets or sets TV increment type ("EPISODE" | "SEASON").
    /// </summary>
    [JsonPropertyName("type")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Type { get; set; }
}
