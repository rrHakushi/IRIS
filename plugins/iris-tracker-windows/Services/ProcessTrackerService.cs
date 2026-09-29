using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using IrisTracker.Models;

namespace IrisTracker.Services;

public class ProcessTrackerService
{
    private readonly StorageService _storage;
    private readonly IrisApiClient _api;
    private readonly DispatcherTimer _trackerTimer;
    private readonly DispatcherTimer _syncRetryTimer;
    private int _secondsSinceLastSave;

    public ObservableCollection<LinkedProcessEntry> Entries { get; } = new();

    public event Action<LinkedProcessEntry, int>? HourIncremented;
    public event Action<LinkedProcessEntry, string>? SyncSucceeded;
    public event Action<LinkedProcessEntry, Exception>? SyncFailed;

    public ProcessTrackerService(StorageService storage, IrisApiClient api)
    {
        _storage = storage;
        _api = api;

        // Load existing saved entries for active user
        var settings = _storage.LoadSettings();
        var loaded = _storage.LoadEntries(settings.ActiveUserId);
        foreach (var entry in loaded)
        {
            entry.IsRunning = false;
            Entries.Add(entry);
        }

        // Main 1-second tracking loop
        _trackerTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(1)
        };
        _trackerTimer.Tick += OnTrackerTick;

        // Periodic 30-second retry loop for queued offline increments
        _syncRetryTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(30)
        };
        _syncRetryTimer.Tick += async (s, e) => await SyncPendingIncrementsAsync();
    }

    public void ReloadEntries(string? activeUserId = null)
    {
        bool wasRunning = _trackerTimer.IsEnabled;
        if (wasRunning)
        {
            _trackerTimer.Stop();
            _syncRetryTimer.Stop();
        }

        foreach (var entry in Entries)
        {
            entry.IsRunning = false;
        }
        SaveNow();

        Entries.Clear();
        var loaded = _storage.LoadEntries(activeUserId);
        foreach (var entry in loaded)
        {
            entry.IsRunning = false;
            Entries.Add(entry);
        }

        if (wasRunning)
        {
            Start();
        }
    }

    public void Start()
    {
        if (!_trackerTimer.IsEnabled)
        {
            _trackerTimer.Start();
            _syncRetryTimer.Start();
        }
    }

    public void Stop()
    {
        _trackerTimer.Stop();
        _syncRetryTimer.Stop();
        foreach (var entry in Entries)
        {
            entry.IsRunning = false;
        }
        SaveNow();
    }

    public void AddEntry(LinkedProcessEntry entry)
    {
        Entries.Add(entry);
        SaveNow();
    }

    public void RemoveEntry(LinkedProcessEntry entry)
    {
        Entries.Remove(entry);
        SaveNow();
    }

    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> _syncLocks = new();

    private void OnTrackerTick(object? sender, EventArgs e)
    {
        bool anyRunning = false;

        foreach (var entry in Entries)
        {
            if (entry.IsPaused)
            {
                entry.IsRunning = false;
                continue;
            }

            bool running = false;
            var exes = entry.AllExecutables;
            if (exes.Count == 0 && !string.IsNullOrWhiteSpace(entry.ExecutableName))
            {
                exes = new[] { entry.ExecutableName };
            }

            // Check all linked executables; if multiple active, track ONLY ONE
            foreach (var exe in exes)
            {
                if (string.IsNullOrWhiteSpace(exe)) continue;
                if (WindowCaptureHelper.IsProcessOrWindowRunning(exe.Trim(), entry.WindowTitlePattern))
                {
                    running = true;
                    break; // If multiple active at the same time then only track one of them
                }
            }

            if (running)
            {
                anyRunning = true;
                entry.IsRunning = true;
                entry.AccumulatedSeconds++;
                entry.LastActiveAt = DateTime.UtcNow;

                // Hit 60 minutes (3600 seconds)
                if (entry.AccumulatedSeconds >= 3600)
                {
                    entry.AccumulatedSeconds -= 3600;
                    entry.IrisProgressHours++;
                    entry.PendingSyncHours++;

                    HourIncremented?.Invoke(entry, entry.IrisProgressHours);
                    _ = SyncEntryAsync(entry);
                }
            }
            else
            {
                if (entry.IsRunning)
                {
                    // Process just closed: stop counting and save immediately
                    entry.IsRunning = false;
                    SaveNow();
                }
            }
        }

        // Periodic auto-save while playing
        if (anyRunning)
        {
            _secondsSinceLastSave++;
            if (_secondsSinceLastSave >= 10)
            {
                _secondsSinceLastSave = 0;
                SaveNow();
            }
        }
    }

    public async Task SyncPendingIncrementsAsync()
    {
        var pending = Entries.Where(x => x.PendingSyncHours > 0).ToList();
        foreach (var entry in pending)
        {
            await SyncEntryAsync(entry);
        }
    }

    public async Task SyncEntryAsync(LinkedProcessEntry entry)
    {
        if (entry.PendingSyncHours <= 0) return;

        var sem = _syncLocks.GetOrAdd(entry.Id, _ => new SemaphoreSlim(1, 1));
        if (!await sem.WaitAsync(0))
        {
            // Another sync is already actively in progress for this entry.
            // Do not send parallel requests to prevent duplicate hour increments.
            return;
        }

        try
        {
            int hoursToSync = entry.PendingSyncHours;
            if (hoursToSync <= 0) return;

            var settings = _storage.LoadSettings();
            if (string.IsNullOrEmpty(settings.Username) || string.IsNullOrEmpty(_api.AuthToken))
            {
                // Not authenticated; remain in queue
                return;
            }

            // Deduct from pending queue upfront to prevent any other caller from reusing this batch
            entry.PendingSyncHours -= hoursToSync;
            SaveNow();

            try
            {
                var res = await _api.IncrementGameProgressAsync(
                    settings.Username,
                    entry.GameId,
                    hoursToSync
                );

                if (res.Success && res.Entry != null)
                {
                    entry.IrisProgressHours = res.Entry.Progress;
                    SaveNow();
                    SyncSucceeded?.Invoke(entry, $"Synced +{hoursToSync}h to IRIS (Total: {entry.IrisProgressHours}h)");
                }
            }
            catch (Exception ex)
            {
                // Restore the pending hours if the network request failed
                entry.PendingSyncHours += hoursToSync;
                SaveNow();
                SyncFailed?.Invoke(entry, ex);
            }
        }
        finally
        {
            sem.Release();
        }
    }

    public void SaveNow()
    {
        _storage.SaveEntries(Entries);
    }
}
