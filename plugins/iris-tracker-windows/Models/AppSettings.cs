using System;
using System.Text.Json.Serialization;

namespace IrisTracker.Models;

public class AppSettings
{
    public string ApiBaseUrl { get; set; } = "http://localhost:3000";
    public string? EncryptedToken { get; set; }
    public string? UserId { get; set; }
    public string? Username { get; set; }
    public string? UserEmail { get; set; }

    public bool StartWithWindows { get; set; } = false;
    public bool MinimizeToTrayOnClose { get; set; } = true;
    public bool StartInTray { get; set; } = false;
    public int PollingIntervalSeconds { get; set; } = 1;
}
