using System.Collections.Generic;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.Borealis.Configuration;

/// <summary>
/// Plugin configuration storing Admin Library mappings and User API configurations.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        LibraryMappings = new List<LibraryMappingConfig>();
        UserConfigs = new List<UserBorealisConfig>();
    }

    /// <summary>
    /// Gets or sets the Admin Library Media Type mappings.
    /// </summary>
    public List<LibraryMappingConfig> LibraryMappings { get; set; }

    /// <summary>
    /// Gets or sets per-user Borealis configurations.
    /// </summary>
    public List<UserBorealisConfig> UserConfigs { get; set; }
}
