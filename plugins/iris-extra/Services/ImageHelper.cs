using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;

namespace IrisTracker.Services;

public static class ImageHelper
{
    private static readonly HttpClient HttpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(10)
    };

    private static readonly ConcurrentDictionary<string, Bitmap> Cache = new();

    public static async Task<Bitmap?> LoadFromWebAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        if (Cache.TryGetValue(url, out var cached))
        {
            return cached;
        }

        try
        {
            var bytes = await HttpClient.GetByteArrayAsync(url);
            using var stream = new MemoryStream(bytes);
            var bitmap = new Bitmap(stream);
            Cache[url] = bitmap;
            return bitmap;
        }
        catch
        {
            return null;
        }
    }
}
