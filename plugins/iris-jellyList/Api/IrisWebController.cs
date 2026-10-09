using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Jellyfin.Plugin.Iris.Configuration;
using Jellyfin.Plugin.Iris.Models;
using Jellyfin.Plugin.Iris.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Api;

/// <summary>
/// REST API controller serving Iris web injection script, CSS, icon, and API proxy endpoints.
/// </summary>
[ApiController]
[Route("Iris")]
[Route("api/Iris")]
[Route("Plugins/Iris")]
[Route("Aquila")]
[Route("api/Aquila")]
[Route("Plugins/Aquila")]
public class IrisWebController : ControllerBase
{
    private readonly IrisApiClient _apiClient;
    private readonly MediaMappingStore _mappingStore;
    private readonly IrisSyncManager _syncManager;
    private readonly ILogger<IrisWebController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="IrisWebController"/> class.
    /// </summary>
    public IrisWebController(IrisApiClient apiClient, MediaMappingStore mappingStore, IrisSyncManager syncManager, ILogger<IrisWebController> logger)
    {
        _apiClient = apiClient;
        _mappingStore = mappingStore;
        _syncManager = syncManager;
        _logger = logger;
    }

    /// <summary>
    /// Serves iris-web-injection.js with application/javascript content type and no-cache headers.
    /// </summary>
    [HttpGet("iris-client.js")]
    [HttpGet("aquila-client.js")]
    [HttpGet("WebInjection.js")]
    [Produces("application/javascript")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetWebInjectionScript()
    {
        _logger.LogInformation("[Iris WebController] Serving WebInjection.js");
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.Iris.Web.iris-web-injection.js");
        if (stream == null)
        {
            _logger.LogError("[Iris WebController] ERROR: iris-web-injection.js manifest stream is null.");
            return NotFound("// Iris injection script resource not found.");
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var js = reader.ReadToEnd();
        return Content(js, "application/javascript", Encoding.UTF8);
    }

    /// <summary>
    /// Serves iris-modal.css with text/css content type and no-cache headers.
    /// </summary>
    [HttpGet("Modal.css")]
    [Produces("text/css")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetModalCss()
    {
        _logger.LogInformation("[Iris WebController] Serving Modal.css");
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.Iris.Web.iris-modal.css");
        if (stream == null)
        {
            _logger.LogError("[Iris WebController] ERROR: iris-modal.css manifest stream is null.");
            return NotFound("/* Iris modal css resource not found. */");
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var css = reader.ReadToEnd();
        return Content(css, "text/css", Encoding.UTF8);
    }

    /// <summary>
    /// Serves the bundled Iris icon.
    /// </summary>
    [HttpGet("Icon.png")]
    [HttpGet("thumb.png")]
    [Produces("image/png")]
    [AllowAnonymous]
    public IActionResult GetIcon()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.Iris.thumb.png");
        if (stream == null)
        {
            return NotFound();
        }

        return File(stream, "image/png");
    }

    private static UserIrisConfig? GetCurrentUserConfig(string? userId = null)
    {
        var config = Plugin.Instance?.Configuration;
        if (config == null || config.UserConfigs == null) return null;

        if (!string.IsNullOrWhiteSpace(userId))
        {
            var userMatch = config.UserConfigs.FirstOrDefault(u => u.JellyfinUserId == userId);
            if (userMatch != null && !string.IsNullOrWhiteSpace(userMatch.ApiKey))
            {
                return userMatch;
            }
        }

        return config.UserConfigs.FirstOrDefault(u => !string.IsNullOrWhiteSpace(u.ApiKey))
            ?? config.UserConfigs.FirstOrDefault();
    }

    /// <summary>
    /// Proxies search requests to Iris API from server side to bypass CORS.
    /// </summary>
    [HttpGet("Api/Search")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxySearch([FromQuery] string mediaType, [FromQuery] string query, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured in Jellyfin Plugin Settings." });
        }

        var results = await _apiClient.SearchMediaAsync(mediaType, query, userConfig.ApiKey, userConfig.IrisServerUrl).ConfigureAwait(false);
        return Ok(results);
    }

    /// <summary>
    /// Proxies media details request to Iris API (/media/{anime|tv|movies}/{id}).
    /// </summary>
    [HttpGet("Api/Details")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetDetails([FromQuery] string mediaType, [FromQuery] int id, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        var details = await _apiClient.GetMediaDetailsAsync(mediaType, id, userConfig.ApiKey, userConfig.IrisServerUrl).ConfigureAwait(false);
        if (!details.HasValue) return NotFound(new { message = "Media details not found" });

        return Content(details.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies list entry fetch requests to Iris API (/user/{username}/lists/{mediaType}/{id}).
    /// </summary>
    [HttpGet("Api/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetEntry([FromQuery] string mediaType, [FromQuery] int id, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        var entry = await _apiClient.GetListEntryAsync(mediaType, id, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        if (!entry.HasValue)
        {
            return NotFound(new { message = "Entry not found" });
        }

        return Content(entry.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies list entry upsert requests to Iris API (PUT /user/{username}/lists/{mediaType}/{id}).
    /// </summary>
    [HttpPost("Api/Save")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxySaveEntry([FromQuery] string mediaType, [FromQuery] int? id, [FromBody] IrisSaveEntryDto dto, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        int targetId = id ?? dto.AnimeId ?? dto.TvId ?? dto.MovieId ?? 0;
        if (targetId <= 0)
        {
            return BadRequest(new { message = "Target media ID is required for saving entry." });
        }

        var success = await _apiClient.SaveListEntryAsync(mediaType, targetId, dto, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to save entry on Iris API" });
    }

    /// <summary>
    /// Proxies delete entry request to Iris API (DELETE /user/{username}/lists/{mediaType}/{id}).
    /// </summary>
    [HttpDelete("Api/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyDeleteEntry([FromQuery] string mediaType, [FromQuery] int id, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        var success = await _apiClient.DeleteListEntryAsync(mediaType, id, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to delete entry" });
    }

    /// <summary>
    /// Proxies favorite status request to Iris API (/user/{username}/favorites/{id}).
    /// </summary>
    [HttpGet("Api/FavoriteStatus")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetFavoriteStatus([FromQuery] string mediaType, [FromQuery] int id, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        var fav = await _apiClient.GetFavoriteStatusAsync(mediaType, id, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        if (!fav.HasValue) return Ok(new { favorited = false });

        return Content(fav.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies toggle/add favorite request to Iris API.
    /// </summary>
    [HttpPost("Api/Favorite")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyAddFavorite([FromQuery] string? mediaType, [FromQuery] string? type, [FromQuery] int? id, [FromQuery] int? targetId, [FromQuery] string? title = null, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        string effectiveType = mediaType ?? type ?? "tv";
        int effectiveId = targetId ?? id ?? 0;
        if (effectiveId <= 0) return BadRequest(new { message = "Invalid target ID." });

        var success = await _apiClient.AddFavoriteAsync(effectiveType, effectiveId, title ?? "", userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to toggle favorite" });
    }

    /// <summary>
    /// Proxies delete favorite request to Iris API.
    /// </summary>
    [HttpDelete("Api/Favorite")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyDeleteFavorite([FromQuery] string mediaType, [FromQuery] int id, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        var success = await _apiClient.DeleteFavoriteAsync(mediaType, id, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to delete favorite" });
    }

    /// <summary>
    /// Proxies increment progress request to Iris API (/user/{username}/lists/{mediaType}/{id}/increment).
    /// </summary>
    [HttpPost("Api/Increment")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyIncrementProgress([FromBody] System.Text.Json.JsonElement body, [FromQuery] string? userId = null)
    {
        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            return BadRequest(new { message = "Iris API Key not configured." });
        }

        string mediaType = body.TryGetProperty("mediaType", out var mtProp) ? (mtProp.GetString() ?? "anime") : "anime";
        int id = body.GetProperty("id").GetInt32();
        int count = body.TryGetProperty("count", out var cProp) ? cProp.GetInt32() : 1;
        string? type = body.TryGetProperty("type", out var tProp) ? tProp.GetString() : null;

        var success = await _apiClient.IncrementProgressAsync(mediaType, id, count, userConfig.ApiKey, userConfig.IrisServerUrl, type, userConfig.CachedUsername).ConfigureAwait(false);
        if (success)
        {
            return Ok(new { success = true });
        }

        // If increment failed because entry wasn't on list yet, upsert entry
        _logger.LogInformation("[Iris WebController] [INCREMENT FALLBACK] Upserting entry for Id={Id}...", id);
        var saveDto = new IrisSaveEntryDto
        {
            Status = "WATCHING",
            Progress = count
        };

        var saveSuccess = await _apiClient.SaveListEntryAsync(mediaType, id, saveDto, userConfig.ApiKey, userConfig.IrisServerUrl, userConfig.CachedUsername).ConfigureAwait(false);
        return saveSuccess ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to increment or upsert progress" });
    }

    /// <summary>
    /// Gets item mapping for a user and Jellyfin item (with optional candidate IDs).
    /// </summary>
    [HttpGet("Api/Mapping")]
    [AllowAnonymous]
    public IActionResult GetMapping([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] string? candidateIds = null)
    {
        var idList = new System.Collections.Generic.List<string>();
        if (!string.IsNullOrWhiteSpace(candidateIds))
        {
            idList.AddRange(candidateIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }
        if (!string.IsNullOrWhiteSpace(itemId) && !idList.Contains(itemId, StringComparer.OrdinalIgnoreCase))
        {
            idList.Add(itemId);
        }

        var mapping = idList.Count > 1
            ? _mappingStore.GetMappingForCandidateIds(userId ?? "", idList)
            : _mappingStore.GetMapping(userId ?? "", itemId);

        if (mapping == null)
        {
            return NotFound(new { message = "Mapping not found" });
        }
        return Ok(mapping);
    }

    /// <summary>
    /// Sets item mapping for a user and Jellyfin item.
    /// </summary>
    [HttpPost("Api/Mapping")]
    [AllowAnonymous]
    public async Task<IActionResult> SaveMapping(
        [FromQuery] string? userId,
        [FromQuery] string itemId,
        [FromQuery] int? irisMediaId = null,
        [FromQuery] int? aquilaMediaId = null,
        [FromQuery] string? mediaType = null,
        [FromBody] System.Collections.Generic.List<LinkedMediaEntry>? entries = null)
    {
        int effectiveMediaId = irisMediaId ?? aquilaMediaId ?? 0;

        if (entries != null && entries.Count > 0)
        {
            await _mappingStore.SetMappingAsync(userId ?? "", itemId, entries).ConfigureAwait(false);
        }
        else if (effectiveMediaId > 0)
        {
            await _mappingStore.SetMappingAsync(userId ?? "", itemId, effectiveMediaId, mediaType ?? "tv").ConfigureAwait(false);
        }
        else
        {
            return BadRequest(new { message = "Either irisMediaId or entries array must be provided." });
        }

        return Ok(new { success = true });
    }

    /// <summary>
    /// Adds or updates a single entry in a user's ordered entries list for a Jellyfin item.
    /// </summary>
    [HttpPost("Api/Mapping/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> AddOrUpdateEntry([FromQuery] string? userId, [FromQuery] string itemId, [FromBody] LinkedMediaEntry entry)
    {
        if (entry.IrisMediaId <= 0)
        {
            return BadRequest(new { message = "Invalid irisMediaId." });
        }

        await _mappingStore.AddOrUpdateEntryAsync(userId ?? "", itemId, entry).ConfigureAwait(false);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Deletes a specific linked entry from a user's item mapping by Iris Media ID.
    /// </summary>
    [HttpDelete("Api/Mapping/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteEntry([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] int? irisMediaId = null, [FromQuery] int? aquilaMediaId = null)
    {
        int effectiveId = irisMediaId ?? aquilaMediaId ?? 0;
        var removed = await _mappingStore.RemoveEntryAsync(userId ?? "", itemId, effectiveId).ConfigureAwait(false);
        return Ok(new { success = true, removed });
    }

    /// <summary>
    /// Reorders the linked entries for a user and Jellyfin item.
    /// </summary>
    [HttpPut("Api/Mapping/Reorder")]
    [AllowAnonymous]
    public async Task<IActionResult> ReorderEntries([FromQuery] string? userId, [FromQuery] string itemId, [FromBody] System.Collections.Generic.List<int> irisMediaIdsInOrder)
    {
        if (irisMediaIdsInOrder == null)
        {
            return BadRequest(new { message = "irisMediaIdsInOrder payload is required." });
        }

        var success = await _mappingStore.ReorderEntriesAsync(userId ?? "", itemId, irisMediaIdsInOrder).ConfigureAwait(false);
        return Ok(new { success });
    }

    /// <summary>
    /// Deletes a specific item mapping for a user and Jellyfin item from server (with optional candidate IDs).
    /// </summary>
    [HttpDelete("Api/Mapping")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteMapping([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] string? candidateIds = null)
    {
        var idList = new System.Collections.Generic.List<string>();
        if (!string.IsNullOrWhiteSpace(candidateIds))
        {
            idList.AddRange(candidateIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        }

        var removed = await _mappingStore.RemoveMappingAsync(userId, itemId, idList).ConfigureAwait(false);
        return Ok(new { success = true, removed });
    }

    /// <summary>
    /// Gets all item mappings stored on server (optionally filtered by user ID).
    /// </summary>
    [HttpGet("Api/Mappings")]
    [AllowAnonymous]
    public IActionResult GetAllMappings([FromQuery] string? userId = null)
    {
        var mappings = _mappingStore.GetAllMappings(userId);
        return Ok(mappings);
    }

    /// <summary>
    /// Deletes all item mappings stored on server (or all mappings for a specific user ID).
    /// </summary>
    [HttpDelete("Api/Mappings")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteAllMappings([FromQuery] string? userId = null)
    {
        var count = await _mappingStore.RemoveAllMappingsAsync(userId).ConfigureAwait(false);
        return Ok(new { success = true, count });
    }
}
