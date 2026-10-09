using System;
using System.IO;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Platform.Storage;
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

    public GameEditModalWindow()
    {
        InitializeComponent();
        _entry = new LinkedProcessEntry();
        _api = new IrisApiClient();
        _username = string.Empty;
        _onEntryUpdated = () => { };
        _onUnlinkRequested = _ => { };
    }

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

        PopulateData();
        RefreshRunningProcesses();
    }

    private async void PopulateData()
    {
        TxtTitle.Text = _entry.GameTitle;
        TxtIrisProgress.Text = _entry.TotalLoggedHoursText;

        if (!string.IsNullOrEmpty(_entry.CoverImage))
        {
            var bitmap = await ImageHelper.LoadFromWebAsync(_entry.CoverImage);
            if (bitmap != null)
            {
                ImgCover.Source = bitmap;
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
        TxtNoDetections.IsVisible = exes.Count == 0;
    }

    private List<RunningProcessInfo> _runningProcesses = new();

    private void RefreshRunningProcesses()
    {
        _runningProcesses = ProcessDetector.GetRunningProcesses();
        CmbRunningProcesses.ItemsSource = _runningProcesses.Select(p => p.DisplayText).ToList();
        if (_runningProcesses.Count > 0)
        {
            CmbRunningProcesses.SelectedIndex = 0;
        }
    }

    private void BtnRemoveExe_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is string exe)
        {
            _entry.RemoveExecutable(exe);
            RefreshTrackedExesList();
            _onEntryUpdated();
        }
    }

    private void BtnAddFromRunning_Click(object? sender, RoutedEventArgs e)
    {
        int idx = CmbRunningProcesses.SelectedIndex;
        if (idx >= 0 && idx < _runningProcesses.Count)
        {
            var proc = _runningProcesses[idx];
            if (!string.IsNullOrWhiteSpace(proc.Name))
            {
                _entry.AddExecutable(proc.Name);
                if (string.IsNullOrWhiteSpace(_entry.WindowTitlePattern) && !string.IsNullOrWhiteSpace(proc.WindowTitle))
                {
                    _entry.WindowTitlePattern = proc.WindowTitle;
                    TxtWindowTitlePattern.Text = proc.WindowTitle;
                }
                RefreshTrackedExesList();
                _onEntryUpdated();
            }
        }
    }

    private async void BtnBrowse_Click(object? sender, RoutedEventArgs e)
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
                foreach (var f in files)
                {
                    var exe = Path.GetFileName(f.Path.LocalPath);
                    if (!string.IsNullOrWhiteSpace(exe))
                    {
                        _entry.AddExecutable(exe);
                    }
                }
                RefreshTrackedExesList();
                _onEntryUpdated();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GameEditModal] Browse error: {ex.Message}");
        }
    }

    private void BtnAddManual_Click(object? sender, RoutedEventArgs e)
    {
        var input = TxtNewExe.Text?.Trim();
        if (string.IsNullOrWhiteSpace(input)) return;

        var tokens = input.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var token in tokens)
        {
            var exe = ProcessDetector.NormalizeExeName(token);
            if (!string.IsNullOrWhiteSpace(exe))
            {
                _entry.AddExecutable(exe);
            }
        }

        TxtNewExe.Text = string.Empty;
        RefreshTrackedExesList();
        _onEntryUpdated();
    }

    private void BtnSave_Click(object? sender, RoutedEventArgs e)
    {
        _entry.WindowTitlePattern = string.IsNullOrWhiteSpace(TxtWindowTitlePattern.Text)
            ? null
            : TxtWindowTitlePattern.Text.Trim();

        _onEntryUpdated();
        Close();
    }

    private void BtnUnlinkGame_Click(object? sender, RoutedEventArgs e)
    {
        _onUnlinkRequested(_entry);
        Close();
    }

    private void BtnClose_Click(object? sender, RoutedEventArgs e)
    {
        Close();
    }
}
