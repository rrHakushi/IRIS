using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using IrisTracker.Models;
using IrisTracker.Services;
using Microsoft.Win32;

namespace IrisTracker.Views;

public partial class LinkGameWindow : Window
{
    private readonly IrisApiClient _api;
    private readonly string _username;
    private readonly string? _userId;
    private List<UserGameListItem> _allUserGames = new();
    private UserGameListItem? _selectedGame;

    public LinkedProcessEntry? CreatedEntry { get; private set; }

    public LinkGameWindow(IrisApiClient api, string username, string? userId = null)
    {
        InitializeComponent();
        _api = api;
        _username = username;
        _userId = userId;
        DarkTitleBarHelper.EnableDarkTitleBar(this);

        Loaded += async (s, e) =>
        {
            RefreshRunningWindows();
            await LoadUserGamesAsync();
        };
    }

    private void Tab_Checked(object sender, RoutedEventArgs e)
    {
        if (ViewSelectGame == null || ViewProcess == null) return;

        ViewSelectGame.Visibility = TabSelectGame.IsChecked == true ? Visibility.Visible : Visibility.Collapsed;
        ViewProcess.Visibility = TabProcess.IsChecked == true ? Visibility.Visible : Visibility.Collapsed;
    }

    private void RefreshRunningWindows()
    {
        var windows = WindowCaptureHelper.GetActiveWindows()
            .OrderBy(w => w.ExecutableName)
            .ToList();

        CmbRunningWindows.ItemsSource = windows;
        if (windows.Count > 0)
        {
            CmbRunningWindows.SelectedIndex = 0;
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
            MessageBox.Show(this, $"Failed to fetch your game list: {ex.Message}", "IRIS API Error", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private void UpdateGamesList(List<UserGameListItem> games)
    {
        ListGames.ItemsSource = games;
        TxtNoGamesFound.Visibility = games.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
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

    private void TxtSearchGame_TextChanged(object sender, TextChangedEventArgs e)
    {
        var query = TxtSearchGame.Text.Trim();
        TxtSearchPlaceholder.Visibility = string.IsNullOrEmpty(TxtSearchGame.Text)
            ? Visibility.Visible
            : Visibility.Collapsed;

        if (string.IsNullOrEmpty(query))
        {
            UpdateGamesList(_allUserGames);
            return;
        }

        var matches = _allUserGames.Where(g =>
            g.DisplayTitle.Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();

        UpdateGamesList(matches);
    }

    private void ListGames_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        _selectedGame = ListGames.SelectedItem as UserGameListItem;
        UpdateValidation();
    }

    private void ListGames_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (ListGames.SelectedItem is UserGameListItem game)
        {
            _selectedGame = game;
            UpdateValidation();
            TabProcess.IsChecked = true;
        }
    }

    private void CmbRunningWindows_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (CmbRunningWindows.SelectedItem is WindowInfo win)
        {
            TxtExecutableName.Text = win.ExecutableName;
            TxtWindowTitlePattern.Text = win.WindowTitle;
            UpdateValidation();
        }
    }

    private void BtnRefreshWindows_Click(object sender, RoutedEventArgs e)
    {
        RefreshRunningWindows();
    }

    private void TxtExecutableName_TextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateValidation();
    }

    private void TxtWindowTitlePattern_TextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateValidation();
    }

    private void BtnBrowseExe_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "Executables (*.exe)|*.exe|All files (*.*)|*.*",
            Multiselect = true,
            Title = "Select Game Executable(s)"
        };

        if (dialog.ShowDialog(this) == true)
        {
            var files = dialog.FileNames.Select(Path.GetFileName).Where(f => !string.IsNullOrEmpty(f)).ToList();
            var existing = TxtExecutableName.Text
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

            foreach (var f in files)
            {
                if (!string.IsNullOrEmpty(f) && !existing.Contains(f, StringComparer.OrdinalIgnoreCase))
                {
                    existing.Add(f);
                }
            }

            TxtExecutableName.Text = string.Join(", ", existing);
            UpdateValidation();
        }
    }

    private void UpdateValidation()
    {
        if (BtnLink == null || TxtExecutableName == null) return;

        var exe = TxtExecutableName.Text.Trim();
        bool valid = _selectedGame != null && !string.IsNullOrWhiteSpace(exe);
        BtnLink.IsEnabled = valid;

        if (_selectedGame != null)
        {
            PillSelectedGame.Visibility = Visibility.Visible;
            TxtSelectedGameName.Text = _selectedGame.DisplayTitle;
        }
        else
        {
            PillSelectedGame.Visibility = Visibility.Collapsed;
            TxtSelectedGameName.Text = string.Empty;
        }
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void BtnLink_Click(object sender, RoutedEventArgs e)
    {
        if (_selectedGame == null || string.IsNullOrWhiteSpace(TxtExecutableName.Text)) return;

        var exes = TxtExecutableName.Text
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(WindowCaptureHelper.NormalizeExeName)
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
            Score = _selectedGame.Score,
            Status = _selectedGame.Status,
            Notes = _selectedGame.Notes,
            Replayed = _selectedGame.Replayed,
            StartedAt = _selectedGame.StartedAt,
            CompletedAt = _selectedGame.CompletedAt,
            ExecutableNames = exes,
            ExecutableName = exes[0],
            WindowTitlePattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern.Text)
                ? null
                : TxtWindowTitlePattern.Text.Trim(),
            AccumulatedSeconds = 0,
            IrisProgressHours = _selectedGame.ProgressHours,
            PendingSyncHours = 0,
            IsRunning = false
        };

        DialogResult = true;
        Close();
    }
}
