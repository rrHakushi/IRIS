using System;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using IrisTracker.Models;
using IrisTracker.Services;
using QRCoder;

namespace IrisTracker.Views;

public partial class LoginControl : System.Windows.Controls.UserControl
{
    private readonly IrisApiClient _api;
    private readonly StorageService _storage;
    private DispatcherTimer? _quickConnectPollTimer;
    private string? _currentSessionToken;
    private string? _pendingMfaTicket;

    public event Action<IrisUser, string>? LoggedIn;
    public event Action? Cancelled;

    public LoginControl(IrisApiClient api, StorageService storage, bool isAddingAccount = false)
    {
        InitializeComponent();
        _api = api;
        _storage = storage;

        var settings = _storage.LoadSettings();
        TxtApiUrl.Text = settings.ApiBaseUrl;

        if (isAddingAccount || (settings.Accounts != null && settings.Accounts.Count > 0))
        {
            BtnCancelAddAccount.Visibility = Visibility.Visible;
            if (isAddingAccount)
            {
                TxtLoginSubtitle.Text = "Add IRIS Account";
            }
        }

        Loaded += async (s, e) =>
        {
            if (PanelQuickConnect.Visibility == Visibility.Visible)
            {
                await StartQuickConnectAsync();
            }
        };

        Unloaded += (s, e) => Cleanup();
    }

    private void BtnCancelAddAccount_Click(object sender, RoutedEventArgs e)
    {
        Cleanup();
        Cancelled?.Invoke();
    }

    public void Cleanup()
    {
        StopQuickConnectPolling();
    }

    private void BtnTabQuickConnect_Click(object sender, RoutedEventArgs e)
    {
        PanelQuickConnect.Visibility = Visibility.Visible;
        PanelPassword.Visibility = Visibility.Collapsed;
        PanelMfa.Visibility = Visibility.Collapsed;
        HideError();

        BtnTabQuickConnect.Background = (System.Windows.Media.Brush)FindResource("RosePrimaryBrush");
        BtnTabQuickConnect.Foreground = System.Windows.Media.Brushes.White;

        BtnTabPassword.Background = System.Windows.Media.Brushes.Transparent;
        BtnTabPassword.Foreground = (System.Windows.Media.Brush)FindResource("TextPrimaryBrush");

        _ = StartQuickConnectAsync();
    }

    private void BtnTabPassword_Click(object sender, RoutedEventArgs e)
    {
        StopQuickConnectPolling();
        PanelQuickConnect.Visibility = Visibility.Collapsed;
        PanelPassword.Visibility = Visibility.Visible;
        PanelMfa.Visibility = Visibility.Collapsed;
        HideError();

        BtnTabPassword.Background = (System.Windows.Media.Brush)FindResource("RosePrimaryBrush");
        BtnTabPassword.Foreground = System.Windows.Media.Brushes.White;

        BtnTabQuickConnect.Background = System.Windows.Media.Brushes.Transparent;
        BtnTabQuickConnect.Foreground = (System.Windows.Media.Brush)FindResource("TextPrimaryBrush");
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
            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.StreamSource = stream;
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.EndInit();
            bitmap.Freeze();

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

            // Verify we're still interested in this session token
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
            // Transient connection failure; continue polling unless stopped
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

    private async void BtnRefreshCode_Click(object sender, RoutedEventArgs e)
    {
        await StartQuickConnectAsync();
    }

    private async void BtnSignIn_Click(object sender, RoutedEventArgs e)
    {
        // Immediately halt any background QuickConnect polling when using password login
        StopQuickConnectPolling();
        HideError();

        var apiUrl = TxtApiUrl.Text.Trim();
        var identifier = TxtIdentifier.Text.Trim();
        var password = TxtPassword.Password;

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
                // Switch to MFA verification screen
                _pendingMfaTicket = res.MfaTicket;
                PanelPassword.Visibility = Visibility.Collapsed;
                PanelMfa.Visibility = Visibility.Visible;
                TxtMfaCode.Text = string.Empty;
                TxtMfaCode.Focus();
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

    private void CmbMfaType_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (BtnSendMfaEmail == null || CmbMfaType == null) return;

        if (CmbMfaType.SelectedItem is ComboBoxItem item)
        {
            var type = item.Tag?.ToString() ?? "totp";
            BtnSendMfaEmail.Visibility = type == "email" ? Visibility.Visible : Visibility.Collapsed;
        }
    }

    private async void BtnSendMfaEmail_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_pendingMfaTicket)) return;

        HideError();
        BtnSendMfaEmail.IsEnabled = false;
        BtnSendMfaEmail.Content = "Sending Email...";

        try
        {
            await _api.SendMfaEmailAsync(_pendingMfaTicket);
            MessageBox.Show("A verification code was sent to your email address.", "Code Sent", MessageBoxButton.OK, MessageBoxImage.Information);
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

    private async void BtnVerifyMfa_Click(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_pendingMfaTicket))
        {
            ShowError("MFA session expired. Please log in again.");
            return;
        }

        var code = TxtMfaCode.Text.Trim();
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

    private void BtnBackFromMfa_Click(object sender, RoutedEventArgs e)
    {
        _pendingMfaTicket = null;
        PanelMfa.Visibility = Visibility.Collapsed;
        PanelPassword.Visibility = Visibility.Visible;
        HideError();
    }

    private void SaveSessionAndNotify(IrisUser user, string token)
    {
        // Guarantee polling is completely stopped
        StopQuickConnectPolling();

        var settings = _storage.LoadSettings();
        var account = new UserAccount
        {
            UserId = user.Id,
            Username = user.Username,
            UserEmail = user.Email,
            EncryptedToken = StorageService.ProtectString(token),
            ApiBaseUrl = _api.BaseUrl,
            LastActiveAt = DateTime.UtcNow
        };
        _storage.AddOrUpdateAccount(settings, account);

        _api.AuthToken = token;
        LoggedIn?.Invoke(user, token);
    }

    private void ShowError(string message)
    {
        TxtError.Text = message;
        BorderError.Visibility = Visibility.Visible;
    }

    private void HideError()
    {
        BorderError.Visibility = Visibility.Collapsed;
    }
}
