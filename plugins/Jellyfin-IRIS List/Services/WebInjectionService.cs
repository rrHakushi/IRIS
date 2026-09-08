using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Services;

/// <summary>
/// Service that automatically injects the Iris web script into Jellyfin Server's index.html files on server start.
/// </summary>
public class WebInjectionService : IHostedService
{
    private readonly IApplicationPaths _applicationPaths;
    private readonly ILogger<WebInjectionService> _logger;
    private const string ScriptTag = "<script id=\"iris-web-script\" src=\"/Iris/WebInjection.js?v=2.0.0\" defer></script>";

    /// <summary>
    /// Initializes a new instance of the <see cref="WebInjectionService"/> class.
    /// </summary>
    public WebInjectionService(IApplicationPaths applicationPaths, ILogger<WebInjectionService> logger)
    {
        _applicationPaths = applicationPaths;
        _logger = logger;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var candidatePaths = new[]
            {
                Path.Combine(_applicationPaths.WebPath ?? string.Empty, "index.html"),
                Path.Combine(_applicationPaths.WebPath ?? string.Empty, "web", "index.html"),
                Path.Combine(_applicationPaths.WebPath ?? string.Empty, "dist", "index.html"),
                Path.Combine(AppContext.BaseDirectory, "jellyfin-web", "index.html")
            };

            foreach (var indexPath in candidatePaths)
            {
                if (string.IsNullOrWhiteSpace(indexPath) || !File.Exists(indexPath))
                {
                    continue;
                }

                _logger.LogInformation("[Iris Plugin] Checking index.html at '{IndexPath}'", indexPath);
                var html = File.ReadAllText(indexPath);
                if (html.Contains("iris-web-script", StringComparison.OrdinalIgnoreCase) || html.Contains("aquila-web-script", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("[Iris Plugin] Updating existing script tag in '{IndexPath}'", indexPath);
                    var regex = new System.Text.RegularExpressions.Regex(@"<script id=""(?:iris|aquila)-web-script"".*?</script>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    html = regex.Replace(html, ScriptTag);
                    File.WriteAllText(indexPath, html);
                }
                else
                {
                    _logger.LogInformation("[Iris Plugin] Injecting script tag into '{IndexPath}'", indexPath);
                    var bodyEndIndex = html.IndexOf("</body>", StringComparison.OrdinalIgnoreCase);
                    if (bodyEndIndex != -1)
                    {
                        html = html.Insert(bodyEndIndex, $"{ScriptTag}\n");
                    }
                    else
                    {
                        html += $"\n{ScriptTag}";
                    }
                    File.WriteAllText(indexPath, html);
                    _logger.LogInformation("[Iris Plugin] Successfully injected /Iris/WebInjection.js script tag into '{IndexPath}'.", indexPath);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Iris Plugin] Error injecting web script into physical index.html files.");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
