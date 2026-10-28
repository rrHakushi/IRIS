using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Collections.Specialized;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Platform.Storage;
using Avalonia.Threading;
using BorealisExtra.Models;
using BorealisExtra.Services;

namespace BorealisExtra.Views;

public partial class TrackerView : UserControl
{
    private readonly ProcessTrackerService _tracker;
    private readonly BorealisApiClient _api;
    private readonly StorageService _storage;
    private AppSettings _settings;

    private readonly ObservableCollection<LinkedProcessEntry> _filteredEntries = new();
    private LinkedProcessEntry? _editingEntry;
    private List<RunningProcessInfo> _runningProcesses = new();
    private List<UserGameListItem> _availableGames = new();
    private UserGameListItem? _selectedLinkGame;
    private CancellationTokenSource? _searchCts;
    private bool _hasFetchedProfileOnLaunch;

    public event Action? LoggedOut;

    public TrackerView() : this(new ProcessTrackerService(new StorageService(), new BorealisApiClient()), new BorealisApiClient(), new StorageService())
    {
    }

    public TrackerView(ProcessTrackerService tracker, BorealisApiClient api, StorageService storage)
    {
        InitializeComponent();
        _tracker = tracker;
        _api = api;
        _storage = storage;
        _settings = _storage.LoadSettings();

        ItemsGamesList.ItemsSource = _filteredEntries;
        _tracker.Entries.CollectionChanged += OnEntriesCollectionChanged;

        _tracker.HourIncremented += OnHourIncremented;
        _tracker.SyncSucceeded += OnSyncSucceeded;
        _tracker.SyncFailed += OnSyncFailed;

        // Live Header Search
        TxtHeaderSearch.TextChanged += (s, e) => ApplySearchFilter();

        // Link Game search
        TxtLinkSearch.TextChanged += (s, e) => OnLinkSearchChanged();
        TxtLinkExecutableName.TextChanged += (s, e) => UpdateLinkValidation();
        TxtLinkWindowTitlePattern.TextChanged += (s, e) => UpdateLinkValidation();

        AttachedToVisualTree += (s, e) => OnAttachedToVisualTree();
    }

    private async void OnAttachedToVisualTree()
    {
        _tracker.Start();
        LoadCachedUserProfile();
        RefreshFilteredEntries();
        UpdateEmptyState();

        if (!_hasFetchedProfileOnLaunch)
        {
            _hasFetchedProfileOnLaunch = true;
            await FetchUserProfileOnceAsync();
        }

        _ = RefreshProgressFromIrisAsync();
    }

    #region User Profile Caching & Card

    private void LoadCachedUserProfile()
    {
        var username = _settings.Username ?? "user";
        var displayName = !string.IsNullOrWhiteSpace(_settings.DisplayName) ? _settings.DisplayName : username;

        TxtUserDisplayName.Text = displayName;
        TxtUserHandle.Text = $"@{username}";
        TxtUserDomain.Text = FormatServerDomain(_settings.ApiBaseUrl);

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            TxtAvatarFallback.Text = displayName[0].ToString().ToUpperInvariant();
        }

        if (!string.IsNullOrWhiteSpace(_settings.AvatarUrl))
        {
            _ = LoadAvatarImageAsync(_settings.AvatarUrl);
        }
        else
        {
            ImgAvatar.IsVisible = false;
            TxtAvatarFallback.IsVisible = true;
        }

        if (!string.IsNullOrWhiteSpace(_settings.AvatarFrameUrl))
        {
            _ = LoadAvatarFrameAsync(_settings.AvatarFrameUrl);
        }
        else
        {
            ImgAvatarFrame.IsVisible = false;
        }

