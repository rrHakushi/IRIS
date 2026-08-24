using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Jellyfin.Plugin.Aquila.Configuration;
using Jellyfin.Plugin.Aquila.Models;
using Jellyfin.Plugin.Aquila.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Aquila.Api;

/// <summary>
/// REST API controller serving Aquila web injection script, CSS, and API proxy endpoints across multiple route aliases with cache-control headers.
/// </summary>
[ApiController]
[Route("Aquila")]
[Route("api/Aquila")]
[Route("Plugins/Aquila")]
public class AquilaWebController : ControllerBase
{
    private readonly AquilaApiClient _apiClient;
    private readonly MediaMappingStore _mappingStore;
    private readonly AquilaSyncManager _syncManager;
    private readonly ILogger<AquilaWebController> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="AquilaWebController"/> class.
    /// </summary>
    public AquilaWebController(AquilaApiClient apiClient, MediaMappingStore mappingStore, AquilaSyncManager syncManager, ILogger<AquilaWebController> logger)
    {
        _apiClient = apiClient;
        _mappingStore = mappingStore;
        _syncManager = syncManager;
        _logger = logger;
    }

    /// <summary>
    /// Serves aquila-web-injection.js with application/javascript content type and no-cache headers.
    /// </summary>
    [HttpGet("aquila-client.js")]
    [HttpGet("WebInjection.js")]
    [Produces("application/javascript")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetWebInjectionScript()
    {
        Console.WriteLine("[Aquila WebController] Serving WebInjection.js");
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.Aquila.Web.aquila-web-injection.js");
        if (stream == null)
        {
            Console.WriteLine("[Aquila WebController] ERROR: aquila-web-injection.js manifest stream is null.");
            return NotFound("// Aquila injection script resource not found.");
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var js = reader.ReadToEnd();
        return Content(js, "application/javascript", Encoding.UTF8);
    }

    /// <summary>
    /// Serves aquila-modal.css with text/css content type and no-cache headers.
    /// </summary>
    [HttpGet("Modal.css")]
    [Produces("text/css")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetModalCss()
    {
        Console.WriteLine("[Aquila WebController] Serving Modal.css");
        Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0";
        Response.Headers["Pragma"] = "no-cache";
        Response.Headers["Expires"] = "0";

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("Jellyfin.Plugin.Aquila.Web.aquila-modal.css");
        if (stream == null)
        {
            Console.WriteLine("[Aquila WebController] ERROR: aquila-modal.css manifest stream is null.");
            return NotFound("/* Aquila modal css resource not found. */");
        }

        using var reader = new StreamReader(stream, Encoding.UTF8);
        var css = reader.ReadToEnd();
        return Content(css, "text/css", Encoding.UTF8);
    }

    private static UserAquilaConfig? GetCurrentUserConfig(string? userId = null)
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
    /// Proxies search requests to Aquila API from server side to bypass CORS.
    /// </summary>
    [HttpGet("Api/Search")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxySearch([FromQuery] string mediaType, [FromQuery] string query, [FromQuery] string? userId = null)
    {
        var logPrefix = "[Aquila WebController] [PROXY SEARCH]";
        Console.WriteLine($"{logPrefix} Received request: mediaType='{mediaType}', query='{query}', userId='{userId}'");
        _logger.LogInformation("{LogPrefix} Request: mediaType='{MediaType}', query='{Query}', userId='{UserId}'", logPrefix, mediaType, query, userId);

        var userConfig = GetCurrentUserConfig(userId);
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            var warn = $"{logPrefix} FAILED: No Aquila API Key configured for user '{userId}'.";
            Console.WriteLine(warn);
            _logger.LogWarning("{Warn}", warn);
            return BadRequest(new { message = "Aquila API Key not configured in Jellyfin Plugin Settings." });
        }

        Console.WriteLine($"{logPrefix} UserConfig found: BaseUrl='{userConfig.AquilaServerUrl}', ApiKeyPresent={!string.IsNullOrWhiteSpace(userConfig.ApiKey)}");
        var results = await _apiClient.SearchMediaAsync(mediaType, query, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        Console.WriteLine($"{logPrefix} Returning {results.Count} items to client.");
        return Ok(results);
    }

    /// <summary>
    /// Proxies list entry fetch requests to Aquila API from server side to bypass CORS.
    /// </summary>
    [HttpGet("Api/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetEntry([FromQuery] string mediaType, [FromQuery] int id)
    {
        var logPrefix = "[Aquila WebController] [PROXY GET ENTRY]";
        Console.WriteLine($"{logPrefix} Received request: mediaType='{mediaType}', id={id}");
        _logger.LogInformation("{LogPrefix} Request: mediaType='{MediaType}', id={MediaId}", logPrefix, mediaType, id);

        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            Console.WriteLine($"{logPrefix} FAILED: No Aquila API Key configured.");
            return BadRequest(new { message = "Aquila API Key not configured." });
        }

        var entry = await _apiClient.GetListEntryAsync(mediaType, id, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!entry.HasValue)
        {
            Console.WriteLine($"{logPrefix} Entry not found for ID {id}.");
            return NotFound(new { message = "Entry not found" });
        }

        return Content(entry.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies list entry save requests to Aquila API from server side to bypass CORS.
    /// </summary>
    [HttpPost("Api/Save")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxySaveEntry([FromQuery] string mediaType, [FromBody] AquilaSaveEntryDto dto)
    {
        var logPrefix = "[Aquila WebController] [PROXY SAVE ENTRY]";
        Console.WriteLine($"{logPrefix} Received save request for mediaType='{mediaType}'");
        _logger.LogInformation("{LogPrefix} Request for mediaType='{MediaType}'", logPrefix, mediaType);

        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey))
        {
            Console.WriteLine($"{logPrefix} FAILED: No Aquila API Key configured.");
            return BadRequest(new { message = "Aquila API Key not configured." });
        }

        var success = await _apiClient.SaveListEntryAsync(mediaType, dto, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        Console.WriteLine($"{logPrefix} Save entry success status: {success}");
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to save entry on Aquila API" });
    }

    /// <summary>
    /// Proxies media details request to Aquila API.
    /// </summary>
    [HttpGet("Api/Details")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetDetails([FromQuery] string mediaType, [FromQuery] int id)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var details = await _apiClient.GetMediaDetailsAsync(mediaType, id, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!details.HasValue) return NotFound(new { message = "Media details not found" });

        return Content(details.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies favorite status request to Aquila API.
    /// </summary>
    [HttpGet("Api/FavoriteStatus")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetFavoriteStatus([FromQuery] string mediaType, [FromQuery] int id)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var fav = await _apiClient.GetFavoriteStatusAsync(mediaType, id, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!fav.HasValue) return Ok(new { favorited = false });

        return Content(fav.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies add favorite request to Aquila API.
    /// </summary>
    [HttpPost("Api/Favorite")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyAddFavorite([FromQuery] string type, [FromQuery] string targetId)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var success = await _apiClient.AddFavoriteAsync(type, targetId, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to add favorite" });
    }

    /// <summary>
    /// Proxies delete favorite request to Aquila API.
    /// </summary>
    [HttpDelete("Api/Favorite")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyDeleteFavorite([FromQuery] string mediaType, [FromQuery] int id)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var success = await _apiClient.DeleteFavoriteAsync(mediaType, id, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to delete favorite" });
    }

    /// <summary>
    /// Proxies delete entry request to Aquila API.
    /// </summary>
    [HttpDelete("Api/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyDeleteEntry([FromQuery] string mediaType, [FromQuery] int id)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var success = await _apiClient.DeleteListEntryAsync(mediaType, id, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to delete entry" });
    }

    /// <summary>
    /// Proxies toggle episode watched request to Aquila API.
    /// </summary>
    [HttpPost("Api/Episode")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyToggleEpisode([FromQuery] int id, [FromBody] System.Text.Json.JsonElement body)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        int seasonNum = body.GetProperty("seasonNum").GetInt32();
        int episodeNum = body.GetProperty("episodeNum").GetInt32();

        var res = await _apiClient.ToggleEpisodeWatchedAsync(id, seasonNum, episodeNum, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!res.HasValue) return StatusCode(500, new { message = "Failed to toggle episode" });

        return Content(res.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies increment progress request to Aquila API (/list/increment).
    /// </summary>
    [HttpPost("Api/Increment")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyIncrementProgress([FromBody] System.Text.Json.JsonElement body)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        string mediaType = body.TryGetProperty("mediaType", out var mtProp) ? (mtProp.GetString() ?? "anime") : "anime";
        int id = body.GetProperty("id").GetInt32();
        int count = body.TryGetProperty("count", out var cProp) ? cProp.GetInt32() : 1;

        _logger.LogInformation("[Aquila WebController] [INCREMENT] MediaType='{MediaType}', Id={Id}, Count={Count}", mediaType, id, count);

        var incrementDto = new AquilaIncrementDto
        {
            MediaType = mediaType,
            Id = id,
            Count = count
        };

        var success = await _apiClient.IncrementProgressAsync(incrementDto, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (success)
        {
            return Ok(new { success = true });
        }

        // If /list/increment returned false/404 because entry wasn't on list yet, create entry!
        _logger.LogInformation("[Aquila WebController] [INCREMENT FALLBACK] Entry missing on list for Id={Id}. Upserting entry...", id);
        var saveDto = new AquilaSaveEntryDto
        {
            Status = "WATCHING",
            Progress = count
        };
        SetSaveDtoMediaId(saveDto, mediaType, id);
        var saveSuccess = await _apiClient.SaveListEntryAsync(mediaType, saveDto, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        return saveSuccess ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to increment or save progress" });
    }

    private static void SetSaveDtoMediaId(AquilaSaveEntryDto dto, string mediaType, int mediaId)
    {
        switch (mediaType.ToUpperInvariant())
        {
            case "ANIME":
                dto.AnimeId = mediaId;
                break;
            case "MOVIE":
                dto.MovieId = mediaId;
                break;
            case "TV":
            default:
                dto.TvId = mediaId;
                break;
        }
    }

    /// <summary>
    /// Proxies toggle season watched request to Aquila API.
    /// </summary>
    [HttpPost("Api/Season")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyToggleSeason([FromQuery] int id, [FromBody] System.Text.Json.JsonElement body)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        int seasonNum = body.GetProperty("seasonNum").GetInt32();
        var episodes = body.GetProperty("episodes");
        bool watched = body.GetProperty("watched").GetBoolean();

        var success = await _apiClient.ToggleSeasonWatchedAsync(id, seasonNum, episodes, watched, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        return success ? Ok(new { success = true }) : StatusCode(500, new { message = "Failed to toggle season" });
    }

    /// <summary>
    /// Proxies user active connections request to Aquila API.
    /// </summary>
    [HttpGet("Api/Connections")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyGetConnections([FromQuery] string capabilities)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var conn = await _apiClient.GetUserConnectionsAsync(capabilities ?? "", userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!conn.HasValue) return Ok(Array.Empty<object>());

        return Content(conn.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Proxies external connection search request to Aquila API.
    /// </summary>
    [HttpGet("Api/ConnectionSearch")]
    [AllowAnonymous]
    public async Task<IActionResult> ProxyConnectionSearch([FromQuery] string provider, [FromQuery] string mediaType, [FromQuery] string query)
    {
        var userConfig = GetCurrentUserConfig();
        if (userConfig == null || string.IsNullOrWhiteSpace(userConfig.ApiKey)) return BadRequest(new { message = "Aquila API Key not configured." });

        var res = await _apiClient.SearchConnectionMediaAsync(provider, mediaType, query, userConfig.ApiKey, userConfig.AquilaServerUrl).ConfigureAwait(false);
        if (!res.HasValue) return Ok(Array.Empty<object>());

        return Content(res.Value.GetRawText(), "application/json", Encoding.UTF8);
    }

    /// <summary>
    /// Gets item mapping for a user and Jellyfin item (with optional candidate IDs).
    /// </summary>
    [HttpGet("Api/Mapping")]
    [AllowAnonymous]
    public IActionResult GetMapping([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] string? candidateIds = null)
    {
        _logger.LogInformation("[Aquila WebController] [GET MAPPING] Request: UserId='{UserId}', ItemId='{ItemId}', Candidates='{Candidates}'", userId, itemId, candidateIds);

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
            _logger.LogInformation("[Aquila WebController] [GET MAPPING] Not found for ItemId='{ItemId}'", itemId);
            return NotFound(new { message = "Mapping not found" });
        }
        return Ok(mapping);
    }

    /// <summary>
    /// Sets item mapping for a user and Jellyfin item (supporting optional list of ordered entries via body or query parameters).
    /// </summary>
    [HttpPost("Api/Mapping")]
    [AllowAnonymous]
    public async Task<IActionResult> SaveMapping(
        [FromQuery] string? userId,
        [FromQuery] string itemId,
        [FromQuery] int? aquilaMediaId = null,
        [FromQuery] string? mediaType = null,
        [FromBody] System.Collections.Generic.List<LinkedMediaEntry>? entries = null)
    {
        _logger.LogInformation("[Aquila WebController] [SAVE MAPPING] Request: UserId='{UserId}', ItemId='{ItemId}', AquilaId={AquilaId}, Type='{MediaType}', EntriesCount={EntriesCount}",
            userId, itemId, aquilaMediaId, mediaType, entries?.Count ?? 0);

        if (entries != null && entries.Count > 0)
        {
            await _mappingStore.SetMappingAsync(userId ?? "", itemId, entries).ConfigureAwait(false);
        }
        else if (aquilaMediaId.HasValue && aquilaMediaId.Value > 0)
        {
            await _mappingStore.SetMappingAsync(userId ?? "", itemId, aquilaMediaId.Value, mediaType ?? "tv").ConfigureAwait(false);
        }
        else
        {
            return BadRequest(new { message = "Either aquilaMediaId or entries array must be provided." });
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
        _logger.LogInformation("[Aquila WebController] [ADD/UPDATE ENTRY] Request: UserId='{UserId}', ItemId='{ItemId}', AquilaId={AquilaId}, Type='{MediaType}'",
            userId, itemId, entry.AquilaMediaId, entry.MediaType);

        if (entry.AquilaMediaId <= 0)
        {
            return BadRequest(new { message = "Invalid aquilaMediaId." });
        }

        await _mappingStore.AddOrUpdateEntryAsync(userId ?? "", itemId, entry).ConfigureAwait(false);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Deletes a specific linked entry from a user's item mapping by Aquila Media ID.
    /// </summary>
    [HttpDelete("Api/Mapping/Entry")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteEntry([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] int aquilaMediaId)
    {
        _logger.LogInformation("[Aquila WebController] [DELETE ENTRY] Request: UserId='{UserId}', ItemId='{ItemId}', AquilaId={AquilaId}",
            userId, itemId, aquilaMediaId);

        var removed = await _mappingStore.RemoveEntryAsync(userId ?? "", itemId, aquilaMediaId).ConfigureAwait(false);
        return Ok(new { success = true, removed });
    }

    /// <summary>
    /// Reorders the linked entries for a user and Jellyfin item.
    /// </summary>
    [HttpPut("Api/Mapping/Reorder")]
    [AllowAnonymous]
    public async Task<IActionResult> ReorderEntries([FromQuery] string? userId, [FromQuery] string itemId, [FromBody] System.Collections.Generic.List<int> aquilaMediaIdsInOrder)
    {
        _logger.LogInformation("[Aquila WebController] [REORDER ENTRIES] Request: UserId='{UserId}', ItemId='{ItemId}', Order=[{Ids}]",
            userId, itemId, string.Join(", ", aquilaMediaIdsInOrder ?? new System.Collections.Generic.List<int>()));

        if (aquilaMediaIdsInOrder == null)
        {
            return BadRequest(new { message = "aquilaMediaIdsInOrder payload is required." });
        }

        var success = await _mappingStore.ReorderEntriesAsync(userId ?? "", itemId, aquilaMediaIdsInOrder).ConfigureAwait(false);
        return Ok(new { success });
    }

    /// <summary>
    /// Deletes a specific item mapping for a user and Jellyfin item from server (with optional candidate IDs).
    /// </summary>
    [HttpDelete("Api/Mapping")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteMapping([FromQuery] string? userId, [FromQuery] string itemId, [FromQuery] string? candidateIds = null)
    {
        _logger.LogInformation("[Aquila WebController] [DELETE MAPPING] Request: UserId='{UserId}', ItemId='{ItemId}', Candidates='{Candidates}'", userId, itemId, candidateIds);

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
        _logger.LogInformation("[Aquila WebController] [GET MAPPINGS] Request: UserId='{UserId}'", userId);
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
        _logger.LogInformation("[Aquila WebController] [DELETE ALL MAPPINGS] Request: UserId='{UserId}'", userId);
        var count = await _mappingStore.RemoveAllMappingsAsync(userId).ConfigureAwait(false);
        return Ok(new { success = true, count });
    }
}

