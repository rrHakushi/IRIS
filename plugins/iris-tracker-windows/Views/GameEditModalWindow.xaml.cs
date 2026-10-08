using System;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class GameEditModalWindow : Window
{
    private readonly LinkedProcessEntry _entry;
    private readonly IrisApiClient _api;
    private readonly string _username;
    private readonly Action _onEntryUpdated;
    private readonly Action<LinkedProcessEntry> _onUnlinkRequested;

    public GameEditModalWindow(
        LinkedProcessEntry entry,
        IrisApiClient api,
        string username,
        Action onEntryUpdated,
        Action<LinkedProcessEntry> onUnlinkRequested)
    {
        InitializeComponent();
        _entry = entry;
        _api = api;
        _username = username;
        _onEntryUpdated = onEntryUpdated;
        _onUnlinkRequested = onUnlinkRequested;

        DarkTitleBarHelper.EnableDarkTitleBar(this);

        PopulateData();
        RefreshRunningWindows();
    }

    private void PopulateData()
    {
        TxtTitle.Text = _entry.GameTitle;

        if (!string.IsNullOrEmpty(_entry.CoverImage))
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(_entry.CoverImage, UriKind.Absolute);
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.EndInit();
                ImgCover.Source = bitmap;
            }
            catch
            {
                // Fallback if image fails to load
            }
        }

        TxtWindowTitlePattern.Text = _entry.WindowTitlePattern ?? string.Empty;
        RefreshTrackedExesList();
    }

    private void RefreshTrackedExesList()
    {
        var exes = _entry.AllExecutables.ToList();
        ListTrackedExes.ItemsSource = null;
        ListTrackedExes.ItemsSource = exes;
        TxtNoDetections.Visibility = exes.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    }

    private void RefreshRunningWindows()
    {
        try
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
        catch
        {
            // Ignore capture failure
        }
    }

    private void BtnRemoveExe_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement el && el.Tag is string exe)
        {
            _entry.RemoveExecutable(exe);
            RefreshTrackedExesList();
            _onEntryUpdated();
        }
    }

    private void BtnAddFromRunning_Click(object sender, RoutedEventArgs e)
    {
        if (CmbRunningWindows.SelectedItem is WindowInfo win && !string.IsNullOrWhiteSpace(win.ExecutableName))
        {
            _entry.AddExecutable(win.ExecutableName);
            RefreshTrackedExesList();
            _onEntryUpdated();
        }
    }

    private void BtnBrowse_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new OpenFileDialog
        {
            Filter = "Executables (*.exe)|*.exe|All files (*.*)|*.*",
            Multiselect = true,
            Title = "Select Game Executables"
        };

        if (dlg.ShowDialog(this) == true)
        {
            foreach (var fn in dlg.FileNames)
            {
                var exe = Path.GetFileName(fn);
                if (!string.IsNullOrWhiteSpace(exe))
                {
                    _entry.AddExecutable(exe);
                }
            }
            RefreshTrackedExesList();
            _onEntryUpdated();
        }
    }

    private void BtnAddManual_Click(object sender, RoutedEventArgs e)
    {
        var input = TxtNewExe.Text.Trim();
        if (string.IsNullOrWhiteSpace(input)) return;

        var tokens = input.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var token in tokens)
        {
            var exe = WindowCaptureHelper.NormalizeExeName(token);
            if (!string.IsNullOrWhiteSpace(exe))
            {
                _entry.AddExecutable(exe);
            }
        }

        TxtNewExe.Text = string.Empty;
        RefreshTrackedExesList();
        _onEntryUpdated();
    }

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        _entry.WindowTitlePattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern.Text)
            ? null
            : TxtWindowTitlePattern.Text.Trim();

        _onEntryUpdated();
        DialogResult = true;
        Close();
    }

    private void BtnUnlinkGame_Click(object sender, RoutedEventArgs e)
    {
        var confirm = MessageBox.Show(
            this,
            $"Are you sure you want to unlink '{_entry.GameTitle}'?\n\nPlaytime tracking will stop, and the game will be removed from Iris extra.",
            "Confirm Unlink Game",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question
        );

        if (confirm == MessageBoxResult.Yes)
        {
            _onUnlinkRequested(_entry);
            DialogResult = true;
            Close();
        }
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
