using Jellyfin.Plugin.Borealis.Api;
using Jellyfin.Plugin.Borealis.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.Borealis;

/// <summary>
/// Registers plugin services in the Jellyfin dependency injection container.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    /// <inheritdoc />
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<BorealisApiClient>(client =>
        {
            client.Timeout = System.TimeSpan.FromSeconds(8);
        });
        serviceCollection.AddSingleton<MediaMappingStore>();
        serviceCollection.AddSingleton<BorealisSyncManager>();
        serviceCollection.AddHostedService<PlaybackTracker>();
        serviceCollection.AddHostedService<WebInjectionService>();
    }
}
