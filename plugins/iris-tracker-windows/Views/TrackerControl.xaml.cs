using System;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class TrackerControl : System.Windows.Controls.UserControl
{
    private readonly ProcessTrackerService _tracker;
    private readonly IrisApiClient _api;
    private readonly StorageService _storage;
    private readonly AppSettings _settings;
    private bool _isSectionCollapsed = false;

    public event Action? LoggedOut;

    public TrackerControl(ProcessTrackerService tracker, IrisApiClient api, StorageService storage)
    {
        InitializeComponent();
        _tracker = tracker;
        _api = api;
        _storage = storage;
        _settings = _storage.LoadSettings();

        TxtUsername.Text = _settings.Username ?? "User";

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

    private void BtnToggleSection_Click(object sender, RoutedEventArgs e)
    {
        _isSectionCollapsed = !_isSectionCollapsed;
        ItemsGamesList.Visibility = _isSectionCollapsed ? Visibility.Collapsed : Visibility.Visible;
        TxtChevronIcon.Text = _isSectionCollapsed ? "›" : "⌵";
    }

    private void GameCard_Click(object sender, MouseButtonEventArgs e)
    {
        // Don't trigger if the click originated on a button inside the card
        if (e.OriginalSource is DependencyObject dep)
        {
            var btn = FindVisualParent<Button>(dep);
            if (btn != null) return;
        }

        if (sender is FrameworkElement el && el.Tag is LinkedProcessEntry entry)
        {
            OpenEditModal(entry);
        }
    }

    private void OpenEditModal(LinkedProcessEntry entry)
    {
        var win = new GameEditModalWindow(
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
        )
        {
            Owner = Window.GetWindow(this)
        };
        win.ShowDialog();
    }

    private void BtnCardPauseToggle_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
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
            UpdateOfflineBanner();
        });
    }

    private void OnSyncSucceeded(LinkedProcessEntry entry, string message)
    {
        Dispatcher.Invoke(() =>
        {
            UpdateOfflineBanner();
        });
    }

    private void OnSyncFailed(LinkedProcessEntry entry, Exception ex)
    {
        Dispatcher.Invoke(() =>
        {
            UpdateOfflineBanner();
        });
    }

    private void BtnLinkGame_Click(object sender, RoutedEventArgs e)
    {
        var settings = _storage.LoadSettings();
        var win = new LinkGameWindow(_api, settings.Username ?? string.Empty, settings.UserId)
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
        await _tracker.SyncPendingIncrementsAsync();
        await RefreshProgressFromIrisAsync();
        UpdateOfflineBanner();
    }

    private void BtnSettings_Click(object sender, RoutedEventArgs e)
    {
        var win = new SettingsWindow(_storage, _api)
        {
            Owner = Window.GetWindow(this)
        };
        win.ShowDialog();
    }

    private void BtnLogout_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(
            Window.GetWindow(this),
            $"Are you sure you want to log out of '{_settings.Username}'?",
            "Confirm Logout",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
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

    private static T? FindVisualParent<T>(DependencyObject? child) where T : DependencyObject
    {
        while (child != null)
        {
            if (child is T parent) return parent;
            child = System.Windows.Media.VisualTreeHelper.GetParent(child);
        }
        return null;
    }
}
