using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;

namespace IrisTracker;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
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
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        LogCrash("DispatcherUnhandledException", e.Exception);
        e.Handled = true;

        MessageBox.Show(
            $"An unexpected error occurred in IRIS Tracker:\n\n{e.Exception.Message}\n\nDetails have been logged to the app data folder.",
            "IRIS Tracker Error",
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
                "IrisTracker"
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

