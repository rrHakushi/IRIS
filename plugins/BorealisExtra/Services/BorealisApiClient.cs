using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using BorealisExtra.Models;

namespace BorealisExtra.Services;

public class BorealisApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _http;
    private string _baseUrl = "http://localhost:4000";
    private string? _authToken;

    public string BaseUrl
    {
        get => _baseUrl;
        set => _baseUrl = value.TrimEnd('/');
    }

    public string? AuthToken
    {
        get => _authToken;
        set
        {
            _authToken = value;
            _http.DefaultRequestHeaders.Authorization = !string.IsNullOrEmpty(_authToken)
                ? new AuthenticationHeaderValue("Bearer", _authToken)
                : null;
        }
    }

    public BorealisApiClient(string? baseUrl = null, string? authToken = null)
    {
        _http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(15)
        };
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (!string.IsNullOrEmpty(baseUrl))
        {
            BaseUrl = baseUrl;
        }
        if (!string.IsNullOrEmpty(authToken))
        {
            AuthToken = authToken;
        }
    }

    public async Task<LoginResponse> LoginAsync(string identifier, string password)
    {
        var url = $"{BaseUrl}/carina/auth/login";
        var payload = JsonSerializer.Serialize(new LoginRequest
        {
            Identifier = identifier,
            Password = password
        });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            ExtractAndThrowError(json, $"Login failed with status {response.StatusCode}");
        }

        var result = JsonSerializer.Deserialize<LoginResponse>(json, JsonOptions);
        if (result?.Token != null)
        {
            AuthToken = result.Token;
        }
        return result ?? throw new Exception("Invalid response from server");
    }

    public async Task<LoginResponse> VerifyMfaAsync(string mfaTicket, string code, string mfaType = "totp")
    {
        var url = $"{BaseUrl}/carina/auth/twofactor/email/verify";
        var payload = JsonSerializer.Serialize(new MfaVerifyRequest
        {
            MfaTicket = mfaTicket,
            Code = code.Trim(),
            MfaType = mfaType
        });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            ExtractAndThrowError(json, "MFA verification failed");
        }

        var result = JsonSerializer.Deserialize<LoginResponse>(json, JsonOptions);
        if (result?.Token != null)
        {
            AuthToken = result.Token;
        }
        return result ?? throw new Exception("Invalid response from MFA endpoint");
    }

    public async Task SendMfaEmailAsync(string mfaTicket)
    {
        var url = $"{BaseUrl}/carina/auth/twofactor/email/send";
        var payload = JsonSerializer.Serialize(new MfaSendEmailRequest { MfaTicket = mfaTicket });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        if (!response.IsSuccessStatusCode)
        {
            var json = await response.Content.ReadAsStringAsync();
            ExtractAndThrowError(json, "Failed to send MFA email");
        }
    }

    public async Task<QuickConnectGenerateResponse> QuickConnectGenerateAsync(string deviceName = "Borealis Extra")
    {
        var url = $"{BaseUrl}/carina/auth/qc/generate";
        var payload = JsonSerializer.Serialize(new QuickConnectGenerateRequest { DeviceName = deviceName });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        if (!response.IsSuccessStatusCode)
        {
            var errJson = await response.Content.ReadAsStringAsync();
            ExtractAndThrowError(errJson, "Failed to generate quick connect session");
        }

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<QuickConnectGenerateResponse>(json, JsonOptions);
        return result ?? throw new Exception("Failed to generate quick connect session");
    }

    public async Task<QuickConnectStatusResponse> QuickConnectCheckStatusAsync(string sessionToken)
    {
        var url = $"{BaseUrl}/carina/auth/qc/status?sessionToken={Uri.EscapeDataString(sessionToken)}";
        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            var errJson = await response.Content.ReadAsStringAsync();
            ExtractAndThrowError(errJson, "Failed to check quick connect status");
        }

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<QuickConnectStatusResponse>(json, JsonOptions);
        if (result?.Token != null)
        {
            AuthToken = result.Token;
        }
        return result ?? throw new Exception("Failed to check quick connect status");
    }

    public async Task<CurrentUserResponse?> GetCurrentUserAsync()
    {
        var url = $"{BaseUrl}/carina/users/me";
        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<CurrentUserResponse>(json, JsonOptions);
    }

    public async Task<UserGameListResponse> GetUserGameListAsync(string? username = null, string? query = null, int limit = 250, int page = 1)
    {
        var urlBuilder = new StringBuilder($"{BaseUrl}/borealis/lists/games?limit={limit}&page={page}");
        if (!string.IsNullOrWhiteSpace(query))
        {
            urlBuilder.Append($"&q={Uri.EscapeDataString(query.Trim())}");
        }

        var url = urlBuilder.ToString();
        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            var errJson = await response.Content.ReadAsStringAsync();
            ExtractAndThrowError(errJson, "Failed to fetch games list");
        }

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<UserGameListResponse>(json, JsonOptions) ?? new UserGameListResponse();
    }

    public async Task<SearchGamesResponse> SearchGamesAsync(string query, bool external = true)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 1)
        {
            return new SearchGamesResponse { Success = true };
        }

        var url = $"{BaseUrl}/borealis/search?q={Uri.EscapeDataString(query.Trim())}&category=games&limit=30&external={external.ToString().ToLowerInvariant()}";
        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            return new SearchGamesResponse { Success = false };
        }

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<SearchGamesResponse>(json, JsonOptions) ?? new SearchGamesResponse();
    }

    public async Task<bool> UpsertGameListEntryAsync(int gameId, UpsertGameRequest request)
    {
        var url = $"{BaseUrl}/borealis/lists/games/{gameId}";
        var payload = JsonSerializer.Serialize(request, JsonOptions);
        using var content = new StringContent(payload, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync(url, content);
        return response.IsSuccessStatusCode;
    }

    public async Task<IncrementResponse> IncrementGameProgressAsync(string username, int gameId, int count = 1)
    {
        var url = $"{BaseUrl}/borealis/lists/games/{gameId}/increment";
        var payload = JsonSerializer.Serialize(new IncrementRequest { Count = count });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            ExtractAndThrowError(json, $"Increment failed with status {response.StatusCode}");
        }

        return JsonSerializer.Deserialize<IncrementResponse>(json, JsonOptions)
            ?? throw new Exception("Invalid response from increment endpoint");
    }

    private static void ExtractAndThrowError(string json, string defaultMessage)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.String)
            {
                throw new Exception(detail.GetString());
            }
            if (doc.RootElement.TryGetProperty("message", out var msg) && msg.ValueKind == JsonValueKind.String)
            {
                throw new Exception(msg.GetString());
            }
            if (doc.RootElement.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String)
            {
                throw new Exception(title.GetString());
            }
        }
        catch (Exception ex) when (ex is not HttpRequestException && ex.Message != defaultMessage && !ex.Message.Contains("JSON"))
        {
            throw;
        }

        throw new HttpRequestException($"{defaultMessage}: {json}");
    }
}
