using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace IrisTracker.Models;

public class IrisUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;
}

public class LoginRequest
{
    [JsonPropertyName("identifier")]
    public string Identifier { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("token")]
    public string? Token { get; set; }

    [JsonPropertyName("user")]
    public IrisUser? User { get; set; }

    [JsonPropertyName("mfaRequired")]
    public bool MfaRequired { get; set; }

    [JsonPropertyName("mfaTicket")]
    public string? MfaTicket { get; set; }

    [JsonPropertyName("allowedMfaTypes")]
    public List<string>? AllowedMfaTypes { get; set; }
}

public class MfaVerifyRequest
{
    [JsonPropertyName("mfaTicket")]
    public string MfaTicket { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("mfaType")]
    public string MfaType { get; set; } = "totp"; // "totp" | "email" | "backup_code"
}

public class MfaSendEmailRequest
{
    [JsonPropertyName("mfaTicket")]
    public string MfaTicket { get; set; } = string.Empty;
}

public class QuickConnectGenerateRequest
{
    [JsonPropertyName("deviceName")]
    public string DeviceName { get; set; } = "Windows Game Tracker";
}

public class QuickConnectGenerateResponse
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("sessionToken")]
    public string SessionToken { get; set; } = string.Empty;

    [JsonPropertyName("qrPayload")]
    public string QrPayload { get; set; } = string.Empty;

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }
}

public class QuickConnectStatusResponse
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty; // "pending" | "approved" | "expired"

    [JsonPropertyName("user")]
    public IrisUser? User { get; set; }

    [JsonPropertyName("token")]
    public string? Token { get; set; }
}

public class GameMediaInfo
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("titlePrimary")]
    public string TitlePrimary { get; set; } = string.Empty;

    [JsonPropertyName("titleSecondary")]
    public string? TitleSecondary { get; set; }

    [JsonPropertyName("coverImage")]
    public string? CoverImage { get; set; }

    [JsonPropertyName("releaseDateYear")]
    public int? ReleaseDateYear { get; set; }

    [JsonIgnore]
    public string DisplayTitle => string.IsNullOrWhiteSpace(TitlePrimary)
        ? (TitleSecondary ?? $"Game #{Id}")
        : TitlePrimary;
}

public class GameListEntryInfo
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("gameId")]
    public int GameId { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("progress")]
    public int Progress { get; set; }
}

public class UserGameListItem
{
    [JsonPropertyName("entry")]
    public GameListEntryInfo Entry { get; set; } = new();

    [JsonPropertyName("media")]
    public GameMediaInfo Media { get; set; } = new();

    [JsonIgnore]
    public int GameId => Entry.GameId > 0 ? Entry.GameId : Media.Id;

    [JsonIgnore]
    public string DisplayTitle => Media.DisplayTitle;

    [JsonIgnore]
    public string? CoverImage => Media.CoverImage;

    [JsonIgnore]
    public int? ReleaseDateYear => Media.ReleaseDateYear;

    [JsonIgnore]
    public int ProgressHours => Entry.Progress;

    [JsonIgnore]
    public string ProgressDisplay => $"{Entry.Progress} hrs in IRIS";
}

public class UserGameListResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("items")]
    public List<UserGameListItem> Items { get; set; } = new();
}

public class SearchGamesResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public List<GameMediaInfo> Data { get; set; } = new();
}

public class IncrementRequest
{
    [JsonPropertyName("count")]
    public int Count { get; set; } = 1;
}

public class IncrementResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("entry")]
    public GameListEntryInfo? Entry { get; set; }
}
