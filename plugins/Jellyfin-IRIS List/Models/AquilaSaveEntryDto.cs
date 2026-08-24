using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Aquila.Models;

/// <summary>
/// DTO payload for saving/upserting list entries in Aquila.
/// </summary>
public class AquilaSaveEntryDto
{
    /// <summary>
    /// Gets or sets the Anime ID (for anime).
    /// </summary>
    [JsonPropertyName("animeId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? AnimeId { get; set; }

    /// <summary>
    /// Gets or sets the TV ID (for tv).
    /// </summary>
    [JsonPropertyName("tvId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? TvId { get; set; }

    /// <summary>
    /// Gets or sets the Movie ID (for movie).
    /// </summary>
    [JsonPropertyName("movieId")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MovieId { get; set; }

    /// <summary>
    /// Gets or sets the List Status (WATCHING, COMPLETED, PAUSED, DROPPED, PLANNING, REWATCHING).
    /// </summary>
    [JsonPropertyName("status")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Status { get; set; }

    /// <summary>
    /// Gets or sets the episode/item progress count.
    /// </summary>
    [JsonPropertyName("progress")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Progress { get; set; }

    /// <summary>
    /// Gets or sets the rating score (1-10).
    /// </summary>
    [JsonPropertyName("score")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? Score { get; set; }

    /// <summary>
    /// Gets or sets personal user notes.
    /// </summary>
    [JsonPropertyName("notes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Notes { get; set; }

    /// <summary>
    /// Gets or sets start date (Unix timestamp in seconds).
    /// </summary>
    [JsonPropertyName("startDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? StartDate { get; set; }

    /// <summary>
    /// Gets or sets end date (Unix timestamp in seconds).
    /// </summary>
    [JsonPropertyName("endDate")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? EndDate { get; set; }

    /// <summary>
    /// Gets or sets the rewatched count.
    /// </summary>
    [JsonPropertyName("rewatched")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Rewatched { get; set; }
}
