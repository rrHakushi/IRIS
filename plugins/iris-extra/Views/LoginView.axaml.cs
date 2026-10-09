using System;
using System.IO;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using IrisTracker.Models;
using IrisTracker.Services;
using QRCoder;

namespace IrisTracker.Views;

public partial class LoginView : UserControl
{
    private readonly IrisApiClient _api;
    private readonly StorageService _storage;
    private DispatcherTimer? _quickConnectPollTimer;
    private string? _currentSessionToken;
    private string? _pendingMfaTicket;

    public event Action<IrisUser, string>? LoggedIn;

    public LoginView() : this(new IrisApiClient(), new StorageService())
    {
    }

    public LoginView(IrisApiClient api, StorageService storage)
    {
        InitializeComponent();
        _api = api;
        _storage = storage;

        var settings = _storage.LoadSettings();
        TxtApiUrl.Text = settings.ApiBaseUrl;

        AttachedToVisualTree += async (s, e) =>
        {
            if (PanelQuickConnect.IsVisible)
            {
                await StartQuickConnectAsync();
            }
        };

        DetachedFromVisualTree += (s, e) => Cleanup();
    }

    public void Cleanup()
    {
        StopQuickConnectPolling();
    }

    private void BtnTabQuickConnect_Click(object? sender, RoutedEventArgs e)
    {
        PanelQuickConnect.IsVisible = true;
        PanelPassword.IsVisible = false;
        PanelMfa.IsVisible = false;
        HideError();

        BtnTabQuickConnect.Classes.Clear();
        BtnTabQuickConnect.Classes.Add("btn-primary");

        BtnTabPassword.Classes.Clear();
        BtnTabPassword.Classes.Add("btn-ghost");

        _ = StartQuickConnectAsync();
    }

    private void BtnTabPassword_Click(object? sender, RoutedEventArgs e)
    {
        StopQuickConnectPolling();
        PanelQuickConnect.IsVisible = false;
        PanelPassword.IsVisible = true;
        PanelMfa.IsVisible = false;
        HideError();

        BtnTabPassword.Classes.Clear();
        BtnTabPassword.Classes.Add("btn-primary");

        BtnTabQuickConnect.Classes.Clear();
        BtnTabQuickConnect.Classes.Add("btn-ghost");
    }

