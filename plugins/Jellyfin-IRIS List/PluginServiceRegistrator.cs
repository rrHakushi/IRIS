using Jellyfin.Plugin.Iris.Api;
using Jellyfin.Plugin.Iris.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Iris;

/// <summary>
/// Registers plugin services in the Jellyfin dependency injection container.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<IrisApiClient>(client =>
        {
            client.Timeout = System.TimeSpan.FromSeconds(8);
        });
        serviceCollection.AddSingleton<MediaMappingStore>();
        serviceCollection.AddSingleton<IrisSyncManager>();
        serviceCollection.AddHostedService<PlaybackTracker>();
    }
}
