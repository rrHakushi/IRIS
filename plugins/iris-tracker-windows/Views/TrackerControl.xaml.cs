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
    public event Action? RequestAddAccount;
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

    private void BtnAccountMenu_Click(object sender, RoutedEventArgs e)
    {
        var settings = _storage.LoadSettings();
        var menu = new ContextMenu();

        var header = new MenuItem
        {
            Header = "ACCOUNTS",
            IsEnabled = false,
            Foreground = (System.Windows.Media.Brush)FindResource("TextMutedBrush"),
            FontWeight = FontWeights.Bold,
            FontSize = 10
        };
        menu.Items.Add(header);

        foreach (var account in settings.Accounts)
        {
            bool isActive = account.UserId == settings.ActiveUserId;
            var item = new MenuItem
            {
                Header = isActive ? $"✓  {account.Username} (Active)" : $"    Switch to {account.Username}",
                FontWeight = isActive ? FontWeights.Bold : FontWeights.Normal
            };
            if (!isActive)
            {
                var targetId = account.UserId;
                item.Click += (s, args) => SwitchToAccount(targetId);
            }
            menu.Items.Add(item);
        }

        menu.Items.Add(new Separator());

        var addItem = new MenuItem
        {
            Header = "+ Add Another Account..."
        };
        addItem.Click += (s, args) => RequestAddAccount?.Invoke();
        menu.Items.Add(addItem);

        menu.Items.Add(new Separator());

        var logoutCurrentItem = new MenuItem
        {
            Header = $"Log Out of '{settings.Username}'"
        };
        logoutCurrentItem.Click += (s, args) => LogoutActiveAccount();
        menu.Items.Add(logoutCurrentItem);

        if (settings.Accounts.Count > 1)
        {
            var logoutAllItem = new MenuItem
            {
                Header = "Log Out of All Accounts"
            };
            logoutAllItem.Click += (s, args) => LogoutAllAccounts();
            menu.Items.Add(logoutAllItem);
        }

        menu.PlacementTarget = BtnAccountMenu;
        menu.Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom;
        menu.IsOpen = true;
    }

    private void SwitchToAccount(string userId)
    {
        _storage.SwitchAccount(_settings, userId);
        var settings = _storage.LoadSettings();

        _api.BaseUrl = settings.ApiBaseUrl;
        _api.AuthToken = StorageService.UnprotectString(settings.EncryptedToken);

        TxtUsername.Text = settings.Username ?? "User";
        TxtServerUrl.Text = _api.BaseUrl;

        _tracker.ReloadEntries(settings.ActiveUserId);
        UpdateEmptyState();
        _ = RefreshProgressFromIrisAsync();

        TxtFooterStatus.Text = $"Switched account to '{settings.Username}'.";
    }

    private void LogoutActiveAccount()
    {
        var settings = _storage.LoadSettings();
        var result = MessageBox.Show(
            Window.GetWindow(this),
            $"Are you sure you want to log out of '{settings.Username}'?",
            "Confirm Logout",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
        {
            var currentUid = settings.ActiveUserId ?? string.Empty;
            _storage.RemoveAccount(settings, currentUid);

            var updated = _storage.LoadSettings();
            if (updated.Accounts.Count > 0 && !string.IsNullOrEmpty(updated.ActiveUserId))
            {
                SwitchToAccount(updated.ActiveUserId);
            }
            else
            {
                _tracker.Stop();
                _api.AuthToken = null;
                LoggedOut?.Invoke();
            }
        }
    }

    private void LogoutAllAccounts()
    {
        var result = MessageBox.Show(
            Window.GetWindow(this),
            "Are you sure you want to log out of all accounts?",
            "Confirm Logout All",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (result == MessageBoxResult.Yes)
        {
            var settings = _storage.LoadSettings();
            settings.Accounts.Clear();
            settings.ActiveUserId = null;
            settings.UserId = null;
            settings.Username = null;
            settings.UserEmail = null;
            settings.EncryptedToken = null;
            _storage.SaveSettings(settings);

            _tracker.Stop();
            _api.AuthToken = null;
            LoggedOut?.Invoke();
        }
    }

    private void BtnManageExes_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement el && el.Tag is LinkedProcessEntry entry)
        {
            var win = new ManageExecutablesWindow(entry, () =>
            {
                _tracker.SaveNow();
            })
            {
                Owner = Window.GetWindow(this)
            };
            win.ShowDialog();
        }
    }

    private async Task RefreshProgressFromIrisAsync()
    {
        var settings = _storage.LoadSettings();
        if (string.IsNullOrEmpty(settings.Username) || string.IsNullOrEmpty(_api.AuthToken)) return;

        try
        {
            var res = await _api.GetUserGameListAsync(settings.Username);
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
        var settings = _storage.LoadSettings();
        var win = new LinkGameWindow(_api, settings.Username ?? string.Empty, settings.ActiveUserId)
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
        LogoutActiveAccount();
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
