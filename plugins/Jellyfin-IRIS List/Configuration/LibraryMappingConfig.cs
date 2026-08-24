namespace Jellyfin.Plugin.Aquila.Configuration;

/// <summary>
/// Mapping configuration for Jellyfin Library to Aquila Media Type.
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
    /// Gets or sets the Aquila Media Type ("anime", "tv", "movie").
    /// </summary>
    public string MediaType { get; set; } = "tv";
}
