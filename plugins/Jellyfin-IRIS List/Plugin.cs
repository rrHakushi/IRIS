using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Reflection;
using Jellyfin.Plugin.Iris.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Iris;

/// <summary>
/// Main Iris Jellyfin plugin class.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "Iris";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("f9a4c810-7213-4d43-9821-2e65d8a9b12d");

    /// <inheritdoc />
    public override string Description => "Integrates Jellyfin with Iris media tracking platform.";

    /// <summary>
    /// Gets the embedded thumbnail image stream.
    /// </summary>
    public Stream GetThumbImageStream()
    {
        var assembly = Assembly.GetExecutingAssembly();
        return assembly.GetManifestResourceStream("Jellyfin.Plugin.Iris.thumb.png")
            ?? new MemoryStream();
    }

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = this.Name,
                EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Configuration.configPage.html", GetType().Namespace)
            }
        };
    }
}