        if (!string.IsNullOrWhiteSpace(_settings.NameplateUrl))
        {
            _ = LoadNameplateImageAsync(_settings.NameplateUrl);
        }
        else
        {
            ImgNameplate.IsVisible = false;
        }
    }

    private async Task FetchUserProfileOnceAsync()
    {
        if (string.IsNullOrWhiteSpace(_api.AuthToken)) return;

        try
        {
            var res = await _api.GetCurrentUserAsync();
            if (res?.Success == true && res.User != null)
            {
                var user = res.User;
                var cust = user.Customization;
                var prof = cust?.Profile;

                var displayName = prof?.DisplayName;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = cust?.DisplayName;
                if (string.IsNullOrWhiteSpace(displayName)) displayName = user.Username;
                _settings.DisplayName = displayName;

                var avatar = prof?.AvatarUrl ?? cust?.AvatarUrl ?? cust?.Avatar;
                if (!string.IsNullOrWhiteSpace(avatar))
                {
                    _settings.AvatarUrl = ResolveMediaUrl(avatar, _settings.ApiBaseUrl);
                }

                var avatarFrame = prof?.AvatarFrame ?? cust?.AvatarFrame;
                if (!string.IsNullOrWhiteSpace(avatarFrame))
                {
                    _settings.AvatarFrameUrl = ResolveMediaUrl(avatarFrame, _settings.ApiBaseUrl);
                }

                var nameplate = prof?.NameplateUrl ?? prof?.SidebarBannerUrl ?? prof?.SidebarCardBackgroundUrl ?? cust?.NameplateUrl ?? cust?.SidebarCardBackgroundUrl ?? cust?.Nameplate ?? prof?.BannerUrl ?? cust?.BannerUrl;
                if (!string.IsNullOrWhiteSpace(nameplate))
                {
                    _settings.NameplateUrl = ResolveMediaUrl(nameplate, _settings.ApiBaseUrl);
                }

                _storage.SaveSettings(_settings);
                LoadCachedUserProfile();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrackerView] Failed to fetch user profile: {ex.Message}");
        }
    }

    private async Task LoadAvatarImageAsync(string url)
    {
        var bitmap = await ImageHelper.LoadFromWebAsync(url);
        if (bitmap != null)
        {
            ImgAvatar.Source = bitmap;
            ImgAvatar.IsVisible = true;
            TxtAvatarFallback.IsVisible = false;
        }
    }

    private async Task LoadAvatarFrameAsync(string url)
    {
        var bitmap = await ImageHelper.LoadFromWebAsync(url);
        if (bitmap != null)
        {
            ImgAvatarFrame.Source = bitmap;
            ImgAvatarFrame.IsVisible = true;
        }
    }

    private async Task LoadNameplateImageAsync(string url)
    {
        var bitmap = await ImageHelper.LoadFromWebAsync(url);
        if (bitmap != null)
        {
            ImgNameplate.Source = bitmap;
            ImgNameplate.IsVisible = true;
        }
    }

    private static string? ResolveMediaUrl(string? path, string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return path;
        var cleanBase = baseUrl.TrimEnd('/');
        return $"{cleanBase}/{path.TrimStart('/')}";
    }

    private static string FormatServerDomain(string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(baseUrl)) return "localhost:4000";
        try
        {
            var uri = new Uri(baseUrl);
            return uri.Authority + uri.AbsolutePath.TrimEnd('/');
        }
        catch
        {
            return baseUrl.Replace("http://", "").Replace("https://", "").TrimEnd('/');
        }
    }

    #endregion

    #region Search & Filtering

    private void ApplySearchFilter()
    {
        var query = TxtHeaderSearch.Text?.Trim();
        BtnSearchClear.IsVisible = !string.IsNullOrEmpty(query);

        _filteredEntries.Clear();
        if (string.IsNullOrEmpty(query))
        {
            foreach (var e in _tracker.Entries)
            {
                _filteredEntries.Add(e);
            }
        }
        else
        {
            foreach (var e in _tracker.Entries)
            {
                if (e.GameTitle.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    e.ExecutablesDisplay.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                    e.StatusBadgeText.Contains(query, StringComparison.OrdinalIgnoreCase))
                {
                    _filteredEntries.Add(e);
                }
            }
        }

        UpdateEmptyState();
    }

    private void BtnSearchClear_Click(object? sender, RoutedEventArgs e)
    {
        TxtHeaderSearch.Text = string.Empty;
        TxtHeaderSearch.Focus();
    }

    private void RefreshFilteredEntries()
    {
        ApplySearchFilter();
    }

    private void OnEntriesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        RefreshFilteredEntries();
        UpdateEmptyState();
        UpdateOfflineBanner();
    }

    private void UpdateEmptyState()
    {
        int count = _tracker.Entries.Count;
        TxtGamesCountBadge.Text = count.ToString();

        bool hasItems = _filteredEntries.Count > 0;
        CardEmptyState.IsVisible = !hasItems;
        ScrollGamesList.IsVisible = hasItems;
        UpdateOfflineBanner();
    }

    private void UpdateOfflineBanner()
    {
        var pendingTotal = _tracker.Entries.Sum(e => e.PendingSyncHours);
        if (pendingTotal > 0)
        {
            BannerOffline.IsVisible = true;
            TxtOfflineStatus.Text = $"{pendingTotal} offline hour(s) queued for sync.";
        }
        else
        {
            BannerOffline.IsVisible = false;
        }
    }

    #endregion

    #region Left Navigation Drawer & In-Sidebar Settings

    private void BtnBrandTrigger_Click(object? sender, RoutedEventArgs e)
    {
        ToggleLeftDrawer();
    }

    private void ToggleLeftDrawer()
    {
        if (DrawerLeft.IsVisible)
        {
            CloseAllDrawers();
        }
        else
        {
            CloseRightDrawer();
            PanelLeftMenu.IsVisible = true;
            PanelLeftSettings.IsVisible = false;
            DrawerLeft.IsVisible = true;
            OverlayBackdrop.IsVisible = true;

            // Trigger slide-in and fade animations
            Dispatcher.UIThread.Post(() =>
            {
                DrawerLeft.RenderTransform = new TranslateTransform(0, 0);
                OverlayBackdrop.Opacity = 1;
            }, DispatcherPriority.Render);
        }
    }

    private async void CloseAllDrawers()
    {
        // Animate slide-out and fade-out
        DrawerLeft.RenderTransform = new TranslateTransform(-320, 0);
        DrawerRight.RenderTransform = new TranslateTransform(450, 0);
        OverlayBackdrop.Opacity = 0;

        await Task.Delay(250);

        DrawerLeft.IsVisible = false;
        PanelLeftSettings.IsVisible = false;
        PanelLeftMenu.IsVisible = true;
        DrawerRight.IsVisible = false;
        PanelEditGame.IsVisible = false;
        PanelLinkGame.IsVisible = false;
        OverlayBackdrop.IsVisible = false;
        _editingEntry = null;
    }

    private void Backdrop_PointerPressed(object? sender, PointerPressedEventArgs e)
    {
        CloseAllDrawers();
    }

    private void BtnNavSettings_Click(object? sender, RoutedEventArgs e)
    {
        OpenLeftSettingsView();
    }

    private void OpenLeftSettingsView()
    {
        PanelLeftMenu.IsVisible = false;
        PanelLeftSettings.IsVisible = true;

        TxtSettingsApiUrl.Text = _settings.ApiBaseUrl;
        TxtSettingsPolling.Text = _settings.PollingIntervalSeconds.ToString();
        ChkSettingsNotify.IsChecked = _settings.NotifyOnHourIncrement;
        ChkSettingsStartup.IsChecked = _settings.StartOnStartup;
    }

    private void BtnSettingsBack_Click(object? sender, RoutedEventArgs e)
    {
        PanelLeftSettings.IsVisible = false;
        PanelLeftMenu.IsVisible = true;
    }

    private async void BtnNavSync_Click(object? sender, RoutedEventArgs e)
    {
        CloseAllDrawers();

        try
        {
            await _tracker.SyncPendingIncrementsAsync();
            await RefreshProgressFromIrisAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrackerView] Sync failed: {ex.Message}");
        }
    }

    private async void BtnHeaderSync_Click(object? sender, RoutedEventArgs e)
    {
        try
        {
            await _tracker.SyncPendingIncrementsAsync();
            await RefreshProgressFromIrisAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrackerView] Header sync failed: {ex.Message}");
        }
    }

    private void BtnNavLogout_Click(object? sender, RoutedEventArgs e)
    {
        CloseAllDrawers();
        _tracker.Stop();
        _settings.EncryptedToken = null;
        _settings.Username = null;
        _settings.DisplayName = null;
        _settings.AvatarUrl = null;
        _settings.AvatarFrameUrl = null;
        _settings.NameplateUrl = null;
        _storage.SaveSettings(_settings);

        LoggedOut?.Invoke();
    }

    #endregion

    #region Right Drawer (Edit, Link)

    private void CloseRightDrawer_Click(object? sender, RoutedEventArgs e)
    {
        CloseRightDrawerAnimated();
    }

    private void CloseRightDrawer()
    {
        CloseRightDrawerAnimated();
    }

    private async void CloseRightDrawerAnimated()
    {
        DrawerRight.RenderTransform = new TranslateTransform(450, 0);
        if (!DrawerLeft.IsVisible)
        {
            OverlayBackdrop.Opacity = 0;
        }

        await Task.Delay(250);

        DrawerRight.IsVisible = false;
        PanelEditGame.IsVisible = false;
        PanelLinkGame.IsVisible = false;
        _editingEntry = null;

        if (!DrawerLeft.IsVisible)
        {
            OverlayBackdrop.IsVisible = false;
        }
    }

    private void GameCard_PointerPressed(object? sender, PointerPressedEventArgs e)
    {
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
            OpenEditDrawer(entry);
        }
    }

    private void BtnHeaderAdd_Click(object? sender, RoutedEventArgs e)
    {
        OpenLinkGameDrawer();
    }

    #region Edit Game Sheet

    private void OpenEditDrawer(LinkedProcessEntry entry)
    {
        _editingEntry = entry;
        DrawerLeft.IsVisible = false;
        OverlayBackdrop.IsVisible = true;
        DrawerRight.IsVisible = true;

        PanelEditGame.IsVisible = true;
        PanelLinkGame.IsVisible = false;

        // Animate DrawerRight slide in
        Dispatcher.UIThread.Post(() =>
        {
            DrawerRight.RenderTransform = new TranslateTransform(0, 0);
            OverlayBackdrop.Opacity = 1;
        }, DispatcherPriority.Render);

        TxtEditTitle.Text = entry.GameTitle;
        TxtEditHours.Text = entry.IrisProgressHours.ToString();
        TxtEditScore.Text = entry.Score?.ToString("0.0") ?? string.Empty;
        TxtEditWindowTitle.Text = entry.WindowTitlePattern ?? string.Empty;

        // Match status in combo
        var status = entry.Status ?? "IN_PROGRESS";
        int selIdx = 0;
        for (int i = 0; i < CmbEditStatus.Items.Count; i++)
        {
            if (CmbEditStatus.Items[i] is ComboBoxItem item && string.Equals(item.Tag?.ToString(), status, StringComparison.OrdinalIgnoreCase))
            {
                selIdx = i;
                break;
            }
        }
        CmbEditStatus.SelectedIndex = selIdx;

        RefreshEditExesList();
        RefreshRunningProcesses(CmbEditRunningProcesses);
    }

    private void RefreshEditExesList()
    {
        if (_editingEntry == null) return;
        var exes = _editingEntry.AllExecutables.ToList();
        ListEditExes.ItemsSource = null;
        ListEditExes.ItemsSource = exes;
        TxtEditNoExes.IsVisible = exes.Count == 0;
    }

    private void BtnEditRemoveExe_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;
        if (sender is Button btn && btn.Tag is string exe)
        {
            _editingEntry.RemoveExecutable(exe);
            RefreshEditExesList();
            _tracker.SaveNow();
        }
    }

    private void BtnEditAddRunning_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;
        int idx = CmbEditRunningProcesses.SelectedIndex;
        if (idx >= 0 && idx < _runningProcesses.Count)
        {
            var proc = _runningProcesses[idx];
            _editingEntry.AddExecutable(proc.Name);
            if (string.IsNullOrWhiteSpace(_editingEntry.WindowTitlePattern) && !string.IsNullOrWhiteSpace(proc.WindowTitle))
            {
                _editingEntry.WindowTitlePattern = proc.WindowTitle;
                TxtEditWindowTitle.Text = proc.WindowTitle;
            }
            RefreshEditExesList();
            _tracker.SaveNow();
        }
    }

    private void BtnEditAddManual_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;
        var newExe = TxtEditNewExe.Text?.Trim();
        if (!string.IsNullOrEmpty(newExe))
        {
            _editingEntry.AddExecutable(newExe);
            TxtEditNewExe.Text = string.Empty;
            RefreshEditExesList();
            _tracker.SaveNow();
        }
    }

    private async void BtnEditBrowse_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;
        var topLevel = TopLevel.GetTopLevel(this);
        if (topLevel == null) return;

        var files = await topLevel.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = "Select Game Executable(s)",
            AllowMultiple = true
        });

        if (files.Count > 0)
        {
            foreach (var f in files)
            {
                var name = Path.GetFileName(f.Path.LocalPath);
                if (!string.IsNullOrEmpty(name))
                {
                    _editingEntry.AddExecutable(name);
                }
            }
            RefreshEditExesList();
            _tracker.SaveNow();
        }
    }

    private void BtnEditHoursIncrement_Click(object? sender, RoutedEventArgs e)
    {
        int.TryParse(TxtEditHours.Text, out int h);
        TxtEditHours.Text = Math.Max(0, h + 1).ToString();
    }

    private void BtnEditHoursDecrement_Click(object? sender, RoutedEventArgs e)
    {
        int.TryParse(TxtEditHours.Text, out int h);
        TxtEditHours.Text = Math.Max(0, h - 1).ToString();
    }

    private async void BtnEditSave_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;

        if (!string.IsNullOrWhiteSpace(TxtEditTitle.Text))
        {
            _editingEntry.GameTitle = TxtEditTitle.Text.Trim();
        }

        _editingEntry.WindowTitlePattern = string.IsNullOrWhiteSpace(TxtEditWindowTitle.Text)
            ? null
            : TxtEditWindowTitle.Text.Trim();

        string? selectedStatus = null;
        if (CmbEditStatus.SelectedItem is ComboBoxItem item && item.Tag != null)
        {
            selectedStatus = item.Tag.ToString();
            _editingEntry.Status = selectedStatus;
        }

        double? parsedScore = null;
        if (double.TryParse(TxtEditScore.Text, out double s) && s >= 0 && s <= 10)
        {
            parsedScore = s;
            _editingEntry.Score = parsedScore;
        }

        int.TryParse(TxtEditHours.Text, out int hours);
        if (hours >= 0)
        {
            _editingEntry.IrisProgressHours = hours;
        }

        _tracker.SaveNow();

        // Push updates to Iris backend
        try
        {
            await _api.UpsertGameListEntryAsync(_editingEntry.GameId, new UpsertGameRequest
            {
                Status = selectedStatus,
                Score = parsedScore,
                Progress = hours
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrackerView] Failed to save entry to Borealis: {ex.Message}");
        }

        CloseRightDrawer();
        UpdateEmptyState();
    }

    private void BtnEditUnlink_Click(object? sender, RoutedEventArgs e)
    {
        if (_editingEntry == null) return;
        _tracker.RemoveEntry(_editingEntry);
        CloseRightDrawer();
        UpdateEmptyState();
    }

    #endregion

    #region Link Game Sheet

    private void OpenLinkGameDrawer()
    {
        DrawerLeft.IsVisible = false;
        OverlayBackdrop.IsVisible = true;
        DrawerRight.IsVisible = true;

        PanelEditGame.IsVisible = false;
        PanelLinkGame.IsVisible = true;

        // Animate DrawerRight slide in
        Dispatcher.UIThread.Post(() =>
        {
            DrawerRight.RenderTransform = new TranslateTransform(0, 0);
            OverlayBackdrop.Opacity = 1;
        }, DispatcherPriority.Render);

        TxtLinkSearch.Text = string.Empty;
        TxtLinkExecutableName.Text = string.Empty;
        TxtLinkWindowTitlePattern.Text = string.Empty;
        _selectedLinkGame = null;
        UpdateLinkValidation();

        RefreshRunningProcesses(CmbLinkRunningProcesses);
        _ = LoadUserGamesForLinkAsync();
    }

    private async Task LoadUserGamesForLinkAsync()
    {
        try
        {
            var res = await _api.GetUserGameListAsync(_settings.Username, limit: 250);
            _availableGames = res.Items.Where(i => i?.Media != null).ToList();
            UpdateLinkGamesList(_availableGames);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TrackerView] Failed to load games for linking: {ex.Message}");
        }
    }

    private void OnLinkSearchChanged()
    {
        _searchCts?.Cancel();
        _searchCts = new CancellationTokenSource();
        var token = _searchCts.Token;

        var query = TxtLinkSearch.Text?.Trim();
        if (string.IsNullOrEmpty(query))
        {
            UpdateLinkGamesList(_availableGames);
            return;
        }

        // 1. Instant local search across user's list (supporting titlePrimary, secondary, native)
        var localMatches = _availableGames.Where(g =>
            g.DisplayTitle.Contains(query, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrEmpty(g.Media.TitleSecondary) && g.Media.TitleSecondary.Contains(query, StringComparison.OrdinalIgnoreCase)) ||
            (!string.IsNullOrEmpty(g.Media.TitleNative) && g.Media.TitleNative.Contains(query, StringComparison.OrdinalIgnoreCase))
        ).ToList();

        UpdateLinkGamesList(localMatches);

        // 2. Fallback catalog search across Borealis if query length >= 2
        if (query.Length >= 2)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(300, token);
                if (token.IsCancellationRequested) return;

                try
                {
                    var catRes = await _api.SearchGamesAsync(query, external: true);
                    if (token.IsCancellationRequested) return;

                    var catGames = catRes.Games;
                    if (catGames.Count > 0)
                    {
                        var existingIds = new HashSet<int>(localMatches.Select(m => m.GameId));
                        var combined = new List<UserGameListItem>(localMatches);

                        foreach (var cg in catGames)
                        {
                            if (!existingIds.Contains(cg.Id))
                            {
                                combined.Add(new UserGameListItem
                                {
                                    Media = cg,
                                    Entry = new GameListEntryInfo
                                    {
                                        GameId = cg.Id,
                                        Status = "PLAN_TO_PLAY"
                                    }
                                });
                            }
                        }

                        await Dispatcher.UIThread.InvokeAsync(() =>
                        {
                            if (!token.IsCancellationRequested)
                            {
                                UpdateLinkGamesList(combined);
                            }
                        });
                    }
                }
                catch
                {
                    // Catalog search fallback failure is non-fatal
                }
            }, token);
        }
    }

    private void UpdateLinkGamesList(List<UserGameListItem> games)
    {
        ListLinkGames.ItemsSource = games;
        TxtLinkNoGames.IsVisible = games.Count == 0;
        if (games.Count > 0 && _selectedLinkGame == null)
        {
            ListLinkGames.SelectedIndex = 0;
        }
        else if (games.Count == 0)
        {
            _selectedLinkGame = null;
            UpdateLinkValidation();
        }
    }

    private void ListLinkGames_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        _selectedLinkGame = ListLinkGames.SelectedItem as UserGameListItem;
        UpdateLinkValidation();
    }

    private void CmbLinkRunningProcesses_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        int idx = CmbLinkRunningProcesses.SelectedIndex;
        if (idx >= 0 && idx < _runningProcesses.Count)
        {
            var proc = _runningProcesses[idx];
            TxtLinkExecutableName.Text = proc.Name;
            if (!string.IsNullOrWhiteSpace(proc.WindowTitle))
            {
                TxtLinkWindowTitlePattern.Text = proc.WindowTitle;
            }
            UpdateLinkValidation();
        }
    }

    private void BtnLinkRefreshProcesses_Click(object? sender, RoutedEventArgs e)
    {
        RefreshRunningProcesses(CmbLinkRunningProcesses);
    }

    private async void BtnLinkBrowseExe_Click(object? sender, RoutedEventArgs e)
    {
        var topLevel = TopLevel.GetTopLevel(this);
        if (topLevel == null) return;

        var files = await topLevel.StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = "Select Game Executable(s)",
            AllowMultiple = true
        });

        if (files.Count > 0)
        {
            var names = files.Select(f => Path.GetFileName(f.Path.LocalPath)).Where(n => !string.IsNullOrEmpty(n)).ToList();
            var current = (TxtLinkExecutableName.Text ?? string.Empty)
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

            foreach (var n in names)
            {
                if (!current.Contains(n, StringComparer.OrdinalIgnoreCase))
                {
                    current.Add(n);
                }
            }

            TxtLinkExecutableName.Text = string.Join(", ", current);
            UpdateLinkValidation();
        }
    }

    private void UpdateLinkValidation()
    {
        bool hasGame = _selectedLinkGame != null;
        bool hasExe = !string.IsNullOrWhiteSpace(TxtLinkExecutableName.Text);
        BtnLinkSubmit.IsEnabled = hasGame && hasExe;
    }

    private void BtnLinkSubmit_Click(object? sender, RoutedEventArgs e)
    {
        if (_selectedLinkGame == null || string.IsNullOrWhiteSpace(TxtLinkExecutableName.Text)) return;

        var entry = new LinkedProcessEntry
        {
            UserId = _settings.UserId ?? _settings.Username,
            GameId = _selectedLinkGame.GameId,
            GameTitle = _selectedLinkGame.DisplayTitle,
            CoverImage = _selectedLinkGame.CoverImage,
            BannerImage = _selectedLinkGame.BannerImage,
            IrisProgressHours = _selectedLinkGame.ProgressHours,
            Score = _selectedLinkGame.Score,
            Status = _selectedLinkGame.Status,
            Notes = _selectedLinkGame.Notes,
            Replayed = _selectedLinkGame.Replayed,
            StartedAt = _selectedLinkGame.StartedAt,
            CompletedAt = _selectedLinkGame.CompletedAt,
            WindowTitlePattern = string.IsNullOrWhiteSpace(TxtLinkWindowTitlePattern.Text) ? null : TxtLinkWindowTitlePattern.Text.Trim()
        };

        var exes = TxtLinkExecutableName.Text
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var ex in exes)
        {
            entry.AddExecutable(ex);
        }

        _tracker.AddEntry(entry);
        CloseRightDrawer();
        UpdateEmptyState();
    }

    #endregion

    #region Settings Save
    private void BtnSettingsSave_Click(object? sender, RoutedEventArgs e)
    {
        var rawUrl = TxtSettingsApiUrl.Text?.Trim();
        if (!string.IsNullOrEmpty(rawUrl))
        {
            _settings.ApiBaseUrl = rawUrl.TrimEnd('/');
            _api.BaseUrl = _settings.ApiBaseUrl;
        }

        if (int.TryParse(TxtSettingsPolling.Text, out int interval) && interval >= 1 && interval <= 60)
        {
            _settings.PollingIntervalSeconds = interval;
            _tracker.UpdateInterval(interval);
        }

        _settings.NotifyOnHourIncrement = ChkSettingsNotify.IsChecked ?? true;
        _settings.StartOnStartup = ChkSettingsStartup.IsChecked ?? false;

        _storage.SaveSettings(_settings);
        LoadCachedUserProfile();
        PanelLeftSettings.IsVisible = false;
        PanelLeftMenu.IsVisible = true;
    }
    #endregion

    private void RefreshRunningProcesses(ComboBox targetCombo)
    {
        _runningProcesses = ProcessDetector.GetRunningProcesses();
        targetCombo.ItemsSource = _runningProcesses.Select(p => p.DisplayText).ToList();
        if (_runningProcesses.Count > 0)
        {
            targetCombo.SelectedIndex = 0;
        }
    }

    #endregion

    #region Tracking Callbacks & Remote Sync

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
            var res = await _api.GetUserGameListAsync(settings.Username, limit: 250);
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

    private void OnHourIncremented(LinkedProcessEntry entry, int newTotalHours)
    {
        Dispatcher.UIThread.Post(() =>
        {
            UpdateEmptyState();
            UpdateOfflineBanner();
        });
    }

    private void OnSyncSucceeded(LinkedProcessEntry entry, string message)
    {
        Dispatcher.UIThread.Post(() =>
        {
            UpdateOfflineBanner();
        });
    }

    private void OnSyncFailed(LinkedProcessEntry entry, Exception error)
    {
        Dispatcher.UIThread.Post(() =>
        {
            UpdateOfflineBanner();
        });
    }

    #endregion
}
