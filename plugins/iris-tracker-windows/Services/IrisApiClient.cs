using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using IrisTracker.Models;

namespace IrisTracker.Services;

public class IrisApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _http;
    private string _baseUrl = "http://localhost:3000";
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

    public IrisApiClient(string? baseUrl = null, string? authToken = null)
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
        var url = $"{BaseUrl}/auth/login";
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
            try
            {
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("message", out var msg))
                {
                    throw new Exception(msg.GetString());
                }
            }
            catch when (!json.Contains("message")) { }

            throw new HttpRequestException($"Login failed with status {response.StatusCode}: {json}");
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
        var url = $"{BaseUrl}/auth/email/verify";
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
            try
            {
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("message", out var msg))
                {
                    throw new Exception(msg.GetString());
                }
            }
            catch when (!json.Contains("message")) { }

            throw new HttpRequestException($"MFA verification failed: {json}");
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
        var url = $"{BaseUrl}/auth/email/send";
        var payload = JsonSerializer.Serialize(new MfaSendEmailRequest { MfaTicket = mfaTicket });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        response.EnsureSuccessStatusCode();
    }

    public async Task<QuickConnectGenerateResponse> QuickConnectGenerateAsync(string deviceName = "Windows Game Tracker")
    {
        var url = $"{BaseUrl}/auth/quickconnect/generate";
        var payload = JsonSerializer.Serialize(new QuickConnectGenerateRequest { DeviceName = deviceName });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<QuickConnectGenerateResponse>(json, JsonOptions);
        return result ?? throw new Exception("Failed to generate quick connect session");
    }

    public async Task<QuickConnectStatusResponse> QuickConnectCheckStatusAsync(string sessionToken)
    {
        var url = $"{BaseUrl}/auth/quickconnect/status?sessionToken={Uri.EscapeDataString(sessionToken)}";
        var response = await _http.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<QuickConnectStatusResponse>(json, JsonOptions);
        if (result?.Token != null)
        {
            AuthToken = result.Token;
        }
        return result ?? throw new Exception("Failed to check quick connect status");
    }

    public async Task<UserGameListResponse> GetUserGameListAsync(string username)
    {
        var url = $"{BaseUrl}/user/{Uri.EscapeDataString(username)}/lists/game?limit=100";
        var response = await _http.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<UserGameListResponse>(json, JsonOptions) ?? new UserGameListResponse();
    }

    public async Task<SearchGamesResponse> SearchGamesAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 3)
        {
            return new SearchGamesResponse { Success = true, Data = [] };
        }

        var url = $"{BaseUrl}/search/games?q={Uri.EscapeDataString(query.Trim())}";
        var response = await _http.GetAsync(url);
        if (!response.IsSuccessStatusCode)
        {
            return new SearchGamesResponse { Success = false, Data = [] };
        }

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<SearchGamesResponse>(json, JsonOptions) ?? new SearchGamesResponse();
    }

    public async Task<IncrementResponse> IncrementGameProgressAsync(string username, int gameId, int count = 1)
    {
        var url = $"{BaseUrl}/user/{Uri.EscapeDataString(username)}/lists/game/{gameId}/increment";
        var payload = JsonSerializer.Serialize(new IncrementRequest { Count = count });

        using var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(url, content);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Increment failed: {response.StatusCode} - {json}");
        }

        return JsonSerializer.Deserialize<IncrementResponse>(json, JsonOptions)
            ?? throw new Exception("Invalid response from increment endpoint");
    }

    public async Task<GameMutationResponse> UpdateGameListEntryAsync(string username, int gameId, GameListEntryMutationRequest payload)
    {
        var url = $"{BaseUrl}/user/{Uri.EscapeDataString(username)}/lists/game/{gameId}";
        var jsonPayload = JsonSerializer.Serialize(payload, JsonOptions);

        using var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
        var response = await _http.PutAsync(url, content);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            try
            {
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("message", out var msg))
                {
                    throw new Exception(msg.GetString());
                }
            }
            catch when (!json.Contains("message")) { }

            throw new HttpRequestException($"Updating game failed with status {response.StatusCode}: {json}");
        }

        return JsonSerializer.Deserialize<GameMutationResponse>(json, JsonOptions)
            ?? throw new Exception("Invalid response from update endpoint");
    }

    public async Task<SimpleApiResponse> DeleteGameFromListAsync(string username, int gameId)
    {
        var url = $"{BaseUrl}/user/{Uri.EscapeDataString(username)}/lists/game/{gameId}";
        var response = await _http.DeleteAsync(url);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            try
            {
                var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("message", out var msg))
                {
                    throw new Exception(msg.GetString());
                }
            }
            catch when (!json.Contains("message")) { }

            throw new HttpRequestException($"Delete failed with status {response.StatusCode}: {json}");
        }

        return JsonSerializer.Deserialize<SimpleApiResponse>(json, JsonOptions)
            ?? new SimpleApiResponse { Success = true };
    }
}
