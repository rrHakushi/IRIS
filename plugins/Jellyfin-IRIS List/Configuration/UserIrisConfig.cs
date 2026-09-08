using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.Iris.Configuration;

/// <summary>
/// User specific Iris API configuration.
/// </summary>
public class UserIrisConfig
{
    /// <summary>
    /// Gets or sets the Jellyfin User ID.
    /// </summary>
    public string JellyfinUserId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Iris API Key (x-api-key).
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the base Iris API Endpoint URL.
    /// </summary>
    public string IrisServerUrl { get; set; } = string.Empty;

    /// <summary>
    /// Backward-compatible alias for IrisServerUrl.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AquilaServerUrl
    {
        get => IrisServerUrl;
        set { if (!string.IsNullOrWhiteSpace(value) && string.IsNullOrWhiteSpace(IrisServerUrl)) IrisServerUrl = value; }
    }

    /// <summary>
    /// Gets or sets the cached username resolved via /users/me with the API key.
    /// </summary>
    public string? CachedUsername { get; set; }

    /// <summary>
    /// Gets or sets the default fallback scrobble threshold percentage (0-100). Default is 90.
    /// </summary>
    public double CompletionThreshold { get; set; } = 90.0;
}
