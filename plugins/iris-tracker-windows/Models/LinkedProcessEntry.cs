using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;

namespace IrisTracker.Models;

public class LinkedProcessEntry : INotifyPropertyChanged
{
    private string _id = Guid.NewGuid().ToString();
    private int _gameId;
    private string _gameTitle = string.Empty;
    private string? _coverImage;
    private string _executableName = string.Empty;
    private string? _windowTitlePattern;
    private int _accumulatedSeconds;
    private int _irisProgressHours;
    private int _pendingSyncHours;
    private bool _isRunning;
    private bool _isPaused;
    private DateTime? _lastActiveAt;

    public bool IsPaused
    {
        get => _isPaused;
        set
        {
            if (SetField(ref _isPaused, value))
            {
                OnPropertyChanged(nameof(StatusBadgeText));
                OnPropertyChanged(nameof(StatusColor));
                OnPropertyChanged(nameof(PauseResumeButtonText));
            }
        }
    }

    public string Id
    {
        get => _id;
        set => SetField(ref _id, value);
    }

    public int GameId
    {
        get => _gameId;
        set => SetField(ref _gameId, value);
    }

    public string GameTitle
    {
        get => _gameTitle;
        set => SetField(ref _gameTitle, value);
    }

    public string? CoverImage
    {
        get => _coverImage;
        set => SetField(ref _coverImage, value);
    }

    public string ExecutableName
    {
        get => _executableName;
        set => SetField(ref _executableName, value);
    }

    public string? WindowTitlePattern
    {
        get => _windowTitlePattern;
        set => SetField(ref _windowTitlePattern, value);
    }

    public int AccumulatedSeconds
    {
        get => _accumulatedSeconds;
        set
        {
            if (SetField(ref _accumulatedSeconds, value))
            {
                OnPropertyChanged(nameof(ProgressFraction));
                OnPropertyChanged(nameof(ProgressPercentage));
                OnPropertyChanged(nameof(ProgressText));
                OnPropertyChanged(nameof(RemainingTimeText));
            }
        }
    }

    public int IrisProgressHours
    {
        get => _irisProgressHours;
        set
        {
            if (SetField(ref _irisProgressHours, value))
            {
                OnPropertyChanged(nameof(TotalLoggedHoursText));
            }
        }
    }

    public int PendingSyncHours
    {
        get => _pendingSyncHours;
        set
        {
            if (SetField(ref _pendingSyncHours, value))
            {
                OnPropertyChanged(nameof(HasPendingSync));
                OnPropertyChanged(nameof(PendingSyncText));
            }
        }
    }

    [JsonIgnore]
    public bool IsRunning
    {
        get => _isRunning;
        set
        {
            if (SetField(ref _isRunning, value))
            {
                OnPropertyChanged(nameof(StatusBadgeText));
                OnPropertyChanged(nameof(StatusColor));
            }
        }
    }

    public DateTime? LastActiveAt
    {
        get => _lastActiveAt;
        set => SetField(ref _lastActiveAt, value);
    }

    // --- Computed UI Properties ---

    [JsonIgnore]
    public double ProgressPercentage
    {
        get => Math.Min(100.0, Math.Round((double)AccumulatedSeconds / 3600.0 * 100.0, 1));
        set { }
    }

    [JsonIgnore]
    public double ProgressFraction
    {
        get => Math.Min(1.0, (double)AccumulatedSeconds / 3600.0);
        set { }
    }

    [JsonIgnore]
    public string ProgressText
    {
        get
        {
            int mins = AccumulatedSeconds / 60;
            int secs = AccumulatedSeconds % 60;
            return $"{mins:D2}m {secs:D2}s / 60m ({ProgressPercentage:0.#}%)";
        }
    }

    [JsonIgnore]
    public string RemainingTimeText
    {
        get
        {
            int remainingSecs = Math.Max(0, 3600 - AccumulatedSeconds);
            int mins = remainingSecs / 60;
            int secs = remainingSecs % 60;
            return $"{mins}m {secs}s to +1h";
        }
    }

    [JsonIgnore]
    public string TotalLoggedHoursText => $"{IrisProgressHours} hrs in IRIS";

    [JsonIgnore]
    public string StatusBadgeText
    {
        get
        {
            if (IsPaused) return "PAUSED";
            return IsRunning ? "TRACKING" : "STOPPED";
        }
    }

    [JsonIgnore]
    public string StatusColor
    {
        get
        {
            if (IsPaused) return "#F59E0B"; // Amber
            return IsRunning ? "#10B981" : "#71717A";
        }
    }

    [JsonIgnore]
    public string PauseResumeButtonText => IsPaused ? "Resume" : "Pause";

    [JsonIgnore]
    public bool HasPendingSync => PendingSyncHours > 0;

    [JsonIgnore]
    public string PendingSyncText => $"{PendingSyncHours} hr pending sync";

    // --- INotifyPropertyChanged Implementation ---

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    protected bool SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (Equals(field, value)) return false;
        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }
}
