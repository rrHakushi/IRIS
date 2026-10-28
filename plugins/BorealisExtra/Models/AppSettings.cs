using System;

namespace BorealisExtra.Models;

public class AppSettings
{
    public string ApiBaseUrl { get; set; } = "http://localhost:4000";
    public string? EncryptedToken { get; set; }
    public string? UserId { get; set; }
    public string? Username { get; set; }
    public string? UserEmail { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? AvatarFrameUrl { get; set; }
    public string? NameplateUrl { get; set; }

    public bool StartOnStartup { get; set; } = false;
    public bool NotifyOnHourIncrement { get; set; } = true;
    public int PollingIntervalSeconds { get; set; } = 1;
}
