using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("CDAC VCU Fault Analyser")]
[assembly: AssemblyDescription("ABB and CGL VCU fault and environment data analyser")]
[assembly: AssemblyCompany("ELS/ED")]
[assembly: AssemblyProduct("CDAC VCU Fault Analyser")]
[assembly: AssemblyCopyright("ELS/ED")]
[assembly: AssemblyVersion("5.0.0.0")]
[assembly: AssemblyFileVersion("5.0.0.0")]
[assembly: AssemblyInformationalVersion("5.0.0")]

namespace CdacVcuFaultAnalyser
{
    internal static class Program
    {
        private static Mutex instanceMutex;

        [STAThread]
        private static void Main(string[] args)
        {
            bool smokeTest = HasArgument(args, "--vcu-smoke-test");

            if (!smokeTest)
            {
                bool createdNew;
                instanceMutex = new Mutex(true, "Local\\CDAC_VCU_Fault_Analyser", out createdNew);
                if (!createdNew)
                {
                    MessageBox.Show(
                        "CDAC VCU Fault Analyser is already running.",
                        "CDAC VCU Fault Analyser",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return;
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs eventArgs)
            {
                if (smokeTest)
                {
                    Environment.Exit(1);
                }

                MessageBox.Show(
                    eventArgs.Exception.Message,
                    "CDAC VCU Fault Analyser",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            };

            Application.Run(new MainWindow(smokeTest));
            GC.KeepAlive(instanceMutex);
        }

        private static bool HasArgument(string[] args, string expected)
        {
            foreach (string arg in args)
            {
                if (string.Equals(arg, expected, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }
    }

    internal sealed class MainWindow : Form
    {
        private const string AppOrigin = "https://app.vcu.local/";
        private const string SmokeExportName = "cdac-v5-export-smoke.txt";
        private const string SmokeExportContents = "CDAC VCU v5 export smoke test";
        private readonly WebView2 browser;
        private readonly bool smokeTest;
        private readonly string viewerDirectory;
        private bool smokeFinished;
        private string smokeExportPath;
        private System.Windows.Forms.Timer smokeTimer;

        internal MainWindow(bool smokeTest)
        {
            this.smokeTest = smokeTest;
            viewerDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "viewer");

            Text = "CDAC VCU Fault Analyser";
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            MinimumSize = new Size(900, 650);
            BackColor = Color.FromArgb(238, 242, 247);

            try
            {
                Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                // The application remains usable if Windows cannot read the icon resource.
            }

            if (smokeTest)
            {
                ShowInTaskbar = false;
                WindowState = FormWindowState.Minimized;
                Opacity = 0;
            }

            browser = new WebView2();
            browser.Dock = DockStyle.Fill;
            Controls.Add(browser);
            Shown += InitializeBrowser;
        }

        private async void InitializeBrowser(object sender, EventArgs eventArgs)
        {
            Shown -= InitializeBrowser;

            try
            {
                if (!File.Exists(Path.Combine(viewerDirectory, "index.html")))
                {
                    throw new FileNotFoundException("The analyser viewer files are missing.");
                }

                string userDataDirectory = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "CDAC VCU Fault Analyser",
                    "WebView2");

                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(
                    null,
                    userDataDirectory,
                    null);
                await browser.EnsureCoreWebView2Async(environment);

                browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
                browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                browser.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
                browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
                browser.CoreWebView2.Settings.IsZoomControlEnabled = true;
                browser.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;

                browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "app.vcu.local",
                    viewerDirectory,
                    CoreWebView2HostResourceAccessKind.Deny);

                browser.CoreWebView2.NavigationStarting += RestrictNavigation;
                browser.CoreWebView2.NewWindowRequested += BlockNewWindow;
                browser.CoreWebView2.PermissionRequested += DenyPermission;
                browser.CoreWebView2.DownloadStarting += PrepareDownload;
                browser.CoreWebView2.ProcessFailed += BrowserProcessFailed;
                browser.NavigationCompleted += BrowserNavigationCompleted;

                try
                {
                    await browser.CoreWebView2.Profile.ClearBrowsingDataAsync(
                        CoreWebView2BrowsingDataKinds.AllProfile);
                }
                catch
                {
                    // Cache clearing is best-effort and must not prevent offline use.
                }

                browser.CoreWebView2.Navigate(AppOrigin + "index.html");
            }
            catch (Exception exception)
            {
                HandleStartupFailure(exception);
            }
        }

        private void RestrictNavigation(object sender, CoreWebView2NavigationStartingEventArgs eventArgs)
        {
            string uri = eventArgs.Uri ?? string.Empty;
            if (uri.StartsWith(AppOrigin, StringComparison.OrdinalIgnoreCase)
                || uri.StartsWith("blob:" + AppOrigin, StringComparison.OrdinalIgnoreCase)
                || string.Equals(uri, "about:blank", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            eventArgs.Cancel = true;
        }

        private void BlockNewWindow(object sender, CoreWebView2NewWindowRequestedEventArgs eventArgs)
        {
            eventArgs.Handled = true;
        }

        private void DenyPermission(object sender, CoreWebView2PermissionRequestedEventArgs eventArgs)
        {
            eventArgs.State = CoreWebView2PermissionState.Deny;
        }

        private void PrepareDownload(object sender, CoreWebView2DownloadStartingEventArgs eventArgs)
        {
            string suggestedName = Path.GetFileName(eventArgs.DownloadOperation.ResultFilePath);
            string safeName = SafeFileName(suggestedName);
            string destination;

            if (smokeTest)
            {
                if (!string.Equals(safeName, SmokeExportName, StringComparison.Ordinal))
                {
                    eventArgs.Cancel = true;
                    CompleteSmoke(1);
                    return;
                }

                smokeExportPath = Path.Combine(
                    Path.GetTempPath(),
                    "cdac-vcu-v5-smoke-" + Guid.NewGuid().ToString("N") + ".txt");
                destination = smokeExportPath;
            }
            else
            {
                string downloadsDirectory = GetDownloadsDirectory();
                Directory.CreateDirectory(downloadsDirectory);
                destination = UniquePath(downloadsDirectory, safeName);
            }

            eventArgs.ResultFilePath = destination;
            eventArgs.Handled = true;

            CoreWebView2DownloadOperation operation = eventArgs.DownloadOperation;
            operation.StateChanged += delegate
            {
                if (smokeTest)
                {
                    if (operation.State == CoreWebView2DownloadState.Completed)
                    {
                        BeginInvoke((Action)VerifySmokeExport);
                    }
                    else if (operation.State == CoreWebView2DownloadState.Interrupted)
                    {
                        BeginInvoke((Action)delegate { CompleteSmoke(1); });
                    }
                }
                else if (operation.State == CoreWebView2DownloadState.Completed)
                {
                    BeginInvoke((Action)delegate { ShowExportNotification(destination); });
                }
            };
        }

        private static string GetDownloadsDirectory()
        {
            Guid downloadsFolderId = new Guid("374DE290-123F-4565-9164-39C4925E467B");
            IntPtr pathPointer = IntPtr.Zero;

            try
            {
                if (SHGetKnownFolderPath(ref downloadsFolderId, 0, IntPtr.Zero, out pathPointer) == 0)
                {
                    string knownFolderPath = Marshal.PtrToStringUni(pathPointer);
                    if (!string.IsNullOrWhiteSpace(knownFolderPath))
                    {
                        return knownFolderPath;
                    }
                }
            }
            catch
            {
                // Fall back for older or restricted Windows installations.
            }
            finally
            {
                if (pathPointer != IntPtr.Zero)
                {
                    Marshal.FreeCoTaskMem(pathPointer);
                }
            }

            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "Downloads");
        }

        [DllImport("shell32.dll")]
        private static extern int SHGetKnownFolderPath(
            ref Guid folderId,
            uint flags,
            IntPtr token,
            out IntPtr path);

        private static string SafeFileName(string name)
        {
            string result = string.IsNullOrWhiteSpace(name) ? "vcu_export" : name.Trim();
            foreach (char invalid in Path.GetInvalidFileNameChars())
            {
                result = result.Replace(invalid, '_');
            }

            return string.IsNullOrWhiteSpace(result) ? "vcu_export" : result;
        }

        private static string UniquePath(string directory, string fileName)
        {
            string extension = Path.GetExtension(fileName);
            string baseName = Path.GetFileNameWithoutExtension(fileName);
            string candidate = Path.Combine(directory, fileName);
            int suffix = 2;

            while (File.Exists(candidate))
            {
                candidate = Path.Combine(directory, baseName + " (" + suffix + ")" + extension);
                suffix += 1;
            }

            return candidate;
        }

        private void ShowExportNotification(string destination)
        {
            NotifyIcon notification = new NotifyIcon();
            notification.Icon = Icon ?? SystemIcons.Application;
            notification.Visible = true;
            notification.BalloonTipTitle = "Export saved";
            notification.BalloonTipText = Path.GetFileName(destination);
            notification.BalloonTipIcon = ToolTipIcon.Info;
            notification.ShowBalloonTip(3000);

            System.Windows.Forms.Timer cleanupTimer = new System.Windows.Forms.Timer();
            cleanupTimer.Interval = 5000;
            cleanupTimer.Tick += delegate
            {
                cleanupTimer.Stop();
                notification.Dispose();
                cleanupTimer.Dispose();
            };
            cleanupTimer.Start();
        }

        private async void BrowserNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs eventArgs)
        {
            if (!smokeTest)
            {
                if (!eventArgs.IsSuccess)
                {
                    HandleStartupFailure(new InvalidOperationException("The analyser interface could not be loaded."));
                }
                return;
            }

            if (!eventArgs.IsSuccess)
            {
                CompleteSmoke(1);
                return;
            }

            browser.NavigationCompleted -= BrowserNavigationCompleted;

            const string validationScript = @"(() => {
                    const dictionary = window.VCU_DICTIONARIES;
                    const has = (setName, processor, code, text) =>
                        dictionary.ddsSets[setName].some(row =>
                            row.Processor === processor &&
                            row.Error_Info === code &&
                            row.Error_Text === text);
                    return Boolean(
                        document.querySelector('h1')?.textContent?.trim() === 'CDAC VCU FAULT ANALYSER' &&
                        document.getElementById('fileInput') &&
                        typeof window.VCUDecoder?.parseLog === 'function' &&
                        dictionary.ddsSets.ABB.length === 878 &&
                        dictionary.ddsSets.CGL.length === 554 &&
                        has('ABB', 'HBB1', 18, 'HBB1:0018-Auto Flasher light Activated') &&
                        has('ABB', 'HBB2', 18, 'HBB2:0018-Auto Flasher light Activated') &&
                        has('ABB', 'STB1', 14, 'STB1:0014-Water closet open') &&
                        has('CGL', 'HBB1', 18, 'HBB1:0018-Auto Flasher light Activated') &&
                        has('CGL', 'HBB2', 18, 'HBB2:0018-Auto Flasher light Activated') &&
                        has('CGL', 'STB1', 14, 'STB1:0014-Water closet open')
                    );
                })()";

            try
            {
                string result = await browser.CoreWebView2.ExecuteScriptAsync(validationScript);
                if (!string.Equals(result, "true", StringComparison.OrdinalIgnoreCase))
                {
                    CompleteSmoke(1);
                    return;
                }

                smokeTimer = new System.Windows.Forms.Timer();
                smokeTimer.Interval = 15000;
                smokeTimer.Tick += delegate { CompleteSmoke(1); };
                smokeTimer.Start();

                const string exportScript = @"(() => {
                    const blob = new Blob(['CDAC VCU v5 export smoke test'], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = 'cdac-v5-export-smoke.txt';
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    return true;
                })()";

                string exportResult = await browser.CoreWebView2.ExecuteScriptAsync(exportScript);
                if (!string.Equals(exportResult, "true", StringComparison.OrdinalIgnoreCase))
                {
                    CompleteSmoke(1);
                }
            }
            catch
            {
                CompleteSmoke(1);
            }
        }

