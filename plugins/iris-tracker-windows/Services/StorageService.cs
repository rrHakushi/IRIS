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
                return settings ?? new AppSettings();
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
                return entries ?? new List<LinkedProcessEntry>();
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
            var json = JsonSerializer.Serialize(entries, JsonOptions);
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
