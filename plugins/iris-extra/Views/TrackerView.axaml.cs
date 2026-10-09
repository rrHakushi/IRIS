using System;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class TrackerView : UserControl
{
    private readonly ProcessTrackerService _tracker;
    private readonly IrisApiClient _api;
    private readonly StorageService _storage;
    private AppSettings _settings;

    public event Action? LoggedOut;

    public TrackerView() : this(new ProcessTrackerService(new StorageService(), new IrisApiClient()), new IrisApiClient(), new StorageService())
    {
    }

    public TrackerView(ProcessTrackerService tracker, IrisApiClient api, StorageService storage)
    {
        InitializeComponent();
        _tracker = tracker;
        _api = api;
        _storage = storage;
        _settings = _storage.LoadSettings();

        TxtLoggedInUser.Text = $"@{_settings.Username ?? "user"}";

        ItemsGamesList.ItemsSource = _tracker.Entries;
        _tracker.Entries.CollectionChanged += OnEntriesCollectionChanged;
        UpdateEmptyState();

        _tracker.HourIncremented += OnHourIncremented;
        _tracker.SyncSucceeded += OnSyncSucceeded;
        _tracker.SyncFailed += OnSyncFailed;

        AttachedToVisualTree += (s, e) =>
        {
            _tracker.Start();
            _ = RefreshProgressFromIrisAsync();
        };
    }

    private void GameCard_PointerPressed(object? sender, PointerPressedEventArgs e)
    {
        // Don't trigger if click was on a button inside the card
        if (e.Source is Control control)
        {
            var parent = control;
            while (parent != null)
            {
                if (parent is Button) return;
                parent = parent.Parent as Control;
            }
        }

        if (sender is Border border && border.DataContext is LinkedProcessEntry entry)
        {
            OpenEditModal(entry);
        }
    }

    private async void OpenEditModal(LinkedProcessEntry entry)
    {
        var topLevel = TopLevel.GetTopLevel(this) as Window;
        var modal = new GameEditModalWindow(
            entry,
            _api,
            _settings.Username ?? string.Empty,
            onEntryUpdated: () =>
            {
                _tracker.SaveNow();
                UpdateEmptyState();
            },
            onUnlinkRequested: (toUnlink) =>
            {
                _tracker.RemoveEntry(toUnlink);
                UpdateEmptyState();
            }
        );

        if (topLevel != null)
        {
            await modal.ShowDialog(topLevel);
        }
    }

    private void BtnCardPauseToggle_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is LinkedProcessEntry entry)
        {
            entry.IsPaused = !entry.IsPaused;
            _tracker.SaveNow();
        }
    }

    private async Task RefreshProgressFromIrisAsync()
    {
        var settings = _storage.LoadSettings();
        if (string.IsNullOrEmpty(settings.Username) || string.IsNullOrEmpty(_api.AuthToken)) return;

        try
        {
            var res = await _api.GetUserGameListAsync(settings.Username);
            var lookup = res.Items.Where(i => i?.Entry != null).ToDictionary(i => i.GameId, i => i);

            foreach (var entry in _tracker.Entries)
            {
                if (lookup.TryGetValue(entry.GameId, out var item))
                {
                    entry.IrisProgressHours = item.ProgressHours;
                    entry.Score = item.Score;
                    entry.Status = item.Status;
                    entry.Notes = item.Notes;
                    entry.Replayed = item.Replayed;
                    entry.StartedAt = item.StartedAt;
                    entry.CompletedAt = item.CompletedAt;
                    if (!string.IsNullOrEmpty(item.CoverImage)) entry.CoverImage = item.CoverImage;
                    if (!string.IsNullOrEmpty(item.BannerImage)) entry.BannerImage = item.BannerImage;
                }
            }
            _tracker.SaveNow();
        }
        catch
        {
            // Transient offline; retain local count
        }
    }

    private void OnEntriesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        UpdateEmptyState();
        UpdateOfflineBanner();
    }

    private void UpdateEmptyState()
    {
        int count = _tracker.Entries.Count;
        TxtGamesCountBadge.Text = count.ToString();

        bool hasGames = count > 0;
        CardEmptyState.IsVisible = !hasGames;
        ScrollGamesList.IsVisible = hasGames;
        UpdateOfflineBanner();
    }

    private void UpdateOfflineBanner()
    {
        var pendingTotal = _tracker.Entries.Sum(e => e.PendingSyncHours);
        if (pendingTotal > 0)
        {
            BannerOffline.IsVisible = true;
            TxtOfflineStatus.Text = $"{pendingTotal} offline progress increment(s) queued. Will sync automatically when reachable.";
        }
        else
        {
            BannerOffline.IsVisible = false;
        }
    }

    private void OnHourIncremented(LinkedProcessEntry entry, int totalHours)
    {
        Dispatcher.UIThread.Post(() =>
        {
            UpdateOfflineBanner();
            var currentSettings = _storage.LoadSettings();
            if (currentSettings.NotifyOnHourIncrement)
            {
                DesktopIntegration.ShowNotification(
                    "IRIS Time Tracker",
                    $"Logged +1 hour for {entry.GameTitle}! Total: {totalHours} hrs"
                );
            }
        });
    }

    private void OnSyncSucceeded(LinkedProcessEntry entry, string message)
    {
        Dispatcher.UIThread.Post(UpdateOfflineBanner);
    }

    private void OnSyncFailed(LinkedProcessEntry entry, Exception ex)
    {
        Dispatcher.UIThread.Post(UpdateOfflineBanner);
    }

    private async void BtnLinkGame_Click(object? sender, RoutedEventArgs e)
    {
        var topLevel = TopLevel.GetTopLevel(this) as Window;
        var settings = _storage.LoadSettings();
        var win = new LinkGameWindow(_api, settings.Username ?? string.Empty, settings.UserId);

        if (topLevel != null)
        {
            var result = await win.ShowDialog<bool>(topLevel);
            if (result && win.CreatedEntry != null)
            {
                _tracker.AddEntry(win.CreatedEntry);
                UpdateEmptyState();
            }
        }
    }

    private async void BtnSyncAll_Click(object? sender, RoutedEventArgs e)
    {
        await _tracker.SyncPendingIncrementsAsync();
        await RefreshProgressFromIrisAsync();
        UpdateOfflineBanner();
    }

    private async void BtnSettings_Click(object? sender, RoutedEventArgs e)
    {
        var topLevel = TopLevel.GetTopLevel(this) as Window;
        var win = new SettingsWindow(_storage, _api);
        if (topLevel != null)
        {
            await win.ShowDialog(topLevel);
        }
    }

    private void BtnLogout_Click(object? sender, RoutedEventArgs e)
    {
        var settings = _storage.LoadSettings();
        settings.EncryptedToken = null;
        settings.UserId = null;
        settings.Username = null;
        settings.UserEmail = null;
        _storage.SaveSettings(settings);

        _tracker.Stop();
        _api.AuthToken = null;
        LoggedOut?.Invoke();
    }
}
