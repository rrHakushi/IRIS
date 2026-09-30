using System;
using System.Collections.Generic;
using System.Linq;

namespace IrisTracker.Models;

public class UserAccount
{
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? UserEmail { get; set; }
    public string? EncryptedToken { get; set; }
    public string ApiBaseUrl { get; set; } = "http://localhost:4000";
    public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;

    public string DisplayText => string.IsNullOrWhiteSpace(UserEmail)
        ? Username
        : $"{Username} ({UserEmail})";
}

public class AppSettings
{
    public string ApiBaseUrl { get; set; } = "http://localhost:4000";
    public string? EncryptedToken { get; set; }
    public string? UserId { get; set; }
    public string? Username { get; set; }
    public string? UserEmail { get; set; }

    public List<UserAccount> Accounts { get; set; } = new();
    public string? ActiveUserId { get; set; }
    
    public bool StartWithWindows { get; set; } = false;
    public bool MinimizeToTrayOnClose { get; set; } = true;
    public bool NotifyOnHourIncrement { get; set; } = true;
    public int PollingIntervalSeconds { get; set; } = 1;

    /// <summary>
    /// Ensures migration from legacy single-user settings to Accounts list.
    /// </summary>
    public void EnsureAccountsMigrated()
    {
        if (Accounts == null) Accounts = new List<UserAccount>();

        if (Accounts.Count == 0 && !string.IsNullOrEmpty(Username) && !string.IsNullOrEmpty(EncryptedToken))
        {
            var uid = UserId ?? Username;
            Accounts.Add(new UserAccount
            {
                UserId = uid,
                Username = Username,
                UserEmail = UserEmail,
                EncryptedToken = EncryptedToken,
                ApiBaseUrl = ApiBaseUrl,
                LastActiveAt = DateTime.UtcNow
            });
            ActiveUserId = uid;
        }

        // Validate ActiveUserId exists in accounts
        if (!string.IsNullOrEmpty(ActiveUserId) && Accounts.All(a => a.UserId != ActiveUserId))
        {
            ActiveUserId = Accounts.FirstOrDefault()?.UserId;
        }

        if (string.IsNullOrEmpty(ActiveUserId) && Accounts.Count > 0)
        {
            ActiveUserId = Accounts[0].UserId;
        }

        // Sync legacy fields with current active account
        var active = GetActiveAccount();
        if (active != null)
        {
            UserId = active.UserId;
            Username = active.Username;
            UserEmail = active.UserEmail;
            EncryptedToken = active.EncryptedToken;
            ApiBaseUrl = active.ApiBaseUrl;
        }
    }

    public UserAccount? GetActiveAccount()
    {
        if (string.IsNullOrEmpty(ActiveUserId))
        {
            return Accounts.FirstOrDefault();
        }
        return Accounts.FirstOrDefault(a => a.UserId == ActiveUserId) ?? Accounts.FirstOrDefault();
    }
}
