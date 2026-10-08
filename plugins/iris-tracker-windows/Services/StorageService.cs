using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IrisTracker.Models;

namespace IrisTracker.Services;

public class StorageService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly string _baseDir;
    private readonly string _settingsPath;
    private readonly string _entriesPath;

    public StorageService()
    {
        _baseDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "IRIS",
            "IrisExtra"
        );

        Directory.CreateDirectory(_baseDir);
        _settingsPath = Path.Combine(_baseDir, "settings.json");
        _entriesPath = Path.Combine(_baseDir, "entries.json");

        MigrateLegacyDataIfNeeded();
    }

    private void MigrateLegacyDataIfNeeded()
    {
        try
        {
            var legacyDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "IRIS",
                "IrisTracker"
            );

            if (Directory.Exists(legacyDir))
            {
                var legacySettings = Path.Combine(legacyDir, "settings.json");
                var legacyEntries = Path.Combine(legacyDir, "entries.json");

                if (!File.Exists(_settingsPath) && File.Exists(legacySettings))
                {
                    File.Copy(legacySettings, _settingsPath, true);
                }

                if (!File.Exists(_entriesPath) && File.Exists(legacyEntries))
                {
                    File.Copy(legacyEntries, _entriesPath, true);
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Migration failed: {ex.Message}");
        }
    }

    public string BaseDirectory => _baseDir;

    public void ResetAllData()
    {
        try
        {
            if (File.Exists(_settingsPath)) File.Delete(_settingsPath);
            if (File.Exists(_entriesPath)) File.Delete(_entriesPath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to reset data: {ex.Message}");
        }
    }

    public AppSettings LoadSettings()
    {
        try
        {
            if (File.Exists(_settingsPath))
            {
                var json = File.ReadAllText(_settingsPath);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var settings = JsonSerializer.Deserialize<AppSettings>(json, JsonOptions) ?? new AppSettings();

                // If loaded from older multi-account config without direct Username/Token, migrate from Accounts list
                if (string.IsNullOrEmpty(settings.Username) && root.TryGetProperty("Accounts", out var accElem) && accElem.ValueKind == JsonValueKind.Array && accElem.GetArrayLength() > 0)
                {
                    string? activeUid = root.TryGetProperty("ActiveUserId", out var uidElem) ? uidElem.GetString() : null;
                    JsonElement chosenAcc = accElem[0];

                    foreach (var acc in accElem.EnumerateArray())
                    {
                        if (acc.TryGetProperty("UserId", out var u) && u.GetString() == activeUid)
                        {
                            chosenAcc = acc;
                            break;
                        }
                    }

                    if (chosenAcc.TryGetProperty("UserId", out var uVal)) settings.UserId = uVal.GetString();
                    if (chosenAcc.TryGetProperty("Username", out var nameVal)) settings.Username = nameVal.GetString();
                    if (chosenAcc.TryGetProperty("UserEmail", out var emailVal)) settings.UserEmail = emailVal.GetString();
                    if (chosenAcc.TryGetProperty("EncryptedToken", out var tokenVal)) settings.EncryptedToken = tokenVal.GetString();
                    if (chosenAcc.TryGetProperty("ApiBaseUrl", out var apiVal)) settings.ApiBaseUrl = apiVal.GetString() ?? settings.ApiBaseUrl;
                }

                return settings;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to load settings: {ex.Message}");
        }

        return new AppSettings();
    }

    public void SaveSettings(AppSettings settings)
    {
        try
        {
            var json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(_settingsPath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to save settings: {ex.Message}");
        }
    }

    public List<LinkedProcessEntry> LoadEntries()
    {
        try
        {
            if (File.Exists(_entriesPath))
            {
                var json = File.ReadAllText(_entriesPath);
                var entries = JsonSerializer.Deserialize<List<LinkedProcessEntry>>(json, JsonOptions);
                if (entries != null)
                {
                    return entries;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to load entries: {ex.Message}");
        }

        return new List<LinkedProcessEntry>();
    }

    public void SaveEntries(IEnumerable<LinkedProcessEntry> entries)
    {
        try
        {
            var list = entries.ToList();
            var json = JsonSerializer.Serialize(list, JsonOptions);
            File.WriteAllText(_entriesPath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to save entries: {ex.Message}");
        }
    }

    public static string? ProtectString(string? plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return null;
        try
        {
            byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
            byte[] encrypted = ProtectedData.Protect(plainBytes, null, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(encrypted);
        }
        catch
        {
            return plainText; // Fallback
        }
    }

    public static string? UnprotectString(string? cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return null;
        try
        {
            byte[] cipherBytes = Convert.FromBase64String(cipherText);
            byte[] decrypted = ProtectedData.Unprotect(cipherBytes, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch
        {
            return cipherText; // Fallback
        }
    }
}
