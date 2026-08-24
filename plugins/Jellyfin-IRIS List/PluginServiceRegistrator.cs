using Jellyfin.Plugin.Aquila.Api;
using Jellyfin.Plugin.Aquila.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Aquila;

/// <summary>
/// Service registrator for dependency injection in Jellyfin.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<MediaMappingStore>();
        serviceCollection.AddHttpClient<AquilaApiClient>();
        serviceCollection.AddSingleton<AquilaSyncManager>();
        serviceCollection.AddHostedService<PlaybackTracker>();
        serviceCollection.AddHostedService<WebInjectionService>();
    }
}
