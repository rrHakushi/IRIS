using System;
using System.Collections.Generic;
using System.Globalization;
using Jellyfin.Plugin.Aquila.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.Aquila;

/// <summary>
/// The Aquila Jellyfin Plugin main registration.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Instance of the <see cref="IApplicationPaths"/> interface.</param>
    /// <param name="xmlSerializer">Instance of the <see cref="IXmlSerializer"/> interface.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <inheritdoc />
    public override string Name => "Aquila";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("f9a4c810-7213-4d43-9821-2e65d8a9b12d");

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Configuration.configPage.html", GetType().Namespace)
            },
            new PluginPageInfo
            {
                Name = "aquila-web-injection.js",
                EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Web.aquila-web-injection.js", GetType().Namespace)
            },
            new PluginPageInfo
            {
                Name = "aquila-modal.css",
                EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Web.aquila-modal.css", GetType().Namespace)
            }
        };
    }
}
