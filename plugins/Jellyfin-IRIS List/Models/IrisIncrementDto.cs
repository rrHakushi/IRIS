using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Models;

/// <summary>
/// DTO payload for scrobbling progress increments.
/// </summary>
public class IrisIncrementDto
{
    /// <summary>
    /// Gets or sets the media type ("anime" | "tv" | "movie").
    /// </summary>
    [JsonPropertyName("mediaType")]
    public string MediaType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Iris internal media ID.
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
