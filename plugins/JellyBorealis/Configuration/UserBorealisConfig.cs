namespace Jellyfin.Plugin.Borealis.Configuration;

/// <summary>
/// User specific Borealis API configuration.
/// </summary>
public class UserBorealisConfig
{
    /// <summary>
    /// Gets or sets the Jellyfin User ID.
    /// </summary>
    public string JellyfinUserId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Borealis API Key (x-api-key).
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the base Borealis API Endpoint URL.
    /// </summary>
    public string BorealisServerUrl { get; set; } = "http://localhost:4000";

    /// <summary>
    /// Gets or sets the cached username resolved via /carina/users/me with the API key.
    /// </summary>
    public string? CachedUsername { get; set; }

    /// <summary>
    /// Gets or sets the default fallback scrobble threshold percentage (0-100). Default is 90.
    /// </summary>
    public double CompletionThreshold { get; set; } = 90.0;
}
