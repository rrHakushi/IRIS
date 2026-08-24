using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.Aquila.Models;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.Aquila.Api;

/// <summary>
/// REST API client for communicating with Aquila (Runa Realm backend) via x-api-key.
/// </summary>
public class AquilaApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AquilaApiClient> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// Initializes a new instance of the <see cref="AquilaApiClient"/> class.
    /// </summary>
    public AquilaApiClient(HttpClient httpClient, ILogger<AquilaApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <summary>
    /// Searches media by title via GET /:mediaType/search/:title.
    /// </summary>
    public virtual async Task<List<AquilaSearchResult>> SearchMediaAsync(string mediaType, string title, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [SEARCH]";
        try
        {
            Console.WriteLine($"{logPrefix} Start Search: MediaType='{mediaType}', Title='{title}', BaseUrl='{baseUrl}', ApiKeyPresent={!string.IsNullOrWhiteSpace(apiKey)}");
            _logger.LogInformation("{LogPrefix} Start Search: MediaType='{MediaType}', Title='{Title}', BaseUrl='{BaseUrl}'", logPrefix, mediaType, title, baseUrl);

            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                var msg = $"{logPrefix} Skipped: AquilaServerUrl is empty.";
                Console.WriteLine(msg);
                _logger.LogWarning("{Message}", msg);
                return new List<AquilaSearchResult>();
            }

            var cleanBaseUrl = baseUrl.TrimEnd('/');
            if (cleanBaseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            {
                cleanBaseUrl = cleanBaseUrl.Substring(0, cleanBaseUrl.Length - 4);
            }

            var escapedTitle = Uri.EscapeDataString(title ?? string.Empty);
            var url = $"{cleanBaseUrl}/{mediaType}/search/{escapedTitle}";

            Console.WriteLine($"{logPrefix} Constructed Request URL: '{url}'");
            _logger.LogInformation("{LogPrefix} Constructed Request URL: '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
                Console.WriteLine($"{logPrefix} Added header 'x-api-key': {(apiKey.Length > 4 ? apiKey.Substring(0, 4) : apiKey)}***");
            }
            else
            {
                Console.WriteLine($"{logPrefix} WARNING: No x-api-key header added.");
            }

            Console.WriteLine($"{logPrefix} Executing HttpClient.SendAsync to '{url}'...");
            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);

            Console.WriteLine($"{logPrefix} Response Status Code: {(int)response.StatusCode} {response.StatusCode}");
            _logger.LogInformation("{LogPrefix} Response Status Code: {StatusCode}", logPrefix, response.StatusCode);

            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"{logPrefix} Raw Response Body (Length {json.Length}): {json}");

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"{logPrefix} ERROR HTTP {(int)response.StatusCode} {response.StatusCode}: {json}");
                _logger.LogError("{LogPrefix} HTTP Error {StatusCode}: {Json}", logPrefix, response.StatusCode, json);
                return new List<AquilaSearchResult>();
            }

            var results = JsonSerializer.Deserialize<List<AquilaSearchResult>>(json, JsonOptions);
            Console.WriteLine($"{logPrefix} Deserialized {results?.Count ?? 0} search results.");
            _logger.LogInformation("{LogPrefix} Search returned {Count} items.", logPrefix, results?.Count ?? 0);
            return results ?? new List<AquilaSearchResult>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{logPrefix} EXCEPTION: {ex.GetType().Name} - {ex.Message}\n{ex.StackTrace}");
            _logger.LogError(ex, "{LogPrefix} Failed to search Aquila media. Type: {MediaType}, Title: {Title}", logPrefix, mediaType, title);
            return new List<AquilaSearchResult>();
        }
    }

    /// <summary>
    /// Increments user list progress via POST /list/increment.
    /// </summary>
    public virtual async Task<bool> IncrementProgressAsync(AquilaIncrementDto dto, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [INCREMENT]";
        try
        {
            var cleanBaseUrl = baseUrl.TrimEnd('/');
            if (cleanBaseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            {
                cleanBaseUrl = cleanBaseUrl.Substring(0, cleanBaseUrl.Length - 4);
            }
            var url = $"{cleanBaseUrl}/list/increment";
            Console.WriteLine($"{logPrefix} Target URL: '{url}', Media ID: {dto.Id}, Type: '{dto.MediaType}', Count: {dto.Count}");
            _logger.LogInformation("{LogPrefix} Target URL: '{Url}', Media ID: {MediaId}, Type: '{MediaType}'", logPrefix, url, dto.Id, dto.MediaType);

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var jsonBody = JsonSerializer.Serialize(dto, JsonOptions);
            Console.WriteLine($"{logPrefix} Request Payload: {jsonBody}");
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"{logPrefix} Response Status: {(int)response.StatusCode} {response.StatusCode}, Body: {responseBody}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("{LogPrefix} Increment failed with HTTP {StatusCode}: {Error}", logPrefix, response.StatusCode, responseBody);
                return false;
            }

            Console.WriteLine($"{logPrefix} Increment SUCCESS for Media ID {dto.Id}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{logPrefix} EXCEPTION: {ex.GetType().Name} - {ex.Message}\n{ex.StackTrace}");
            _logger.LogError(ex, "{LogPrefix} Error calling Aquila /list/increment for ID: {MediaId}", logPrefix, dto.Id);
            return false;
        }
    }

    /// <summary>
    /// Fetches list entry details via GET /list/:mediaType/entry/:id.
    /// </summary>
    public virtual async Task<JsonElement?> GetListEntryAsync(string mediaType, int mediaId, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [GET ENTRY]";
        try
        {
            var cleanBaseUrl = baseUrl.TrimEnd('/');
            if (cleanBaseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            {
                cleanBaseUrl = cleanBaseUrl.Substring(0, cleanBaseUrl.Length - 4);
            }
            var url = $"{cleanBaseUrl}/list/{mediaType}/entry/{mediaId}";
            Console.WriteLine($"{logPrefix} Target URL: '{url}'");
            _logger.LogInformation("{LogPrefix} Fetching list entry from '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"{logPrefix} Response Status: {(int)response.StatusCode} {response.StatusCode}, Body: {json}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogInformation("{LogPrefix} Request returned status {StatusCode}", logPrefix, response.StatusCode);
                return null;
            }

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{logPrefix} EXCEPTION: {ex.GetType().Name} - {ex.Message}\n{ex.StackTrace}");
            _logger.LogError(ex, "{LogPrefix} Failed to get list entry for {MediaType} ID {MediaId}", logPrefix, mediaType, mediaId);
            return null;
        }
    }

    /// <summary>
    /// Saves/upserts list entry via POST /list/:mediaType/entry/save.
    /// </summary>
    public virtual async Task<bool> SaveListEntryAsync(string mediaType, AquilaSaveEntryDto dto, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [SAVE ENTRY]";
        try
        {
            var cleanBaseUrl = baseUrl.TrimEnd('/');
            if (cleanBaseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
            {
                cleanBaseUrl = cleanBaseUrl.Substring(0, cleanBaseUrl.Length - 4);
            }
            var url = $"{cleanBaseUrl}/list/{mediaType}/entry/save";
            Console.WriteLine($"{logPrefix} Target URL: '{url}' (Status: {dto.Status}, Progress: {dto.Progress}, Score: {dto.Score})");
            _logger.LogInformation("{LogPrefix} Saving list entry to '{Url}'", logPrefix, url);

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
            }

            var jsonBody = JsonSerializer.Serialize(dto, JsonOptions);
            Console.WriteLine($"{logPrefix} Request Body: {jsonBody}");
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            Console.WriteLine($"{logPrefix} Response Status: {(int)response.StatusCode} {response.StatusCode}, Body: {responseBody}");

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{logPrefix} EXCEPTION: {ex.GetType().Name} - {ex.Message}\n{ex.StackTrace}");
            _logger.LogError(ex, "{LogPrefix} Failed to save list entry for {MediaType}", logPrefix, mediaType);
            return false;
        }
    }

    /// <summary>
    /// Fetches media metadata details via GET /:mediaType/:id.
    /// </summary>
    public virtual async Task<JsonElement?> GetMediaDetailsAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [GET DETAILS]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/{mediaType}/{id}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to get media details for {MediaType} ID {Id}", logPrefix, mediaType, id);
            return null;
        }
    }

    /// <summary>
    /// Fetches favorite status via GET /favorites/:mediaType/:id/status.
    /// </summary>
    public virtual async Task<JsonElement?> GetFavoriteStatusAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [FAVORITE STATUS]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/favorites/{mediaType}/{id}/status";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to get favorite status for {MediaType} ID {Id}", logPrefix, mediaType, id);
            return null;
        }
    }

    /// <summary>
    /// Adds a favorite via POST /favorites.
    /// </summary>
    public virtual async Task<bool> AddFavoriteAsync(string type, string targetId, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [ADD FAVORITE]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/favorites";
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var jsonBody = JsonSerializer.Serialize(new { type = type.ToUpper(), targetId = targetId }, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to add favorite for {Type} TargetId {TargetId}", logPrefix, type, targetId);
            return false;
        }
    }

    /// <summary>
    /// Removes a favorite via DELETE /favorites/:mediaType/:id.
    /// </summary>
    public virtual async Task<bool> DeleteFavoriteAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [DELETE FAVORITE]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/favorites/{mediaType}/{id}";
            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to delete favorite for {MediaType} ID {Id}", logPrefix, mediaType, id);
            return false;
        }
    }

    /// <summary>
    /// Deletes a user list entry via DELETE /list/:mediaType/entry/:id.
    /// </summary>
    public virtual async Task<bool> DeleteListEntryAsync(string mediaType, int id, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [DELETE ENTRY]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/list/{mediaType}/entry/{id}";
            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to delete list entry for {MediaType} ID {Id}", logPrefix, mediaType, id);
            return false;
        }
    }

    /// <summary>
    /// Toggles a TV episode watched state via POST /list/tv/entry/:id/episode.
    /// </summary>
    public virtual async Task<JsonElement?> ToggleEpisodeWatchedAsync(int id, int seasonNum, int episodeNum, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [TOGGLE EPISODE]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/list/tv/entry/{id}/episode";
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var jsonBody = JsonSerializer.Serialize(new { seasonNum = seasonNum, episodeNum = episodeNum }, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to toggle episode watched for TV ID {Id}", logPrefix, id);
            return null;
        }
    }

    /// <summary>
    /// Toggles a TV season watched state via POST /list/tv/entry/:id/season.
    /// </summary>
    public virtual async Task<bool> ToggleSeasonWatchedAsync(int id, int seasonNum, JsonElement episodes, bool watched, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [TOGGLE SEASON]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/list/tv/entry/{id}/season";
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var jsonBody = JsonSerializer.Serialize(new { seasonNum = seasonNum, episodes = episodes, watched = watched }, JsonOptions);
            request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to toggle season watched for TV ID {Id}", logPrefix, id);
            return false;
        }
    }

    /// <summary>
    /// Fetches user active connections via GET /connections?capabilities=...
    /// </summary>
    public virtual async Task<JsonElement?> GetUserConnectionsAsync(string capabilities, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [GET CONNECTIONS]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/connections?capabilities={Uri.EscapeDataString(capabilities)}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to get user connections", logPrefix);
            return null;
        }
    }

    /// <summary>
    /// Searches external connection media via GET /connections/:provider/search?query=...&mediaType=...
    /// </summary>
    public virtual async Task<JsonElement?> SearchConnectionMediaAsync(string provider, string mediaType, string query, string apiKey, string baseUrl)
    {
        var logPrefix = "[Aquila ApiClient] [CONNECTION SEARCH]";
        try
        {
            var cleanBaseUrl = CleanBaseUrl(baseUrl);
            var url = $"{cleanBaseUrl}/connections/{provider}/search?query={Uri.EscapeDataString(query)}&mediaType={Uri.EscapeDataString(mediaType)}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Add("x-api-key", apiKey);

            var response = await _httpClient.SendAsync(request).ConfigureAwait(false);
            var json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode) return null;

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "{LogPrefix} Failed to search connection media for provider {Provider}", logPrefix, provider);
            return null;
        }
    }

    private static string CleanBaseUrl(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl)) return "https://api.runerra.org";
        var clean = baseUrl.TrimEnd('/');
        if (clean.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            clean = clean.Substring(0, clean.Length - 4);
        }
        return clean;
    }
}
