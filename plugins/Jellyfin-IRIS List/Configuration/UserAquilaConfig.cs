namespace Jellyfin.Plugin.Aquila.Configuration;

/// <summary>
/// User specific Aquila API configuration.
/// </summary>
public class UserAquilaConfig
{
    /// <summary>
    /// Gets or sets the Jellyfin User ID.
    /// </summary>
    public string JellyfinUserId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Aquila API Key (x-api-key).
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the base Aquila API Endpoint URL.
    /// </summary>
    public string AquilaServerUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the scrobble threshold percentage (0-100). Default is 90.
    /// </summary>
    public double CompletionThreshold { get; set; } = 90.0;
}
