using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using IrisTracker.Services;

namespace IrisTracker;

public partial class App : System.Windows.Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Catch UI thread unhandled exceptions
        DispatcherUnhandledException += OnDispatcherUnhandledException;

        // Catch non-UI thread unhandled exceptions
        AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;

        // Catch unobserved background task exceptions
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        var storage = new StorageService();
        var settings = storage.LoadSettings();

        bool startInTray = settings.StartInTray ||
            e.Args.Any(a => a.Equals("--tray", StringComparison.OrdinalIgnoreCase) ||
                            a.Equals("-tray", StringComparison.OrdinalIgnoreCase) ||
                            a.Equals("/tray", StringComparison.OrdinalIgnoreCase));

        var mainWindow = new MainWindow(startInTray);
        MainWindow = mainWindow;

        if (!startInTray)
        {
            mainWindow.Show();
        }
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        LogCrash("DispatcherUnhandledException", e.Exception);
        e.Handled = true;

        MessageBox.Show(
            $"An unexpected error occurred in Iris extra:\n\n{e.Exception.Message}\n\nDetails have been logged to the app data folder.",
            "Iris extra Error",
            MessageBoxButton.OK,
            MessageBoxImage.Warning
        );
    }

    private void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
        {
            LogCrash("UnhandledException", ex);
        }
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        LogCrash("UnobservedTaskException", e.Exception);
        e.SetObserved();
    }

    private static void LogCrash(string category, Exception ex)
    {
        try
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "IRIS",
                "IrisExtra"
            );
            Directory.CreateDirectory(dir);

            var logPath = Path.Combine(dir, "crash.log");
            var content = $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss UTC}] [{category}]\n{ex}\n\n";
            File.AppendAllText(logPath, content);
        }
        catch
        {
            // Silently ignore disk logging failure
        }
    }
}