        private void VerifySmokeExport()
        {
            bool valid = !string.IsNullOrWhiteSpace(smokeExportPath)
                && File.Exists(smokeExportPath)
                && string.Equals(
                    File.ReadAllText(smokeExportPath),
                    SmokeExportContents,
                    StringComparison.Ordinal);
            CompleteSmoke(valid ? 0 : 1);
        }

        private void CompleteSmoke(int exitCode)
        {
            if (smokeFinished)
            {
                return;
            }

            smokeFinished = true;
            if (smokeTimer != null)
            {
                smokeTimer.Stop();
                smokeTimer.Dispose();
            }

            try
            {
                if (!string.IsNullOrWhiteSpace(smokeExportPath) && File.Exists(smokeExportPath))
                {
                    File.Delete(smokeExportPath);
                }
            }
            catch
            {
                // A leftover temporary smoke-test file must not change the result.
            }

            Environment.Exit(exitCode);
        }

        private void BrowserProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs eventArgs)
        {
            if (smokeTest)
            {
                CompleteSmoke(1);
            }

            MessageBox.Show(
                "The Windows web-view process stopped unexpectedly. Please reopen the analyser.",
                "CDAC VCU Fault Analyser",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }

        private void HandleStartupFailure(Exception exception)
        {
            if (smokeTest)
            {
                CompleteSmoke(1);
            }

            DialogResult result = MessageBox.Show(
                "The analyser could not start. Microsoft Edge WebView2 Runtime is required and is normally included with Windows 10/11.\n\n"
                + exception.Message
                + "\n\nOpen the official WebView2 download page?",
                "CDAC VCU Fault Analyser",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Error);

            if (result == DialogResult.Yes)
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "https://developer.microsoft.com/microsoft-edge/webview2/",
                        UseShellExecute = true
                    });
                }
                catch
                {
                    // The error message already tells the user which runtime is required.
                }
            }

            Close();
        }
    }
}
