using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Borealis.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Borealis.Api;

/// <summary>
/// REST API client communicating exclusively with modern Borealis and Carina (Elysia) backend via x-api-key.
/// </summary>
public class BorealisApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<BorealisApiClient> _logger;
    private static readonly ConcurrentDictionary<string, string> UsernameCache = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// Initializes a new instance of the <see cref="BorealisApiClient"/> class.
    /// </summary>
    public BorealisApiClient(HttpClient httpClient, ILogger<BorealisApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Normalizes media type string to canonical API format ("anime" | "tv" | "movies").
    /// </summary>
    public static string NormalizeMediaType(string? mediaType)
    {
        if (string.IsNullOrWhiteSpace(mediaType)) return "tv";
        var lower = mediaType.Trim().ToLowerInvariant();
        if (lower.Contains("movie")) return "movies";
        if (lower.Contains("anime")) return "anime";
        return "tv";
    }

    /// <summary>
    /// Maps normalized media type to Carina favorite category string ("anime" | "tv" | "movie").
    /// </summary>
    public static string ToFavoriteCategory(string? mediaType)
    {
        var norm = NormalizeMediaType(mediaType);
        return norm == "movies" ? "movie" : norm;
    }

    /// <summary>
    /// Cleans base URL, removing trailing slashes and redundant /api path.
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
        using var cts = new System.Threading.CancellationTokenSource(timeout ?? TimeSpan.FromSeconds(8));
        return await _httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
    }

    /// <summary>
    /// Resolves and caches the authenticated username via GET /carina/users/me using the provided API key.
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
            var url = $"{cleanBase}/carina/users/me";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("x-api-key", apiKey);

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Borealis ApiClient] /carina/users/me returned status {StatusCode} from '{Url}'", response.StatusCode, url);
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
                        _logger.LogInformation("[Borealis ApiClient] Resolved username '{Username}' for API key", uname);
                        return uname;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Borealis ApiClient] Failed to resolve username from /carina/users/me");
        }

        return null;
    }

    /// <summary>
    /// Searches media by title via GET /borealis/search?q={query}&amp;category={anime|tv|movies}.
    /// </summary>
    public virtual async Task<List<BorealisSearchResult>> SearchMediaAsync(string mediaType, string title, string apiKey, string baseUrl)
    {
        var logPrefix = "[Borealis ApiClient] [SEARCH]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var escapedQuery = Uri.EscapeDataString(title ?? string.Empty);
            var url = $"{cleanBase}/borealis/search?q={escapedQuery}&category={normType}";

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
                return new List<BorealisSearchResult>();
            }

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("results", out var resultsEl) && resultsEl.ValueKind == JsonValueKind.Array)
            {
                var results = JsonSerializer.Deserialize<List<BorealisSearchResult>>(resultsEl.GetRawText(), JsonOptions);
                if (results != null)
                {
                    foreach (var item in results)
                    {
                        item.ResolvedType = normType;
                    }
                    return results;
                }
            }

            return new List<BorealisSearchResult>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed searching Borealis media: Type={MediaType}, Title={Title}", logPrefix, mediaType, title);
            return new List<BorealisSearchResult>();
        }
    }

    /// <summary>
    /// Fetches media metadata details via GET /borealis/media/{anime|tv|movies}/{id}.
    /// </summary>
    public virtual async Task<JsonElement?> GetMediaDetailsAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Borealis ApiClient] [GET DETAILS]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/borealis/media/{normType}/{id}";

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
            if (root.TryGetProperty("media", out var mediaProp) && mediaProp.ValueKind == JsonValueKind.Object)
            {
                return mediaProp.Clone();
            }
            if (root.TryGetProperty("data", out var dataProp) && dataProp.ValueKind == JsonValueKind.Object)
            {
                return dataProp.Clone();
            }
            return root.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to fetch media details for Type={MediaType}, Id={Id}", logPrefix, mediaType, id);
            return null;
        }
    }

    /// <summary>
    /// Fetches user list entry details via GET /borealis/lists/{anime|tv|movies}/{id}.
    /// </summary>
    public virtual async Task<JsonElement?> GetListEntryAsync(string mediaType, int mediaId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [GET ENTRY]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/borealis/lists/{normType}/{mediaId}";

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

            if (root.TryGetProperty("inList", out var inListProp) && inListProp.GetBoolean())
            {
                return root.Clone();
            }
            if (root.TryGetProperty("entry", out var entryProp) && entryProp.ValueKind == JsonValueKind.Object)
            {
                return root.Clone();
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
    /// Upserts list entry via POST /borealis/lists/{anime|tv|movies}/{id}.
    /// </summary>
    public virtual async Task<bool> SaveListEntryAsync(string mediaType, int mediaId, BorealisSaveEntryDto dto, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [SAVE ENTRY]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/borealis/lists/{normType}/{mediaId}";

            _logger.LogInformation("{LogPrefix} Upserting entry to '{Url}' (Status: {Status}, Progress: {Progress}, Score: {Score})",
                logPrefix, url, dto.Status, dto.Progress, dto.Score);

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
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
                _logger.LogWarning("{LogPrefix} POST returned HTTP {StatusCode}: {Error}", logPrefix, response.StatusCode, err);
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
    /// Deletes user list entry via DELETE /borealis/lists/{anime|tv|movies}/{id}.
    /// </summary>
    public virtual async Task<bool> DeleteListEntryAsync(string mediaType, int mediaId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [DELETE ENTRY]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/borealis/lists/{normType}/{mediaId}";

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
    /// Increments user list progress via POST /borealis/lists/{anime|tv|movies}/{id}/increment.
    /// </summary>
    public virtual async Task<bool> IncrementProgressAsync(string mediaType, int mediaId, int count, string apiKey, string baseUrl, string? type = null, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [INCREMENT]";
        try
        {
            var normType = NormalizeMediaType(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/borealis/lists/{normType}/{mediaId}/increment";

            _logger.LogInformation("{LogPrefix} Request URL: '{Url}', Count={Count}, Type={Type}", logPrefix, url, count, type);

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var payload = new { count = Math.Max(1, count) };
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
    /// Fetches favorite status via GET /carina/favorites/{category}/{targetId}.
    /// </summary>
    public virtual async Task<JsonElement?> GetFavoriteStatusAsync(string mediaType, int targetId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [FAVORITE STATUS]";
        try
        {
            var category = ToFavoriteCategory(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/carina/favorites/{category}/{targetId}";

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
    /// Adds a favorite via POST /carina/favorites.
    /// </summary>
    public virtual async Task<bool> AddFavoriteAsync(string mediaType, int targetId, string title, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [ADD FAVORITE]";
        try
        {
            var category = ToFavoriteCategory(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/carina/favorites";

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var jsonBody = JsonSerializer.Serialize(new { category, targetId }, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await SendWithTimeoutAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed adding favorite for TargetId={TargetId}", logPrefix, targetId);
            return false;
        }
    }

    /// <summary>
    /// Deletes a favorite via DELETE /carina/favorites/{category}/{targetId}.
    /// </summary>
    public virtual async Task<bool> DeleteFavoriteAsync(string mediaType, int targetId, string apiKey, string baseUrl, string? explicitUsername = null)
    {
        var logPrefix = "[Borealis ApiClient] [DELETE FAVORITE]";
        try
        {
            var category = ToFavoriteCategory(mediaType);
            var cleanBase = CleanBaseUrl(baseUrl);
            var url = $"{cleanBase}/carina/favorites/{category}/{targetId}";

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
