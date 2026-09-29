using System;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class TrackerControl : System.Windows.Controls.UserControl
{
    private readonly ProcessTrackerService _tracker;
    private readonly IrisApiClient _api;
    private readonly StorageService _storage;
    private readonly AppSettings _settings;

    public event Action? LoggedOut;
    public event Action<string, string>? ShowNotification;

    public TrackerControl(ProcessTrackerService tracker, IrisApiClient api, StorageService storage)
    {
        InitializeComponent();
        _tracker = tracker;
        _api = api;
        _storage = storage;
        _settings = _storage.LoadSettings();

        TxtUsername.Text = _settings.Username ?? "User";
        TxtServerUrl.Text = _api.BaseUrl;

        ItemsGamesList.ItemsSource = _tracker.Entries;
        _tracker.Entries.CollectionChanged += OnEntriesCollectionChanged;
        UpdateEmptyState();

        _tracker.HourIncremented += OnHourIncremented;
        _tracker.SyncSucceeded += OnSyncSucceeded;
        _tracker.SyncFailed += OnSyncFailed;

        Loaded += (s, e) =>
        {
            _tracker.Start();
            _ = RefreshProgressFromIrisAsync();
        };
    }

    private async Task RefreshProgressFromIrisAsync()
    {
        if (string.IsNullOrEmpty(_settings.Username) || string.IsNullOrEmpty(_api.AuthToken)) return;

        try
        {
            var res = await _api.GetUserGameListAsync(_settings.Username);
            var lookup = new System.Collections.Generic.Dictionary<int, int>();
            foreach (var item in res.Items)
            {
                lookup[item.GameId] = item.ProgressHours;
            }

            foreach (var entry in _tracker.Entries)
            {
                if (lookup.TryGetValue(entry.GameId, out var currentHours))
                {
                    entry.IrisProgressHours = currentHours;
                }
            }
            _storage.SaveEntries(_tracker.Entries);
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
        bool hasGames = _tracker.Entries.Count > 0;
        CardEmptyState.Visibility = hasGames ? Visibility.Collapsed : Visibility.Visible;
        ScrollGamesList.Visibility = hasGames ? Visibility.Visible : Visibility.Collapsed;
        UpdateOfflineBanner();
    }

    private void UpdateOfflineBanner()
    {
        var pendingTotal = _tracker.Entries.Sum(e => e.PendingSyncHours);
        if (pendingTotal > 0)
        {
            BannerOffline.Visibility = Visibility.Visible;
            TxtOfflineStatus.Text = $"{pendingTotal} offline progress increment(s) queued. Will sync automatically when reachable.";
        }
        else
        {
            BannerOffline.Visibility = Visibility.Collapsed;
        }
    }

    private void OnHourIncremented(LinkedProcessEntry entry, int totalHours)
    {
        Dispatcher.Invoke(() =>
        {
            TxtFooterStatus.Text = $"Recorded +1 hour for '{entry.GameTitle}' (Total: {totalHours}h).";
            UpdateOfflineBanner();
            ShowNotification?.Invoke(
                "IRIS Playtime Updated",
                $"Recorded +1 hour for {entry.GameTitle}! Total: {totalHours}h"
            );
        });
    }

    private void OnSyncSucceeded(LinkedProcessEntry entry, string message)
    {
        Dispatcher.Invoke(() =>
        {
            TxtFooterStatus.Text = $"{message} for '{entry.GameTitle}'.";
            UpdateOfflineBanner();
        });
    }

    private void OnSyncFailed(LinkedProcessEntry entry, Exception ex)
    {
        Dispatcher.Invoke(() =>
        {
            TxtFooterStatus.Text = $"Sync deferred for '{entry.GameTitle}': {ex.Message}";
            UpdateOfflineBanner();
        });
    }

    private void BtnLinkGame_Click(object sender, RoutedEventArgs e)
    {
        var win = new LinkGameWindow(_api, _settings.Username ?? string.Empty)
        {
            Owner = Window.GetWindow(this)
        };

        if (win.ShowDialog() == true && win.CreatedEntry != null)
        {
            _tracker.AddEntry(win.CreatedEntry);
            UpdateEmptyState();
        }
    }

    private async void BtnSyncAll_Click(object sender, RoutedEventArgs e)
    {
        TxtFooterStatus.Text = "Syncing with IRIS...";
        await _tracker.SyncPendingIncrementsAsync();
        await RefreshProgressFromIrisAsync();
        UpdateOfflineBanner();
        TxtFooterStatus.Text = "Sync completed.";
    }

    private void BtnSettings_Click(object sender, RoutedEventArgs e)
    {
        var win = new SettingsWindow(_storage, _api)
        {
            Owner = Window.GetWindow(this)
        };
        win.ShowDialog();
        TxtServerUrl.Text = _api.BaseUrl;
    }

    private void BtnLogout_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(
            Window.GetWindow(this),
            "Are you sure you want to log out of IRIS Tracker?",
            "Confirm Logout",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
        {
            _tracker.Stop();
            _settings.EncryptedToken = null;
            _settings.UserId = null;
            _settings.Username = null;
            _settings.UserEmail = null;
            _storage.SaveSettings(_settings);
            _api.AuthToken = null;

            LoggedOut?.Invoke();
        }
    }

    private void BtnTogglePause_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is LinkedProcessEntry entry)
        {
            entry.IsPaused = !entry.IsPaused;
            _storage.SaveEntries(_tracker.Entries);
            TxtFooterStatus.Text = entry.IsPaused
                ? $"Paused tracking for '{entry.GameTitle}'."
                : $"Resumed tracking for '{entry.GameTitle}'.";
        }
    }

    private async void BtnForceHour_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is LinkedProcessEntry entry)
        {
            entry.IrisProgressHours++;
            entry.PendingSyncHours++;
            _storage.SaveEntries(_tracker.Entries);
            UpdateOfflineBanner();

            await _tracker.SyncEntryAsync(entry);
        }
    }

    private void BtnResetTimer_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is LinkedProcessEntry entry)
        {
            entry.AccumulatedSeconds = 0;
            _storage.SaveEntries(_tracker.Entries);
        }
    }

    private void BtnUnlink_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is LinkedProcessEntry entry)
        {
            var res = MessageBox.Show(
                Window.GetWindow(this),
                $"Unlink '{entry.GameTitle}' ({entry.ExecutableName})? Playtime will no longer be tracked for this executable.",
                "Confirm Unlink",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question
            );

            if (res == MessageBoxResult.Yes)
            {
                _tracker.RemoveEntry(entry);
                UpdateEmptyState();
            }
        }
    }
}
