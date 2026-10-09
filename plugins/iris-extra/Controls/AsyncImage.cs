using System;
using Avalonia;
using Avalonia.Controls;
using IrisTracker.Services;

namespace IrisTracker.Controls;

public class AsyncImage : Image
{
    public static readonly StyledProperty<string?> UrlProperty =
        AvaloniaProperty.Register<AsyncImage, string?>(nameof(Url));

    public string? Url
    {
        get => GetValue(UrlProperty);
        set => SetValue(UrlProperty, value);
    }

    protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
    {
        base.OnPropertyChanged(change);
        if (change.Property == UrlProperty)
        {
            LoadImageAsync(change.GetNewValue<string?>());
        }
    }

    private async void LoadImageAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            Source = null;
            return;
        }

        try
        {
            var bitmap = await ImageHelper.LoadFromWebAsync(url);
            if (Url == url)
            {
                Source = bitmap;
            }
        }
        catch
        {
            Source = null;
        }
    }
}
