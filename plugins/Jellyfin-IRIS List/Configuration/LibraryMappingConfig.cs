namespace Jellyfin.Plugin.Iris.Configuration;

/// <summary>
/// Mapping configuration for Jellyfin Library to Iris Media Type with independent scrobble threshold.
/// </summary>
public class LibraryMappingConfig
{
    /// <summary>
    /// Gets or sets the Jellyfin Library ID.
    /// </summary>
    public string LibraryId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Jellyfin Library Name.
    /// </summary>
    public string LibraryName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Iris Media Type ("anime", "tv", "movie").
    /// </summary>
    public string MediaType { get; set; } = "tv";

    /// <summary>
    /// Gets or sets the independent scrobble completion threshold percentage (0-100). Default is 90.0.
    /// </summary>
    public double ScrobbleThreshold { get; set; } = 90.0;
}
