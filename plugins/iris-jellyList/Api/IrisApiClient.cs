using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Iris.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Iris.Api;

/// <summary>
/// REST API client communicating exclusively with the modern Iris (Elysia) API backend via x-api-key.
/// </summary>
public class IrisApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<IrisApiClient> _logger;
    private static readonly ConcurrentDictionary<string, string> UsernameCache = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// Initializes a new instance of the <see cref="IrisApiClient"/> class.
    /// </summary>
    public IrisApiClient(HttpClient httpClient, ILogger<IrisApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Normalizes media type string to canonical API format ("anime" | "tv" | "movie").
    /// </summary>
    public static string NormalizeMediaType(string? mediaType)
    {
        if (string.IsNullOrWhiteSpace(mediaType)) return "tv";
        var lower = mediaType.Trim().ToLowerInvariant();
        if (lower.Contains("movie")) return "movie";
        if (lower.Contains("anime")) return "anime";
        return "tv";
    }

    /// <summary>
    /// Cleans base URL, removing trailing slashes.
    /// </summary>
    public static string CleanBaseUrl(string? baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl)) return "http://localhost:4000";
        var clean = baseUrl.TrimEnd('/');
        if (clean.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            clean = clean.Substring(0, clean.Length - 4);
        }
        return clean;
    }

    /// <summary>
    /// Sends an HTTP request with an enforced timeout (default 8s) to prevent hanging the Jellyfin thread.
    /// </summary>
    private async Task<HttpResponseMessage> SendWithTimeoutAsync(HttpRequestMessage request, TimeSpan? timeout = null)
    {
        using var cts = new System.Threading.CancellationTokenSource(timeout ?? System.TimeSpan.FromSeconds(8));
        return await _httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
    }

    /// <summary>
    /// Resolves and caches the authenticated username via GET /users/me using the provided API key.
    /// </summary>
    public virtual async Task<string?> GetUsernameAsync(string apiKey, string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(apiKey)) return null;

        if (UsernameCache.TryGetValue(apiKey, out var cached) && !string.IsNullOrWhiteSpace(cached))
        {
            return cached;
        }

        try
        {
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/users/me";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("x-api-key", apiKey);

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Iris ApiClient] /users/me returned status {StatusCode} from '{Url}'", response.StatusCode, url);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("user", out var userEl))
            {
                if (userEl.TryGetProperty("username", out var uProp) && uProp.ValueKind == JsonValueKind.String)
                {
                    var uname = uProp.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(uname))
                    {
                        UsernameCache[apiKey] = uname;
                        _logger.LogInformation("[Iris ApiClient] Resolved username '{Username}' for API key", uname);
                        return uname;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Iris ApiClient] Failed to resolve username from /users/me");
        }

        return null;
    }

    /// <summary>
    /// Searches media by title via GET /search/{anime|tv|movies}?q={query}.
    /// </summary>
    public virtual async Task<List<IrisSearchResult>> SearchMediaAsync(string mediaType, string title, string apiKey, string baseUrl)
    {
        var logPrefix = "[Iris ApiClient] [SEARCH]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var endpointType = normType == "movie" ? "movies" : normType;
            var cleanBase = CleanBaseUrl(baseUrl);
            var escapedQuery = Uri.EscapeDataString(title ?? string.Empty);
            var url = $"{cleanBase}/search/{endpointType}?q={escapedQuery}";

            _logger.LogInformation("{LogPrefix} Request URL: '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                _logger.LogWarning("{LogPrefix} HTTP Error {StatusCode}: {Error}", logPrefix, response.StatusCode, errBody);
                return new List<IrisSearchResult>();
            }

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var results = JsonSerializer.Deserialize<List<IrisSearchResult>>(json, JsonOptions);
            if (results != null)
            {
                foreach (var item in results)
                {
                    item.ResolvedType = normType;
                }
                return results;
            }

            return new List<IrisSearchResult>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed searching Iris media: Type={MediaType}, Title={Title}", logPrefix, mediaType, title);
            return new List<IrisSearchResult>();
        }
    }

    /// <summary>
    /// Fetches media metadata details via GET /media/{anime|tv|movies}/{id}.
    /// </summary>
    public virtual async Task<JsonElement?> GetMediaDetailsAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Iris ApiClient] [GET DETAILS]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var endpointType = normType == "movie" ? "movies" : normType;
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/media/{endpointType}/{id}";

            _logger.LogInformation("{LogPrefix} Request URL: '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to fetch media details for Type={MediaType}, Id={Id}", logPrefix, mediaType, id);
            return null;
        }
    }

    /// <summary>
    /// Fetches user list entry details via GET /user/{username}/lists/{mediaType}/{id}.
    /// </summary>
    public virtual async Task<JsonElement?> GetListEntryAsync(string mediaType, int mediaId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [GET ENTRY]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username))
            {
                _logger.LogWarning("{LogPrefix} Cannot get list entry: Username could not be resolved from API key.", logPrefix);
                return null;
            }

            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/lists/{normType}/{mediaId}";

            _logger.LogInformation("{LogPrefix} Request URL: '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("inList", out var inListProp) && inListProp.GetBoolean() &&
                root.TryGetProperty("entry", out var entryProp) && entryProp.ValueKind == JsonValueKind.Object)
            {
                return entryProp.Clone();
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to get list entry for Type={MediaType}, Id={MediaId}", logPrefix, mediaType, mediaId);
            return null;
        }
    }

    /// <summary>
    /// Upserts list entry via PUT /user/{username}/lists/{mediaType}/{id}.
    /// </summary>
    public virtual async Task<bool> SaveListEntryAsync(string mediaType, int mediaId, IrisSaveEntryDto dto, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [SAVE ENTRY]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username))
            {
                _logger.LogWarning("{LogPrefix} Cannot save list entry: Username could not be resolved from API key.", logPrefix);
                return false;
            }

            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/lists/{normType}/{mediaId}";

            _logger.LogInformation("{LogPrefix} Upserting entry to '{Url}' (Status: {Status}, Progress: {Progress}, Score: {Score})",
                logPrefix, url, dto.Status, dto.Progress, dto.Score);

            using var request = new HttpRequestMessage(HttpMethod.Put, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var jsonBody = JsonSerializer.Serialize(dto, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                _logger.LogWarning("{LogPrefix} PUT returned HTTP {StatusCode}: {Error}", logPrefix, response.StatusCode, err);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Exception saving list entry for Type={MediaType}, Id={MediaId}", logPrefix, mediaType, mediaId);
            return false;
        }
    }

    /// <summary>
    /// Deletes user list entry via DELETE /user/{username}/lists/{mediaType}/{id}.
    /// </summary>
    public virtual async Task<bool> DeleteListEntryAsync(string mediaType, int mediaId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [DELETE ENTRY]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username)) return false;

            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/lists/{normType}/{mediaId}";

            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to delete list entry for Type={MediaType}, Id={MediaId}", logPrefix, mediaType, mediaId);
            return false;
        }
    }

    /// <summary>
    /// Increments user list progress via POST /user/{username}/lists/{mediaType}/{id}/increment.
    /// </summary>
    public virtual async Task<bool> IncrementProgressAsync(string mediaType, int mediaId, int count, string apiKey, string baseUrl, string? type = null, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [INCREMENT]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username)) return false;

            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/lists/{normType}/{mediaId}/increment";

            _logger.LogInformation("{LogPrefix} Request URL: '{Url}', Count={Count}, Type={Type}", logPrefix, url, count, type);

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            object payload = normType switch
            {
                "tv" => new { count, type = type ?? "EPISODE" },
                "movie" => new { },
                _ => new { count }
            };

            var jsonBody = JsonSerializer.Serialize(payload, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to increment progress for Type={MediaType}, Id={MediaId}", logPrefix, mediaType, mediaId);
            return false;
        }
    }

    /// <summary>
    /// Fetches favorite status via GET /user/{username}/favorites/{targetId}?type={TYPE}.
    /// </summary>
    public virtual async Task<JsonElement?> GetFavoriteStatusAsync(string mediaType, int targetId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [FAVORITE STATUS]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username)) return null;

            var normType = NormalizeMediaType(mediaType).ToUpperInvariant();
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/favorites/{targetId}?type={normType}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed getting favorite status for TargetId={TargetId}", logPrefix, targetId);
            return null;
        }
    }

    /// <summary>
    /// Toggles or adds a favorite via POST /user/{username}/favorites/{targetId}.
    /// </summary>
    public virtual async Task<bool> AddFavoriteAsync(string mediaType, int targetId, string title, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [ADD FAVORITE]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username)) return false;

            var normType = NormalizeMediaType(mediaType).ToUpperInvariant();
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/favorites/{targetId}";

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var jsonBody = JsonSerializer.Serialize(new { type = normType, title }, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed toggling favorite for TargetId={TargetId}", logPrefix, targetId);
            return false;
        }
    }

    /// <summary>
    /// Deletes a favorite via DELETE /user/{username}/favorites/{targetId}?type={TYPE}.
    /// </summary>
    public virtual async Task<bool> DeleteFavoriteAsync(string mediaType, int targetId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Iris ApiClient] [DELETE FAVORITE]";
        try
        {
            var username = explicitUsername ?? await GetUsernameAsync(apiKey, baseUrl).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(username)) return false;

            var normType = NormalizeMediaType(mediaType).ToUpperInvariant();
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/user/{Uri.EscapeDataString(username)}/favorites/{targetId}?type={normType}";

            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed deleting favorite for TargetId={TargetId}", logPrefix, targetId);
            return false;
        }
    }
}
