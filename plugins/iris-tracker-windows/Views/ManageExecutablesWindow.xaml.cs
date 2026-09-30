using System;
using System.IO;
using System.Linq;
using System.Windows;
using Microsoft.Win32;
using IrisTracker.Models;
using IrisTracker.Services;

namespace IrisTracker.Views;

public partial class ManageExecutablesWindow : Window
{
    private readonly LinkedProcessEntry _entry;
    private readonly Action _onSave;

    public ManageExecutablesWindow(LinkedProcessEntry entry, Action onSave)
    {
        InitializeComponent();
        _entry = entry;
        _onSave = onSave;

        DarkTitleBarHelper.EnableDarkTitleBar(this);

        TxtGameTitle.Text = $"Executables for '{_entry.GameTitle}'";
        RefreshExecutablesList();
        RefreshRunningWindows();
    }

    private void RefreshExecutablesList()
    {
        var exes = _entry.AllExecutables.ToList();
        ListExecutables.ItemsSource = null;
        ListExecutables.ItemsSource = exes;
        TxtNoExes.Visibility = exes.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
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

    private void BtnRemoveExe_Click(object sender, RoutedEventArgs e)
    {
        if (sender is FrameworkElement el && el.Tag is string exe)
        {
            _entry.RemoveExecutable(exe);
            _onSave();
            RefreshExecutablesList();
        }
    }

    private void BtnAddFromRunning_Click(object sender, RoutedEventArgs e)
    {
        if (CmbRunningWindows.SelectedItem is WindowInfo win && !string.IsNullOrWhiteSpace(win.ExecutableName))
        {
            _entry.AddExecutable(win.ExecutableName);
            _onSave();
            RefreshExecutablesList();
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
            _onSave();
            RefreshExecutablesList();
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
        _onSave();
        RefreshExecutablesList();
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }
}