    private async Task StartQuickConnectAsync()
    {
        StopQuickConnectPolling();
        HideError();
        TxtQuickStatus.Text = "Generating session...";

        try
        {
            var gen = await _api.QuickConnectGenerateAsync(Environment.MachineName);
            _currentSessionToken = gen.SessionToken;
            TxtPairingCode.Text = gen.Code;
            TxtQuickStatus.Text = "Waiting for approval in IRIS...";

            RenderQrCode(gen.QrPayload);

            _quickConnectPollTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(2.5)
            };
            _quickConnectPollTimer.Tick += async (s, e) => await PollQuickConnectStatusAsync();
            _quickConnectPollTimer.Start();
        }
        catch (Exception ex)
        {
            TxtQuickStatus.Text = "Failed to connect to server";
            ShowError($"Quick Connect error: {ex.Message}");
        }
    }

    private void RenderQrCode(string payload)
    {
        try
        {
            using var generator = new QRCodeGenerator();
            using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
            var qrCode = new PngByteQRCode(data);
            byte[] bytes = qrCode.GetGraphic(10);

            using var stream = new MemoryStream(bytes);
            var bitmap = new Bitmap(stream);
            ImgQrCode.Source = bitmap;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[QR Render Error] {ex.Message}");
        }
    }

    private async Task PollQuickConnectStatusAsync()
    {
        var token = _currentSessionToken;
        if (string.IsNullOrEmpty(token) || _quickConnectPollTimer == null) return;

        try
        {
            var status = await _api.QuickConnectCheckStatusAsync(token);

            if (_currentSessionToken != token) return;

            if (status.Status == "approved" && status.User != null && !string.IsNullOrEmpty(status.Token))
            {
                StopQuickConnectPolling();
                TxtQuickStatus.Text = "Approved! Logging in...";
                SaveSessionAndNotify(status.User, status.Token);
            }
            else if (status.Status == "expired")
            {
                StopQuickConnectPolling();
                TxtQuickStatus.Text = "Code expired. Please regenerate.";
            }
        }
        catch
        {
            // Transient network failure; keep polling
        }
    }

    public void StopQuickConnectPolling()
    {
        if (_quickConnectPollTimer != null)
        {
            _quickConnectPollTimer.Stop();
            _quickConnectPollTimer = null;
        }
        _currentSessionToken = null;
    }

    private async void BtnRefreshCode_Click(object? sender, RoutedEventArgs e)
    {
        await StartQuickConnectAsync();
    }

    private async void BtnSignIn_Click(object? sender, RoutedEventArgs e)
    {
        StopQuickConnectPolling();
        HideError();

        var apiUrl = TxtApiUrl.Text?.Trim() ?? string.Empty;
        var identifier = TxtIdentifier.Text?.Trim() ?? string.Empty;
        var password = TxtPassword.Text ?? string.Empty;

        if (string.IsNullOrWhiteSpace(apiUrl))
        {
            ShowError("Please specify the API URL.");
            return;
        }

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrWhiteSpace(password))
        {
            ShowError("Please enter your username/email and password.");
            return;
        }

        BtnSignIn.IsEnabled = false;
        BtnSignIn.Content = "Signing In...";
        _api.BaseUrl = apiUrl;

        try
        {
            var res = await _api.LoginAsync(identifier, password);
            if (res.MfaRequired && !string.IsNullOrEmpty(res.MfaTicket))
            {
                _pendingMfaTicket = res.MfaTicket;
                PanelPassword.IsVisible = false;
                PanelMfa.IsVisible = true;
                TxtMfaCode.Text = string.Empty;
            }
            else if (res.Success && res.User != null && !string.IsNullOrEmpty(res.Token))
            {
                SaveSessionAndNotify(res.User, res.Token);
            }
            else
            {
                ShowError("Invalid credentials or login rejected.");
            }
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            BtnSignIn.IsEnabled = true;
            BtnSignIn.Content = "Sign In";
        }
    }

    private void CmbMfaType_SelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        if (BtnSendMfaEmail == null || CmbMfaType == null) return;

        if (CmbMfaType.SelectedItem is ComboBoxItem item)
        {
            var type = item.Tag?.ToString() ?? "totp";
            BtnSendMfaEmail.IsVisible = type == "email";
        }
    }

    private async void BtnSendMfaEmail_Click(object? sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_pendingMfaTicket)) return;

        HideError();
        BtnSendMfaEmail.IsEnabled = false;
        BtnSendMfaEmail.Content = "Sending Email...";

        try
        {
            await _api.SendMfaEmailAsync(_pendingMfaTicket);
            DesktopIntegration.ShowNotification("IRIS Tracker", "Verification code sent to your email.");
        }
        catch (Exception ex)
        {
            ShowError($"Failed to send email: {ex.Message}");
        }
        finally
        {
            BtnSendMfaEmail.IsEnabled = true;
            BtnSendMfaEmail.Content = "Send Code to Email";
        }
    }

    private async void BtnVerifyMfa_Click(object? sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_pendingMfaTicket))
        {
            ShowError("MFA session expired. Please log in again.");
            return;
        }

        var code = TxtMfaCode.Text?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(code))
        {
            ShowError("Please enter your verification code.");
            return;
        }

        var selectedType = (CmbMfaType.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "totp";

        BtnVerifyMfa.IsEnabled = false;
        BtnVerifyMfa.Content = "Verifying...";
        HideError();

        try
        {
            var res = await _api.VerifyMfaAsync(_pendingMfaTicket, code, selectedType);
            if (res.Success && res.User != null && !string.IsNullOrEmpty(res.Token))
            {
                SaveSessionAndNotify(res.User, res.Token);
            }
            else
            {
                ShowError("Verification code was incorrect or expired.");
            }
        }
        catch (Exception ex)
        {
            ShowError(ex.Message);
        }
        finally
        {
            BtnVerifyMfa.IsEnabled = true;
            BtnVerifyMfa.Content = "Verify & Sign In";
        }
    }

    private void BtnBackFromMfa_Click(object? sender, RoutedEventArgs e)
    {
        _pendingMfaTicket = null;
        PanelMfa.IsVisible = false;
        PanelPassword.IsVisible = true;
        HideError();
    }

    private void SaveSessionAndNotify(IrisUser user, string token)
    {
        StopQuickConnectPolling();

        var settings = _storage.LoadSettings();
        settings.UserId = user.Id;
        settings.Username = user.Username;
        settings.UserEmail = user.Email;
        settings.EncryptedToken = StorageService.ProtectString(token);
        settings.ApiBaseUrl = _api.BaseUrl;
        _storage.SaveSettings(settings);

        _api.AuthToken = token;
        LoggedIn?.Invoke(user, token);
    }

    private void ShowError(string message)
    {
        TxtError.Text = message;
        BorderError.IsVisible = true;
    }

    private void HideError()
    {
        BorderError.IsVisible = false;
    }
}
