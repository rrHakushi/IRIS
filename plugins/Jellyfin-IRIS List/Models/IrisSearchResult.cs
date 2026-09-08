using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Models;

/// <summary>
/// Media search result model from Iris API (/search/{type}?q=...).
/// </summary>
public class IrisSearchResult
{
    /// <summary>
    /// Gets or sets the internal Iris Media ID.
    /// </summary>
    [JsonPropertyName("id")]
    public int Id { get; set; }

    /// <summary>
    /// Gets or sets the primary title of the media.
    /// </summary>
    [JsonPropertyName("titlePrimary")]
    public string TitlePrimary { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the secondary/romaji title of the media.
    /// </summary>
    [JsonPropertyName("titleSecondary")]
    public string? TitleSecondary { get; set; }

    /// <summary>
    /// Gets or sets the native title of the media.
    /// </summary>
    [JsonPropertyName("titleNative")]
    public string? TitleNative { get; set; }

    /// <summary>
    /// Gets or sets the general display title.
    /// </summary>
    [JsonPropertyName("title")]
    public string Title
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(TitlePrimary)) return TitlePrimary;
            if (!string.IsNullOrWhiteSpace(TitleSecondary)) return TitleSecondary;
            if (!string.IsNullOrWhiteSpace(TitleNative)) return TitleNative;
            return string.Empty;
        }
        set
        {
            if (string.IsNullOrWhiteSpace(TitlePrimary))
            {
                TitlePrimary = value;
            }
        }
    }

    /// <summary>
    /// Gets or sets the cover image URL.
    /// </summary>
    [JsonPropertyName("coverImage")]
    public string? CoverImage { get; set; }

    /// <summary>
    /// Gets or sets the banner image URL.
    /// </summary>
    [JsonPropertyName("bannerImage")]
    public string? BannerImage { get; set; }

    /// <summary>
    /// Gets or sets total episode count (if available).
    /// </summary>
    [JsonPropertyName("episodeCount")]
    public int? EpisodeCount { get; set; }

    /// <summary>
    /// Gets or sets the media format (e.g. TV, MOVIE, ONA).
    /// </summary>
    [JsonPropertyName("format")]
    public string? Format { get; set; }

    /// <summary>
    /// Gets or sets the release year.
    /// </summary>
    [JsonPropertyName("releaseDateYear")]
    public int? ReleaseDateYear { get; set; }

    /// <summary>
    /// Gets or sets the anime season year.
    /// </summary>
    [JsonPropertyName("seasonYear")]
    public int? SeasonYear { get; set; }

    /// <summary>
    /// Gets or sets the resolved media type ("anime" | "tv" | "movie").
    /// </summary>
    [JsonPropertyName("resolvedType")]
    public string? ResolvedType { get; set; }
}
