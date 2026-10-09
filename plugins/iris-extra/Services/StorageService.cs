using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
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
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            _baseDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "IRIS",
                "IrisTracker"
            );
        }
        else
        {
            string configHome = Environment.GetEnvironmentVariable("XDG_CONFIG_HOME")
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config");
            _baseDir = Path.Combine(configHome, "IRIS", "IrisTracker");
        }

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
                    return settings;
                }
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
            RestrictFilePermissions(_settingsPath);
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
            RestrictFilePermissions(_entriesPath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] Failed to save entries: {ex.Message}");
        }
    }

    private static void RestrictFilePermissions(string path)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            try
            {
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }
            catch { }
        }
    }

    private static byte[] GetEncryptionKey()
    {
        string machineId = string.Empty;
        if (File.Exists("/etc/machine-id"))
        {
            try { machineId = File.ReadAllText("/etc/machine-id").Trim(); } catch { }
        }
        else if (File.Exists("/var/lib/dbus/machine-id"))
        {
            try { machineId = File.ReadAllText("/var/lib/dbus/machine-id").Trim(); } catch { }
        }

        if (string.IsNullOrEmpty(machineId))
        {
            machineId = Environment.MachineName;
        }

        string user = Environment.UserName;
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string seed = $"IRIS_SALT_{machineId}_{user}_{home}_TOKEN_KEY";

        using var sha = SHA256.Create();
        return sha.ComputeHash(Encoding.UTF8.GetBytes(seed));
    }

    public static string? ProtectString(string? plainText)
    {
        if (string.IsNullOrEmpty(plainText)) return null;
        try
        {
            byte[] key = GetEncryptionKey();
            using var aes = Aes.Create();
            aes.Key = key;
            aes.GenerateIV();

            using var ms = new MemoryStream();
            ms.Write(aes.IV, 0, aes.IV.Length);

            using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
            using (var sw = new StreamWriter(cs, Encoding.UTF8))
            {
                sw.Write(plainText);
            }

            return Convert.ToBase64String(ms.ToArray());
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StorageService] ProtectString error: {ex.Message}");
            return plainText;
        }
    }

    public static string? UnprotectString(string? cipherText)
    {
        if (string.IsNullOrEmpty(cipherText)) return null;
        try
        {
            byte[] buffer = Convert.FromBase64String(cipherText);
            byte[] key = GetEncryptionKey();

            using var aes = Aes.Create();
            aes.Key = key;

            byte[] iv = new byte[aes.BlockSize / 8];
            Array.Copy(buffer, 0, iv, 0, iv.Length);
            aes.IV = iv;

            using var ms = new MemoryStream(buffer, iv.Length, buffer.Length - iv.Length);
            using var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Read);
            using var sr = new StreamReader(cs, Encoding.UTF8);

            return sr.ReadToEnd();
        }
        catch
        {
            return cipherText;
        }
    }
}
