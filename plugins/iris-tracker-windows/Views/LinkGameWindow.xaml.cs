using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using IrisTracker.Models;
using IrisTracker.Services;
using Microsoft.Win32;

namespace IrisTracker.Views;

public partial class LinkGameWindow : Window
{
    private readonly IrisApiClient _api;
    private readonly string _username;
    private List<UserGameListItem> _allUserGames = new();
    private UserGameListItem? _selectedGame;

    public LinkedProcessEntry? CreatedEntry { get; private set; }

    public LinkGameWindow(IrisApiClient api, string username)
    {
        InitializeComponent();
        _api = api;
        _username = username;
        DarkTitleBarHelper.EnableDarkTitleBar(this);

        Loaded += async (s, e) =>
        {
            RefreshRunningWindows();
            await LoadUserGamesAsync();
        };
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

        // Only show and search games that are in user's list
        var matches = _allUserGames.Where(g =>
            g.DisplayTitle.Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();

        UpdateGamesList(matches);
    }

    private void ListGames_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        _selectedGame = ListGames.SelectedItem as UserGameListItem;
        UpdateValidation();
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

    private void BtnBrowseExe_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "Executables (*.exe)|*.exe|All files (*.*)|*.*",
            Title = "Select Game Executable"
        };

        if (dialog.ShowDialog(this) == true)
        {
            TxtExecutableName.Text = Path.GetFileName(dialog.FileName);
            UpdateValidation();
        }
    }

    private void UpdateValidation()
    {
        var exe = TxtExecutableName.Text.Trim();
        bool valid = _selectedGame != null && !string.IsNullOrWhiteSpace(exe);
        BtnLink.IsEnabled = valid;

        if (valid)
        {
            var pattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern.Text)
                ? "(Any window)"
                : $"Title: \"{TxtWindowTitlePattern.Text.Trim()}\"";

            TxtSummary.Text = $"Ready to link '{_selectedGame!.DisplayTitle}' ({_selectedGame.ProgressHours}h in IRIS) to '{exe}' [{pattern}].";
        }
        else
        {
            TxtSummary.Text = "Please select an IRIS game entry and executable name above.";
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

        var cleanExe = WindowCaptureHelper.NormalizeExeName(TxtExecutableName.Text);

        CreatedEntry = new LinkedProcessEntry
        {
            GameId = _selectedGame.GameId,
            GameTitle = _selectedGame.DisplayTitle,
            CoverImage = _selectedGame.CoverImage,
            ExecutableName = cleanExe,
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
