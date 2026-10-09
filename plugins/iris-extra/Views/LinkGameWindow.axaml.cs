using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class LinkGameWindow : Window
{
    private readonly IrisApiClient _api;
    private readonly string _username;
    private readonly string? _userId;
    private List<UserGameListItem> _allUserGames = new();
    private UserGameListItem? _selectedGame;

    public LinkedProcessEntry? CreatedEntry { get; private set; }

    private List<RunningProcessInfo> _runningProcesses = new();
    private bool _hasLoadedData;

    public LinkGameWindow() : this(new IrisApiClient(), string.Empty, null)
    {
    }

    public LinkGameWindow(IrisApiClient api, string username, string? userId = null)
    {
        InitializeComponent();
        _api = api;
        _username = username;
        _userId = userId;

        TxtSearchGame.TextChanged += (s, e) => OnSearchTextChanged(TxtSearchGame.Text);
        TxtExecutableName.TextChanged += (s, e) => UpdateValidation();
        TxtWindowTitlePattern.TextChanged += (s, e) => UpdateValidation();

        Loaded += async (s, e) => await EnsureDataLoadedAsync();
        Opened += async (s, e) => await EnsureDataLoadedAsync();
    }

    private async Task EnsureDataLoadedAsync()
    {
        if (_hasLoadedData) return;
        _hasLoadedData = true;

        RefreshRunningProcesses();
        await LoadUserGamesAsync();
    }

    private void RefreshRunningProcesses()
    {
        _runningProcesses = ProcessDetector.GetRunningProcesses();
        CmbRunningProcesses.ItemsSource = _runningProcesses.Select(p => p.DisplayText).ToList();
        if (_runningProcesses.Count > 0)
        {
            CmbRunningProcesses.SelectedIndex = 0;
        }
    }

    private async Task LoadUserGamesAsync()
    {
        try
        {
            var res = await _api.GetUserGameListAsync(_username);
            _allUserGames = res.Items.Where(i => i?.Media != null).ToList();
            UpdateGamesList(_allUserGames);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LinkGameWindow] Failed to fetch game list: {ex.Message}");
        }
    }

    private void UpdateGamesList(List<UserGameListItem> games)
    {
        ListGames.ItemsSource = games;
        TxtNoGamesFound.IsVisible = games.Count == 0;
        if (games.Count > 0 && _selectedGame == null)
        {
            ListGames.SelectedIndex = 0;
        }
        else if (games.Count == 0)
        {
            _selectedGame = null;
            UpdateValidation();
        }
    }

    private void OnSearchTextChanged(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            UpdateGamesList(_allUserGames);
            return;
        }

        var q = query.Trim();
        var matches = _allUserGames.Where(g =>
            g.DisplayTitle.Contains(q, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrEmpty(g.Media.TitleSecondary) && g.Media.TitleSecondary.Contains(q, StringComparison.OrdinalIgnoreCase))
        ).ToList();

        UpdateGamesList(matches);
    }

    private void ListGames_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        _selectedGame = ListGames.SelectedItem as UserGameListItem;
        UpdateValidation();
    }

    private void CmbRunningProcesses_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        int idx = CmbRunningProcesses.SelectedIndex;
        if (idx >= 0 && idx < _runningProcesses.Count)
        {
            var proc = _runningProcesses[idx];
            TxtExecutableName.Text = proc.Name;
            if (!string.IsNullOrWhiteSpace(proc.WindowTitle))
            {
                TxtWindowTitlePattern.Text = proc.WindowTitle;
            }
            UpdateValidation();
        }
    }

    private void BtnRefreshProcesses_Click(object? sender, RoutedEventArgs e)
    {
        RefreshRunningProcesses();
    }

    private async void BtnBrowseExe_Click(object? sender, RoutedEventArgs e)
    {
        try
        {
            var files = await StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
            {
                Title = "Select Game Executable(s)",
                AllowMultiple = true
            });

            if (files.Count > 0)
            {
                var names = files.Select(f => Path.GetFileName(f.Path.LocalPath)).Where(n => !string.IsNullOrEmpty(n)).ToList();
                var current = (TxtExecutableName.Text ?? string.Empty)
                    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();

                foreach (var n in names)
                {
                    if (!current.Contains(n, StringComparer.OrdinalIgnoreCase))
                    {
                        current.Add(n);
                    }
                }

                TxtExecutableName.Text = string.Join(", ", current);
                UpdateValidation();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[LinkGameWindow] OpenFilePicker error: {ex.Message}");
        }
    }

    private void UpdateValidation()
    {
        if (BtnLink == null || TxtSummary == null || TxtExecutableName == null) return;

        var exe = TxtExecutableName.Text?.Trim() ?? string.Empty;
        bool valid = _selectedGame != null && !string.IsNullOrWhiteSpace(exe);
        BtnLink.IsEnabled = valid;

        if (valid)
        {
            var pattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern?.Text)
                ? "(Any window)"
                : $"Title: \"{TxtWindowTitlePattern.Text.Trim()}\"";

            TxtSummary.Text = $"Ready to link '{_selectedGame!.DisplayTitle}' ({_selectedGame.ProgressHours}h in IRIS) to '{exe}' [{pattern}].";
        }
        else
        {
            TxtSummary.Text = "Please select an IRIS game entry and executable name above.";
        }
    }

    private void BtnCancel_Click(object? sender, RoutedEventArgs e)
    {
        Close(false);
    }

    private void BtnLink_Click(object? sender, RoutedEventArgs e)
    {
        if (_selectedGame == null || string.IsNullOrWhiteSpace(TxtExecutableName.Text)) return;

        var exes = TxtExecutableName.Text
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(ProcessDetector.NormalizeExeName)
            .Where(x => !string.IsNullOrEmpty(x))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (exes.Count == 0) return;

        CreatedEntry = new LinkedProcessEntry
        {
            UserId = _userId,
            GameId = _selectedGame.GameId,
            GameTitle = _selectedGame.DisplayTitle,
            CoverImage = _selectedGame.CoverImage,
            BannerImage = _selectedGame.BannerImage,
            ExecutableNames = exes,
            ExecutableName = exes[0],
            WindowTitlePattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern?.Text)
                ? null
                : TxtWindowTitlePattern.Text.Trim(),
            AccumulatedSeconds = 0,
            IrisProgressHours = _selectedGame.ProgressHours,
            Score = _selectedGame.Score,
            Status = _selectedGame.Status,
            Notes = _selectedGame.Notes,
            Replayed = _selectedGame.Replayed,
            StartedAt = _selectedGame.StartedAt,
            CompletedAt = _selectedGame.CompletedAt,
            PendingSyncHours = 0,
            IsRunning = false
        };

        Close(true);
    }
}
