using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;

namespace IrisTracker.Models;

public class LinkedProcessEntry : INotifyPropertyChanged
{
    private string _id = Guid.NewGuid().ToString();
    private string? _userId;
    private int _gameId;
    private string _gameTitle = string.Empty;
    private string? _coverImage;
    private string? _bannerImage;
    private string _executableName = string.Empty;
    private List<string> _executableNames = new();
    private string? _windowTitlePattern;
    private int _accumulatedSeconds;
    private int _irisProgressHours;
    private int _pendingSyncHours;
    private bool _isRunning;
    private bool _isPaused;
    private DateTime? _lastActiveAt;

    private double? _score;
    private string? _status;
    private string? _notes;
    private int? _replayed;
    private string? _startedAt;
    private string? _completedAt;

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

    public string? UserId
    {
        get => _userId;
        set => SetField(ref _userId, value);
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

    public string? BannerImage
    {
        get => _bannerImage;
        set => SetField(ref _bannerImage, value);
    }

    public string ExecutableName
    {
        get
        {
            if (_executableNames.Count > 0)
                return string.Join(", ", _executableNames);
            return _executableName;
        }
        set
        {
            if (SetField(ref _executableName, value))
            {
                if (!string.IsNullOrWhiteSpace(value) && !_executableNames.Contains(value, StringComparer.OrdinalIgnoreCase))
                {
                    _executableNames.Add(value);
                }
                OnPropertyChanged(nameof(ExecutablesDisplay));
                OnPropertyChanged(nameof(AllExecutables));
                OnPropertyChanged(nameof(ExecutablesCountBadge));
            }
        }
    }

    public List<string> ExecutableNames
    {
        get => _executableNames;
        set
        {
            if (SetField(ref _executableNames, value ?? new List<string>()))
            {
                OnPropertyChanged(nameof(ExecutableName));
                OnPropertyChanged(nameof(ExecutablesDisplay));
                OnPropertyChanged(nameof(AllExecutables));
                OnPropertyChanged(nameof(ExecutablesCountBadge));
            }
        }
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

    public double? Score
    {
        get => _score;
        set => SetField(ref _score, value);
    }

    public string? Status
    {
        get => _status;
        set => SetField(ref _status, value);
    }

    public string? Notes
    {
        get => _notes;
        set => SetField(ref _notes, value);
    }

    public int? Replayed
    {
        get => _replayed;
        set => SetField(ref _replayed, value);
    }

    public string? StartedAt
    {
        get => _startedAt;
        set => SetField(ref _startedAt, value);
    }

    public string? CompletedAt
    {
        get => _completedAt;
        set => SetField(ref _completedAt, value);
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
            return IsRunning ? "#10B981" : "#71717A"; // Emerald : Gray
        }
    }

    [JsonIgnore]
    public string PauseResumeButtonText => IsPaused ? "Resume" : "Pause";

    [JsonIgnore]
    public bool HasPendingSync => PendingSyncHours > 0;

    [JsonIgnore]
    public string PendingSyncText => $"{PendingSyncHours} hr pending sync";

    [JsonIgnore]
    public IReadOnlyList<string> AllExecutables
    {
        get
        {
            var list = new List<string>(_executableNames);
            if (!string.IsNullOrWhiteSpace(_executableName) && !list.Contains(_executableName, StringComparer.OrdinalIgnoreCase))
            {
                list.Insert(0, _executableName);
            }
            return list.Count > 0 ? list : Array.Empty<string>();
        }
    }

    [JsonIgnore]
    public string ExecutablesDisplay => AllExecutables.Count > 0
        ? string.Join(", ", AllExecutables)
        : "(No executables linked)";

    [JsonIgnore]
    public string ExecutablesCountBadge => AllExecutables.Count > 1
        ? $"{AllExecutables.Count} exes"
        : (AllExecutables.Count == 1 ? "1 exe" : "0 exes");

    public void AddExecutable(string exe)
    {
        if (string.IsNullOrWhiteSpace(exe)) return;
        var clean = exe.Trim();
        if (!_executableNames.Contains(clean, StringComparer.OrdinalIgnoreCase))
        {
            _executableNames.Add(clean);
            OnPropertyChanged(nameof(ExecutableNames));
            OnPropertyChanged(nameof(ExecutableName));
            OnPropertyChanged(nameof(ExecutablesDisplay));
            OnPropertyChanged(nameof(ExecutablesCountBadge));
            OnPropertyChanged(nameof(AllExecutables));
        }
    }

    public void RemoveExecutable(string exe)
    {
        if (string.IsNullOrWhiteSpace(exe)) return;
        var clean = exe.Trim();
        if (_executableNames.RemoveAll(x => x.Equals(clean, StringComparison.OrdinalIgnoreCase)) > 0)
        {
            if (_executableName.Equals(clean, StringComparison.OrdinalIgnoreCase))
            {
                _executableName = _executableNames.Count > 0 ? _executableNames[0] : string.Empty;
            }
            OnPropertyChanged(nameof(ExecutableNames));
            OnPropertyChanged(nameof(ExecutableName));
            OnPropertyChanged(nameof(ExecutablesDisplay));
            OnPropertyChanged(nameof(ExecutablesCountBadge));
            OnPropertyChanged(nameof(AllExecutables));
        }
    }

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
