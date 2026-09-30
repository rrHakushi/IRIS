using System;
using System.Collections.Generic;
using System.IO;
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
            "IrisTracker"
        );

        Directory.CreateDirectory(_baseDir);
        _settingsPath = Path.Combine(_baseDir, "settings.json");
        _entriesPath = Path.Combine(_baseDir, "entries.json");
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
                var settings = JsonSerializer.Deserialize<AppSettings>(json, JsonOptions);
                if (settings != null)
                {
                    settings.EnsureAccountsMigrated();
                    return settings;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to load settings: {ex.Message}");
        }

        var fallback = new AppSettings();
        fallback.EnsureAccountsMigrated();
        return fallback;
    }

    public void SaveSettings(AppSettings settings)
    {
        try
        {
            settings.EnsureAccountsMigrated();
            var json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(_settingsPath, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to save settings: {ex.Message}");
        }
    }

    public void AddOrUpdateAccount(AppSettings settings, UserAccount account)
    {
        var existing = settings.Accounts.Find(a =>
            (!string.IsNullOrEmpty(a.UserId) && a.UserId == account.UserId) ||
            a.Username.Equals(account.Username, StringComparison.OrdinalIgnoreCase));

        if (existing != null)
        {
            existing.UserId = account.UserId;
            existing.Username = account.Username;
            existing.UserEmail = account.UserEmail;
            existing.EncryptedToken = account.EncryptedToken;
            existing.ApiBaseUrl = account.ApiBaseUrl;
            existing.LastActiveAt = DateTime.UtcNow;
        }
        else
        {
            settings.Accounts.Add(account);
        }

        settings.ActiveUserId = account.UserId;
        settings.EnsureAccountsMigrated();
        SaveSettings(settings);
    }

    public void RemoveAccount(AppSettings settings, string userId)
    {
        settings.Accounts.RemoveAll(a => a.UserId == userId);
        if (settings.ActiveUserId == userId)
        {
            settings.ActiveUserId = settings.Accounts.Count > 0 ? settings.Accounts[0].UserId : null;
        }
        settings.EnsureAccountsMigrated();
        SaveSettings(settings);
    }

    public void SwitchAccount(AppSettings settings, string userId)
    {
        var acc = settings.Accounts.Find(a => a.UserId == userId);
        if (acc != null)
        {
            acc.LastActiveAt = DateTime.UtcNow;
            settings.ActiveUserId = userId;
            settings.EnsureAccountsMigrated();
            SaveSettings(settings);
        }
    }

    public List<LinkedProcessEntry> LoadEntries(string? userId = null)
    {
        try
        {
            if (File.Exists(_entriesPath))
            {
                var json = File.ReadAllText(_entriesPath);
                var entries = JsonSerializer.Deserialize<List<LinkedProcessEntry>>(json, JsonOptions);
                if (entries != null)
                {
                    if (string.IsNullOrEmpty(userId))
                    {
                        return entries;
                    }
                    return entries.Where(e => string.IsNullOrEmpty(e.UserId) || e.UserId == userId).ToList();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to load entries: {ex.Message}");
        }

        return new List<LinkedProcessEntry>();
    }

    public void SaveEntries(IEnumerable<LinkedProcessEntry> entries, string? activeUserId = null)
    {
        try
        {
            var existing = LoadEntries(null);
            var currentList = entries.ToList();
            var currentIds = new HashSet<string>(currentList.Select(e => e.Id));

            // Merge: Keep entries belonging to other accounts
            var merged = new List<LinkedProcessEntry>(currentList);
            foreach (var item in existing)
            {
                if (!currentIds.Contains(item.Id))
                {
                    if (!string.IsNullOrEmpty(activeUserId) && item.UserId != activeUserId)
                    {
                        merged.Add(item);
                    }
                    else if (string.IsNullOrEmpty(activeUserId))
                    {
                        // No active user filter; keep all
                        merged.Add(item);
                    }
                }
            }

            var json = JsonSerializer.Serialize(merged, JsonOptions);
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
