using System;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Models;

/// <summary>
/// DTO payload for saving/upserting list entries in Iris (PUT /user/{username}/lists/{mediaType}/{id}).
/// </summary>
public class IrisSaveEntryDto
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
    /// Gets or sets the List Status (WATCHING, COMPLETED, ON_HOLD, DROPPED, PLANNING).
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
    /// Gets or sets the rating score (0-10).
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
    /// Gets or sets whether this entry is private.
    /// </summary>
    [JsonPropertyName("private")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? Private { get; set; }

    /// <summary>
    /// Gets or sets start date as ISO 8601 string.
    /// </summary>
    [JsonPropertyName("startedAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? StartedAt { get; set; }

    /// <summary>
    /// Gets or sets completion date as ISO 8601 string.
    /// </summary>
    [JsonPropertyName("completedAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CompletedAt { get; set; }

    /// <summary>
    /// Gets or sets the rewatched count.
    /// </summary>
    [JsonPropertyName("rewatched")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Rewatched { get; set; }

    /// <summary>
    /// Gets or sets the rewatch history.
    /// </summary>
    [JsonPropertyName("rewatchHistory")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? RewatchHistory { get; set; }

    /// <summary>
    /// Gets or sets TV season progress records.
    /// </summary>
    [JsonPropertyName("seasons")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Seasons { get; set; }

    /// <summary>
    /// Gets or sets watched episodes list.
    /// </summary>
    [JsonPropertyName("watchedEpisodes")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? WatchedEpisodes { get; set; }

    /// <summary>
    /// Normalizes startDate unix seconds or ISO string into StartedAt.
    /// </summary>
    [JsonPropertyName("startDate")]
    public object? StartDate
    {
        get => null;
        set => StartedAt = NormalizeToIso(value) ?? StartedAt;
    }

    /// <summary>
    /// Normalizes endDate unix seconds or ISO string into CompletedAt.
    /// </summary>
    [JsonPropertyName("endDate")]
    public object? EndDate
    {
        get => null;
        set => CompletedAt = NormalizeToIso(value) ?? CompletedAt;
    }

    private static string? NormalizeToIso(object? val)
    {
        if (val == null) return null;
        if (val is string str && !string.IsNullOrWhiteSpace(str))
        {
            if (DateTime.TryParse(str, out var dt))
            {
                return dt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            }
            if (long.TryParse(str, out var num))
            {
                return NormalizeUnixToIso(num);
            }
            return str;
        }
        if (val is System.Text.Json.JsonElement elem)
        {
            if (elem.ValueKind == System.Text.Json.JsonValueKind.Number && elem.TryGetInt64(out var num))
            {
                return NormalizeUnixToIso(num);
            }
            if (elem.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                return NormalizeToIso(elem.GetString());
            }
        }
        if (val is long l) return NormalizeUnixToIso(l);
        if (val is int i) return NormalizeUnixToIso(i);
        if (val is double d) return NormalizeUnixToIso((long)d);
        return null;
    }

    private static string NormalizeUnixToIso(long seconds)
    {
        var epoch = DateTimeOffset.FromUnixTimeSeconds(seconds > 100000000000 ? seconds / 1000 : seconds);
        return epoch.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    }
}
