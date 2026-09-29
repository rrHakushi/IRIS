using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows;
using System.Windows.Controls;
using Hardcodet.Wpf.TaskbarNotification;
using IrisTracker.Models;
using IrisTracker.Services;
using IrisTracker.Views;

namespace IrisTracker;

public partial class MainWindow : Window
{
    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly ProcessTrackerService _tracker;
    private readonly TaskbarIcon _notifyIcon;
    private bool _isExplicitExit;

    public MainWindow()
    {
        InitializeComponent();

        _storage = new StorageService();
        var settings = _storage.LoadSettings();

        string? token = StorageService.UnprotectString(settings.EncryptedToken);
        _api = new IrisApiClient(settings.ApiBaseUrl, token);
        _tracker = new ProcessTrackerService(_storage, _api);

        _notifyIcon = SetupNotifyIcon();
        DarkTitleBarHelper.EnableDarkTitleBar(this);

        Loaded += (s, e) => NavigateToInitialView();
        Closing += OnWindowClosing;
    }

    private void NavigateToInitialView()
    {
        var settings = _storage.LoadSettings();
        string? token = StorageService.UnprotectString(settings.EncryptedToken);

        if (!string.IsNullOrEmpty(token) && !string.IsNullOrEmpty(settings.Username))
        {
            ShowTrackerView();
        }
        else
        {
            ShowLoginView();
        }
    }

    private void ShowLoginView()
    {
        var login = new LoginControl(_api, _storage);
        login.LoggedIn += (user, token) =>
        {
            login.Cleanup();
            ShowTrackerView();
        };

        RootContainer.Children.Clear();
        RootContainer.Children.Add(login);
    }

    private void ShowTrackerView()
    {
        var tracker = new TrackerControl(_tracker, _api, _storage);
        tracker.LoggedOut += () =>
        {
            ShowLoginView();
        };

        tracker.ShowNotification += (title, message) =>
        {
            var settings = _storage.LoadSettings();
            if (settings.NotifyOnHourIncrement)
            {
                _notifyIcon.ShowBalloonTip(title, message, BalloonIcon.Info);
            }
        };

        RootContainer.Children.Clear();
        RootContainer.Children.Add(tracker);
    }

    private TaskbarIcon SetupNotifyIcon()
    {
        var icon = new TaskbarIcon
        {
            ToolTipText = "IRIS Time Tracker",
            Icon = CreateAppIcon()
        };

        var menu = new ContextMenu();

        var openItem = new MenuItem { Header = "Open IRIS Tracker" };
        openItem.Click += (s, e) => RestoreWindow();
        menu.Items.Add(openItem);

        var syncItem = new MenuItem { Header = "Sync Pending Hours" };
        syncItem.Click += async (s, e) => await _tracker.SyncPendingIncrementsAsync();
        menu.Items.Add(syncItem);

        menu.Items.Add(new Separator());

        var exitItem = new MenuItem { Header = "Exit" };
        exitItem.Click += (s, e) =>
        {
            _isExplicitExit = true;
            _tracker.Stop();
            icon.Dispose();
            Close();
            System.Windows.Application.Current.Shutdown();
        };
        menu.Items.Add(exitItem);

        icon.ContextMenu = menu;
        icon.TrayMouseDoubleClick += (s, e) => RestoreWindow();

        return icon;
    }

    private static Icon CreateAppIcon()
    {
        try
        {
            using var bmp = new Bitmap(32, 32);
            using var g = Graphics.FromImage(bmp);
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

            // Mauve dark background circle
            using var bgBrush = new SolidBrush(Color.FromArgb(30, 27, 32));
            g.FillEllipse(bgBrush, 1, 1, 30, 30);

            // Rose accent ring
            using var ringPen = new Pen(Color.FromArgb(244, 63, 94), 2.5f);
            g.DrawEllipse(ringPen, 3, 3, 26, 26);

            // Clock hands
            using var handPen = new Pen(Color.White, 2f);
            g.DrawLine(handPen, 16, 16, 16, 9);
            g.DrawLine(handPen, 16, 16, 22, 16);

            var hIcon = bmp.GetHicon();
            return System.Drawing.Icon.FromHandle(hIcon);
        }
        catch
        {
            return SystemIcons.Application;
        }
    }

    private void RestoreWindow()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    private void OnWindowClosing(object? sender, CancelEventArgs e)
    {
        if (_isExplicitExit) return;

        var settings = _storage.LoadSettings();
        if (settings.MinimizeToTrayOnClose)
        {
            e.Cancel = true;
            Hide();
            _notifyIcon.ShowBalloonTip(
                "IRIS Time Tracker",
                "Tracker is running in the background. Double-click tray icon to restore.",
                BalloonIcon.Info
            );
        }
        else
        {
            _tracker.Stop();
            _notifyIcon.Dispose();
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        base.OnClosed(e);
        _notifyIcon.Dispose();
    }
}