// HzScriptMigratorGui — Horizon Worlds 스크립트 이주 도구 (GUI)
//
// 원본(From) scripts 폴더의 .ts 파일을 대상(To) scripts 폴더로 한 번에 하나씩 복사하고,
// 대상 폴더의 .editor 파일(Horizon 에디터가 스크립트를 인식할 때 다시 쓰는 JSON 레지스트리)에
// 해당 스크립트 이름이 등록될 때까지 기다린 뒤 다음 파일로 넘어갑니다.
//
// 빌드: build.cmd 참고 (Windows 내장 .NET Framework 4.x csc.exe, C# 5 문법으로 작성됨)

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace HzScriptMigrator
{
    static class Program
    {
        public const string Version = "1.1";

        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main()
        {
            // 시작/오류 기록: 창이 뜨지 않을 때 원인을 남기기 위함
            AppLog.Write("시작 v" + Version + " exe=" + Application.ExecutablePath);
            Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { Crash(e.Exception); };
            AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { Crash(e.ExceptionObject as Exception); };
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);

            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                Application.Run(new MainForm());
            }
            catch (Exception ex) { Crash(ex); }
            AppLog.Write("종료");
        }

        static void Crash(Exception ex)
        {
            string msg = ex == null ? "(알 수 없는 오류)" : ex.ToString();
            AppLog.Write("오류: " + msg);
            try
            {
                MessageBox.Show("프로그램에서 오류가 발생했습니다.\n\n" + msg + "\n\n기록: " + AppLog.Path,
                                "Horizon Worlds 스크립트 이주 도구", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            catch { }
        }
    }

    // ------------------------------------------------------------------
    // 앱 로그 (시작/종료/오류) — %USERPROFILE%\AppData\LocalLow\HzScriptMigrator\app.log
    // ------------------------------------------------------------------
    static class AppLog
    {
        public static string Path { get { return System.IO.Path.Combine(Settings.DataDir, "app.log"); } }
        public static void Write(string msg)
        {
            try { File.AppendAllText(Path, "[" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "] " + msg + Environment.NewLine, Encoding.UTF8); }
            catch { }
        }
    }

    // ------------------------------------------------------------------
    // 설정 (마지막 사용 값 저장)
    // ------------------------------------------------------------------
    public class Settings
    {
        public string From = "";
        public string To = "";
        public int TimeoutSec = 120;
        public int IntervalMs = 2000;
        public int DelayMs = 1000;
        public bool DependencyOrder = true;
        public bool MoveOriginal = false;
        public bool Overwrite = false;
        public bool StopOnTimeout = true;

        static string Dir()
        {
            // LocalLow 아래에 저장: exe가 LocalLow(낮은 무결성)에서 실행되더라도 쓰기가 가능하다.
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appData = Path.GetDirectoryName(local.TrimEnd('\\'));
            return Path.Combine(Path.Combine(appData, "LocalLow"), "HzScriptMigrator");
        }

        public static string DataDir
        {
            get
            {
                try
                {
                    string d = Dir();
                    Directory.CreateDirectory(d);
                    return d;
                }
                catch
                {
                    return AppDomain.CurrentDomain.BaseDirectory;
                }
            }
        }

        static string FilePath() { return Path.Combine(DataDir, "settings.json"); }

        public static Settings Load()
        {
            try
            {
                string p = FilePath();
                if (File.Exists(p))
                {
                    var s = new JavaScriptSerializer().Deserialize<Settings>(File.ReadAllText(p, Encoding.UTF8));
                    if (s != null) return s;
                }
            }
            catch { }
            return new Settings();
        }

        public void Save()
        {
            try
            {
                File.WriteAllText(FilePath(), new JavaScriptSerializer().Serialize(this), Encoding.UTF8);
            }
            catch { }
        }
    }

    // ------------------------------------------------------------------
    // .editor 레지스트리 읽기
    // ------------------------------------------------------------------
    static class EditorRegistry
    {
        // 에디터가 파일을 다시 쓰는 도중에 읽으면 실패하거나 잘린 JSON이 나올 수 있다.
        // 그런 경우 "아직 아무것도 등록되지 않음"으로 보고 호출자가 다시 폴링한다.
        public static HashSet<string> Read(string editorPath, out string raw)
        {
            raw = null;
            var keys = new HashSet<string>(StringComparer.Ordinal);
            try
            {
                using (var fs = new FileStream(editorPath, FileMode.Open, FileAccess.Read,
                                               FileShare.ReadWrite | FileShare.Delete))
                using (var sr = new StreamReader(fs, Encoding.UTF8, true))
                {
                    raw = sr.ReadToEnd();
                }
            }
            catch
            {
                return keys;
            }

            try
            {
                var ser = new JavaScriptSerializer();
                ser.MaxJsonLength = int.MaxValue;
                var dict = ser.Deserialize<Dictionary<string, object>>(raw);
                if (dict != null)
                    foreach (var k in dict.Keys) keys.Add(k);
                return keys;
            }
            catch
            {
                // 잘린 JSON 대비: "키":"값" 쌍만 정규식으로 건져낸다.
                foreach (Match m in Regex.Matches(raw ?? "", "\"((?:[^\"\\\\]|\\\\.)*)\"\\s*:\\s*\""))
                    keys.Add(Regex.Unescape(m.Groups[1].Value));
                return keys;
            }
        }
    }

    // ------------------------------------------------------------------
    // 의존성 순서 정렬 (import 구문 기준, 순환은 역할 순서로 끊음)
    // ------------------------------------------------------------------
    static class DependencyOrder
    {
        static readonly Regex FromRe = new Regex("from\\s+['\"]([^'\"]+)['\"]", RegexOptions.Compiled);

        // <Game>_<Role>.ts 명명 규칙에서, 순환 import가 생겼을 때 먼저 내보낼 역할의 순서.
        static readonly string[] RoleOrder =
        {
            "Definitions", "DataTables", "GameEvents", "FieldData", "Board", "Dial", "CoreAPI",
            "LevelGenerator", "Solver", "InputController", "DragController", "AutoPlayBot", "Session"
        };

        static int RoleRank(string name)
        {
            int i = name.IndexOf('_');
            string suffix = i >= 0 ? name.Substring(i + 1) : name;
            int idx = Array.IndexOf(RoleOrder, suffix);
            return idx < 0 ? RoleOrder.Length : idx;
        }

        public static List<string> Order(IEnumerable<string> namesIn, string fromDir)
        {
            var names = new HashSet<string>(namesIn, StringComparer.Ordinal);
            var deps = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);
            foreach (string name in names)
            {
                var found = new HashSet<string>(StringComparer.Ordinal);
                try
                {
                    string text = File.ReadAllText(Path.Combine(fromDir, name + ".ts"));
                    foreach (Match m in FromRe.Matches(text))
                    {
                        string spec = m.Groups[1].Value;
                        string dep = spec.Split('/').Last();
                        if (dep.EndsWith(".ts")) dep = dep.Substring(0, dep.Length - 3);
                        if (names.Contains(dep) && dep != name) found.Add(dep);
                    }
                }
                catch { }
                deps[name] = found;
            }

            var remaining = new HashSet<string>(names, StringComparer.Ordinal);
            var order = new List<string>();
            while (remaining.Count > 0)
            {
                var ready = remaining.Where(n => !deps[n].Overlaps(remaining))
                                     .OrderBy(RoleRank).ThenBy(n => n, StringComparer.Ordinal).ToList();
                if (ready.Count > 0)
                {
                    order.AddRange(ready);
                    remaining.ExceptWith(ready);
                }
                else
                {
                    string forced = remaining.OrderBy(RoleRank).ThenBy(n => n, StringComparer.Ordinal).First();
                    order.Add(forced);
                    remaining.Remove(forced);
                }
            }
            return order;
        }
    }

    // ------------------------------------------------------------------
    // 작업 표시줄 진행률 / 창 깜빡임 (실패해도 무시)
    // ------------------------------------------------------------------
    [ComImport, Guid("56FDF344-FD6D-11d0-958A-006097C9A090"), ClassInterface(ClassInterfaceType.None)]
    class TaskbarInstance { }

    [ComImport, Guid("ea1afb91-9e28-4b86-90e9-9e9f8a5eefaf"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ITaskbarList3
    {
        void HrInit();
        void AddTab(IntPtr hwnd);
        void DeleteTab(IntPtr hwnd);
        void ActivateTab(IntPtr hwnd);
        void SetActiveAlt(IntPtr hwnd);
        void MarkFullscreenWindow(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool fFullscreen);
        void SetProgressValue(IntPtr hwnd, ulong ullCompleted, ulong ullTotal);
        void SetProgressState(IntPtr hwnd, int tbpFlags);
    }

    static class Taskbar
    {
        public const int NoProgress = 0, Indeterminate = 1, Normal = 2, Error = 4, Paused = 8;
        static ITaskbarList3 tb;
        static bool tried;

        static ITaskbarList3 Get()
        {
            if (!tried)
            {
                tried = true;
                try { tb = (ITaskbarList3)new TaskbarInstance(); tb.HrInit(); } catch { tb = null; }
            }
            return tb;
        }
        public static void State(IntPtr h, int state) { try { var t = Get(); if (t != null) t.SetProgressState(h, state); } catch { } }
        public static void Value(IntPtr h, int done, int total) { try { var t = Get(); if (t != null) t.SetProgressValue(h, (ulong)done, (ulong)Math.Max(1, total)); } catch { } }

        [StructLayout(LayoutKind.Sequential)]
        struct FLASHWINFO { public uint cbSize; public IntPtr hwnd; public uint dwFlags; public uint uCount; public uint dwTimeout; }
        [DllImport("user32.dll")] static extern bool FlashWindowEx(ref FLASHWINFO pwfi);

        public static void Flash(IntPtr h)
        {
            try
            {
                var fi = new FLASHWINFO();
                fi.cbSize = (uint)Marshal.SizeOf(typeof(FLASHWINFO));
                fi.hwnd = h; fi.dwFlags = 2 | 12; /* FLASHW_TRAY | FLASHW_TIMERNOFG */ fi.uCount = 0; fi.dwTimeout = 0;
                FlashWindowEx(ref fi);
            }
            catch { }
        }
    }

    // ------------------------------------------------------------------
    // 메인 폼
    // ------------------------------------------------------------------
    class BufferedListView : ListView
    {
        public BufferedListView() { DoubleBuffered = true; }
    }

    class MainForm : Form
    {
        TextBox txtFrom, txtTo, txtLog;
        Button btnFrom, btnTo, btnRefresh, btnStart, btnStop, btnOpenTo, btnOpenLog;
        NumericUpDown numTimeout, numInterval, numDelay;
        CheckBox chkDepOrder, chkMove, chkOverwrite, chkStopOnTimeout;
        BufferedListView list;
        ProgressBar progress, stepBar;
        Label lblStatus, lblPhase, lblDetail, lblCounters;
        Panel phasePanel;
        System.Windows.Forms.Timer uiTimer;

        Settings settings;
        float dpi = 1f;
        int S(int v) { return (int)Math.Round(v * dpi); }
        Thread worker;
        ManualResetEvent stopEvent = new ManualResetEvent(false);
        StreamWriter logFile;

        // 워커 → UI 타이머가 읽는 현재 상태
        readonly object stateLock = new object();
        int stIndex, stTotal, stPhase;          // phase: 0 대기, 1 복사, 2 등록 대기, 3 완료/다음 대기
        string stName = "";
        DateTime stPhaseStart, stRunStart;
        int stTimeoutMs;
        int cDone, cSkip, cFail, cWarn;

        static readonly Color ColorDone = Color.FromArgb(220, 245, 220);
        static readonly Color ColorSkip = Color.FromArgb(235, 235, 235);
        static readonly Color ColorWait = Color.FromArgb(255, 250, 205);
        static readonly Color ColorFail = Color.FromArgb(255, 220, 220);
        static readonly Color ColorWarn = Color.FromArgb(255, 235, 200);
        static readonly Color PhaseIdle = Color.FromArgb(240, 240, 240);
        static readonly Color PhaseBusy = Color.FromArgb(255, 249, 196);
        static readonly Color PhaseOk = Color.FromArgb(200, 240, 200);
        static readonly Color PhaseBad = Color.FromArgb(250, 205, 205);

        public MainForm()
        {
            settings = Settings.Load();
            Text = "Horizon Worlds 스크립트 이주 도구 v" + Program.Version;
            Font = new Font("Malgun Gothic", 9f);
            AutoScaleMode = AutoScaleMode.Font;
            StartPosition = FormStartPosition.CenterScreen;
            try { using (var g = CreateGraphics()) dpi = g.DpiX / 96f; } catch { dpi = 1f; }
            ClientSize = new Size(S(920), S(760));
            MinimumSize = new Size(S(780), S(600));
            BuildUi();
            LoadSettingsIntoUi();
            FormClosing += OnClosing;
            Shown += OnShown;

            uiTimer = new System.Windows.Forms.Timer();
            uiTimer.Interval = 250;
            uiTimer.Tick += delegate { UpdatePhaseUi(); };
        }

        void OnShown(object sender, EventArgs e)
        {
            // 다른 창 뒤에 숨지 않도록 앞으로 가져온다.
            try { Activate(); TopMost = true; TopMost = false; BringToFront(); } catch { }
            Log("프로그램 시작 (v" + Program.Version + "). 원본/대상 폴더를 지정하고 [목록 새로고침] 후 [▶ 시작]을 누르세요.");
            Log("실행 파일: " + Application.ExecutablePath);
            if (Directory.Exists(txtFrom.Text) && Directory.Exists(txtTo.Text)) RefreshPlan();
            SetPhaseIdle("대기 중 — 폴더를 지정하고 ▶ 시작을 누르면 진행 과정이 여기에 표시됩니다.");
        }

        // ---------------- UI 구성 ----------------
        void BuildUi()
        {
            var root = new TableLayoutPanel();
            root.Dock = DockStyle.Fill;
            root.Padding = new Padding(10);
            root.ColumnCount = 1;
            root.RowCount = 7;
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));    // 0 경로
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));    // 1 옵션
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));    // 2 버튼
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));    // 3 현재 작업 패널
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 60)); // 4 목록
            root.RowStyles.Add(new RowStyle(SizeType.AutoSize));    // 5 전체 진행률
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 40)); // 6 로그
            Controls.Add(root);

            // 경로 입력
            var paths = new TableLayoutPanel();
            paths.Dock = DockStyle.Top;
            paths.AutoSize = true;
            paths.ColumnCount = 3;
            paths.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            paths.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            paths.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));

            txtFrom = new TextBox(); txtFrom.Dock = DockStyle.Fill;
            txtTo = new TextBox(); txtTo.Dock = DockStyle.Fill;
            btnFrom = new Button(); btnFrom.Text = "찾아보기…"; btnFrom.AutoSize = true;
            btnTo = new Button(); btnTo.Text = "찾아보기…"; btnTo.AutoSize = true;
            btnFrom.Click += delegate { Browse(txtFrom, "이주할 원본(From) 프로젝트의 scripts 폴더를 선택하세요"); };
            btnTo.Click += delegate { Browse(txtTo, "이주 대상(To) 프로젝트의 scripts 폴더를 선택하세요 (.editor 파일이 있는 폴더)"); };
            txtFrom.Leave += delegate { NormalizeScriptsPath(txtFrom); };
            txtTo.Leave += delegate { NormalizeScriptsPath(txtTo); };

            paths.Controls.Add(MakeLabel("원본(From) scripts 폴더:"), 0, 0);
            paths.Controls.Add(txtFrom, 1, 0);
            paths.Controls.Add(btnFrom, 2, 0);
            paths.Controls.Add(MakeLabel("대상(To) scripts 폴더:"), 0, 1);
            paths.Controls.Add(txtTo, 1, 1);
            paths.Controls.Add(btnTo, 2, 1);
            root.Controls.Add(paths, 0, 0);

            // 옵션
            var opts = new FlowLayoutPanel();
            opts.Dock = DockStyle.Top;
            opts.AutoSize = true;
            opts.WrapContents = true;
            opts.Padding = new Padding(0, 4, 0, 4);

            numTimeout = MakeNum(5, 3600, 120); numTimeout.Width = S(80);
            numInterval = MakeNum(200, 60000, 2000); numInterval.Width = S(80);
            numDelay = MakeNum(0, 60000, 1000); numDelay.Width = S(80);
            opts.Controls.Add(MakeLabel("등록 대기 제한(초):"));
            opts.Controls.Add(numTimeout);
            opts.Controls.Add(MakeLabel("   .editor 확인 주기(ms):"));
            opts.Controls.Add(numInterval);
            opts.Controls.Add(MakeLabel("   파일 간 대기(ms):"));
            opts.Controls.Add(numDelay);

            var opts2 = new FlowLayoutPanel();
            opts2.Dock = DockStyle.Top;
            opts2.AutoSize = true;
            opts2.WrapContents = true;
            chkDepOrder = MakeCheck("import 의존성 순서로 정렬", true);
            chkStopOnTimeout = MakeCheck("타임아웃 시 작업 중단", true);
            chkOverwrite = MakeCheck("대상에 같은 이름이 있으면 덮어쓰기", false);
            chkMove = MakeCheck("복사 후 원본 삭제(이동)", false);
            opts2.Controls.Add(chkDepOrder);
            opts2.Controls.Add(chkStopOnTimeout);
            opts2.Controls.Add(chkOverwrite);
            opts2.Controls.Add(chkMove);
            chkDepOrder.CheckedChanged += delegate { if (worker == null) RefreshPlan(); };

            var optWrap = new TableLayoutPanel();
            optWrap.Dock = DockStyle.Top; optWrap.AutoSize = true; optWrap.ColumnCount = 1;
            optWrap.Controls.Add(opts, 0, 0);
            optWrap.Controls.Add(opts2, 0, 1);
            root.Controls.Add(optWrap, 0, 1);

            // 버튼 줄
            var buttons = new FlowLayoutPanel();
            buttons.Dock = DockStyle.Top;
            buttons.AutoSize = true;
            btnRefresh = new Button(); btnRefresh.Text = "목록 새로고침"; btnRefresh.AutoSize = true;
            btnStart = new Button(); btnStart.Text = "▶ 시작"; btnStart.AutoSize = true; btnStart.Font = new Font(Font, FontStyle.Bold);
            btnStop = new Button(); btnStop.Text = "■ 중지"; btnStop.AutoSize = true; btnStop.Enabled = false;
            btnOpenTo = new Button(); btnOpenTo.Text = "대상 폴더 열기"; btnOpenTo.AutoSize = true;
            btnOpenLog = new Button(); btnOpenLog.Text = "로그 폴더 열기"; btnOpenLog.AutoSize = true;
            lblStatus = new Label(); lblStatus.AutoSize = true; lblStatus.Padding = new Padding(12, 6, 0, 0);
            btnRefresh.Click += delegate { RefreshPlan(); };
            btnStart.Click += delegate { StartRun(); };
            btnStop.Click += delegate { RequestStop(); };
            btnOpenTo.Click += delegate { OpenFolder(txtTo.Text); };
            btnOpenLog.Click += delegate { OpenFolder(Settings.DataDir); };
            buttons.Controls.Add(btnRefresh);
            buttons.Controls.Add(btnStart);
            buttons.Controls.Add(btnStop);
            buttons.Controls.Add(btnOpenTo);
            buttons.Controls.Add(btnOpenLog);
            buttons.Controls.Add(lblStatus);
            root.Controls.Add(buttons, 0, 2);

            // 현재 작업 패널
            phasePanel = new Panel();
            phasePanel.Dock = DockStyle.Top;
            phasePanel.AutoSize = true;
            phasePanel.BorderStyle = BorderStyle.FixedSingle;
            phasePanel.BackColor = PhaseIdle;
            phasePanel.Padding = new Padding(8);
            phasePanel.Margin = new Padding(0, 4, 0, 6);
            var pt = new TableLayoutPanel();
            pt.Dock = DockStyle.Top; pt.AutoSize = true; pt.ColumnCount = 1;
            lblPhase = new Label(); lblPhase.AutoSize = true; lblPhase.Font = new Font("Malgun Gothic", 12f, FontStyle.Bold);
            lblPhase.Margin = new Padding(0, 0, 0, 2);
            lblDetail = new Label(); lblDetail.AutoSize = true; lblDetail.Margin = new Padding(0, 0, 0, 4);
            stepBar = new ProgressBar(); stepBar.Dock = DockStyle.Top; stepBar.Height = S(12); stepBar.Margin = new Padding(0, 0, 0, 4);
            lblCounters = new Label(); lblCounters.AutoSize = true;
            pt.Controls.Add(lblPhase, 0, 0);
            pt.Controls.Add(lblDetail, 0, 1);
            pt.Controls.Add(stepBar, 0, 2);
            pt.Controls.Add(lblCounters, 0, 3);
            phasePanel.Controls.Add(pt);
            root.Controls.Add(phasePanel, 0, 3);

            // 파일 목록
            list = new BufferedListView();
            list.Dock = DockStyle.Fill;
            list.View = View.Details;
            list.FullRowSelect = true;
            list.GridLines = true;
            list.HideSelection = false;
            list.Columns.Add("#", S(44));
            list.Columns.Add("파일명", S(290));
            list.Columns.Add("상태", S(190));
            list.Columns.Add("소요(초)", S(80), HorizontalAlignment.Right);
            list.Columns.Add("비고", S(260));
            root.Controls.Add(list, 0, 4);

            // 전체 진행률
            var progRow = new TableLayoutPanel();
            progRow.Dock = DockStyle.Top; progRow.AutoSize = true; progRow.ColumnCount = 2;
            progRow.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            progRow.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            progRow.Controls.Add(MakeLabel("전체 진행:"), 0, 0);
            progress = new ProgressBar();
            progress.Dock = DockStyle.Fill;
            progress.Height = S(18);
            progress.Margin = new Padding(0, 6, 0, 6);
            progRow.Controls.Add(progress, 1, 0);
            root.Controls.Add(progRow, 0, 5);

            // 로그
            txtLog = new TextBox();
            txtLog.Dock = DockStyle.Fill;
            txtLog.Multiline = true;
            txtLog.ReadOnly = true;
            txtLog.ScrollBars = ScrollBars.Vertical;
            txtLog.Font = new Font("Consolas", 9f);
            txtLog.BackColor = Color.White;
            root.Controls.Add(txtLog, 0, 6);
        }

        static Label MakeLabel(string text)
        {
            var l = new Label(); l.Text = text; l.AutoSize = true; l.Anchor = AnchorStyles.Left; l.Padding = new Padding(0, 6, 6, 0);
            return l;
        }
        static NumericUpDown MakeNum(int min, int max, int val)
        {
            var n = new NumericUpDown(); n.Minimum = min; n.Maximum = max; n.Value = val; n.Width = 80; n.Anchor = AnchorStyles.Left;
            return n;
        }
        static CheckBox MakeCheck(string text, bool on)
        {
            var c = new CheckBox(); c.Text = text; c.Checked = on; c.AutoSize = true; c.Margin = new Padding(3, 3, 14, 3);
            return c;
        }
        static void OpenFolder(string path)
        {
            if (!Directory.Exists(path)) return;
            try { Process.Start("explorer.exe", "\"" + path + "\""); } catch { }
        }

        void LoadSettingsIntoUi()
        {
            txtFrom.Text = settings.From ?? "";
            txtTo.Text = settings.To ?? "";
            numTimeout.Value = Clamp(settings.TimeoutSec, numTimeout);
            numInterval.Value = Clamp(settings.IntervalMs, numInterval);
            numDelay.Value = Clamp(settings.DelayMs, numDelay);
            chkDepOrder.Checked = settings.DependencyOrder;
            chkMove.Checked = settings.MoveOriginal;
            chkOverwrite.Checked = settings.Overwrite;
            chkStopOnTimeout.Checked = settings.StopOnTimeout;
        }
        static decimal Clamp(int v, NumericUpDown n) { return Math.Max(n.Minimum, Math.Min(n.Maximum, v)); }

        void SaveSettingsFromUi()
        {
            settings.From = txtFrom.Text.Trim();
            settings.To = txtTo.Text.Trim();
            settings.TimeoutSec = (int)numTimeout.Value;
            settings.IntervalMs = (int)numInterval.Value;
            settings.DelayMs = (int)numDelay.Value;
            settings.DependencyOrder = chkDepOrder.Checked;
            settings.MoveOriginal = chkMove.Checked;
            settings.Overwrite = chkOverwrite.Checked;
            settings.StopOnTimeout = chkStopOnTimeout.Checked;
            settings.Save();
        }

        void Browse(TextBox target, string description)
        {
            using (var dlg = new FolderBrowserDialog())
            {
                dlg.Description = description;
                dlg.ShowNewFolderButton = false;
                if (Directory.Exists(target.Text)) dlg.SelectedPath = target.Text;
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    target.Text = dlg.SelectedPath;
                    NormalizeScriptsPath(target);
                    if (Directory.Exists(txtFrom.Text) && Directory.Exists(txtTo.Text)) RefreshPlan();
                }
            }
        }

        // 월드 폴더(…\<world-id>)를 고르면 자동으로 그 아래 scripts 폴더로 바꿔준다.
        void NormalizeScriptsPath(TextBox box)
        {
            string p = box.Text.Trim().TrimEnd('\\', '/');
            if (p.Length == 0 || !Directory.Exists(p)) return;
            string sub = Path.Combine(p, "scripts");
            if (!File.Exists(Path.Combine(p, ".editor")) && Directory.Exists(sub) &&
                (File.Exists(Path.Combine(sub, ".editor")) || Directory.GetFiles(sub, "*.ts").Length > 0))
                p = sub;
            if (box.Text != p) box.Text = p;
        }

        // ---------------- 로그 ----------------
        void Log(string msg)
        {
            string line = "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg;
            if (InvokeRequired) { try { BeginInvoke(new Action<string>(LogUi), line); } catch { } }
            else LogUi(line);
            try { if (logFile != null) { logFile.WriteLine(line); logFile.Flush(); } } catch { }
        }
        void LogUi(string line)
        {
            txtLog.AppendText(line + Environment.NewLine);
        }

        void UI(Action a)
        {
            if (IsDisposed) return;
            if (InvokeRequired) { try { Invoke(a); } catch { } }
            else a();
        }

        // ---------------- 현재 작업 패널 ----------------
        void SetPhaseIdle(string text)
        {
            phasePanel.BackColor = PhaseIdle;
            lblPhase.Text = text;
            lblDetail.Text = "";
            stepBar.Style = ProgressBarStyle.Continuous; stepBar.Value = 0;
            lblCounters.Text = "";
        }

        void SetState(int index, int total, int phase, string name, int timeoutMs)
        {
            lock (stateLock)
            {
                stIndex = index; stTotal = total; stPhase = phase; stName = name; stTimeoutMs = timeoutMs;
                stPhaseStart = DateTime.Now;
            }
        }

        static string Fmt(TimeSpan t)
        {
            return t.TotalHours >= 1 ? t.ToString("h\\:mm\\:ss") : t.ToString("mm\\:ss");
        }

        // UI 타이머(250ms)에서 호출: 워커 상태를 읽어 패널을 갱신
        void UpdatePhaseUi()
        {
            int index, total, phase, timeoutMs, done, skip, fail, warn;
            string name; DateTime phaseStart, runStart;
            lock (stateLock)
            {
                index = stIndex; total = stTotal; phase = stPhase; name = stName; timeoutMs = stTimeoutMs;
                phaseStart = stPhaseStart; runStart = stRunStart;
                done = cDone; skip = cSkip; fail = cFail; warn = cWarn;
            }
            var now = DateTime.Now;
            double phaseSec = (now - phaseStart).TotalSeconds;
            string head = "[" + index + "/" + total + "] " + name + ".ts";

            switch (phase)
            {
                case 1:
                    phasePanel.BackColor = PhaseBusy;
                    lblPhase.Text = head + " — ① 대상 폴더로 복사 중";
                    lblDetail.Text = "파일을 복사하고 있습니다.";
                    stepBar.Style = ProgressBarStyle.Marquee;
                    break;
                case 2:
                    phasePanel.BackColor = PhaseBusy;
                    lblPhase.Text = head + " — ② Horizon 에디터의 .editor 등록 대기 중";
                    lblDetail.Text = string.Format("복사 완료. .editor에 \"{0}\" 항목이 나타나기를 기다리는 중… {1:0}초 경과 / 제한 {2}초  (보통 5~10초 걸립니다)",
                                                   name, phaseSec, timeoutMs / 1000);
                    stepBar.Style = ProgressBarStyle.Continuous;
                    stepBar.Maximum = Math.Max(1, timeoutMs);
                    stepBar.Value = (int)Math.Min(timeoutMs, phaseSec * 1000);
                    break;
                case 3:
                    phasePanel.BackColor = PhaseBusy;
                    lblPhase.Text = head + " — ③ 등록 확인, 다음 파일 준비 중";
                    lblDetail.Text = "잠시 후 다음 파일로 넘어갑니다.";
                    stepBar.Style = ProgressBarStyle.Continuous;
                    stepBar.Value = stepBar.Maximum;
                    break;
                default:
                    return;
            }
            lblCounters.Text = string.Format("전체 경과 {0}   |   완료 {1}  ·  건너뜀 {2}  ·  실패 {3}  ·  경고 {4}   |   남은 파일 {5}",
                                             Fmt(now - runStart), done, skip, fail, warn, Math.Max(0, total - index));
        }

        void SetPhaseFinal(bool ok, string head, string detail)
        {
            UI(delegate
            {
                phasePanel.BackColor = ok ? PhaseOk : PhaseBad;
                lblPhase.Text = head;
                lblDetail.Text = detail;
                stepBar.Style = ProgressBarStyle.Continuous;
                stepBar.Value = ok ? stepBar.Maximum : 0;
                lock (stateLock)
                {
                    lblCounters.Text = string.Format("전체 경과 {0}   |   완료 {1}  ·  건너뜀 {2}  ·  실패 {3}  ·  경고 {4}",
                                                     Fmt(DateTime.Now - stRunStart), cDone, cSkip, cFail, cWarn);
                }
            });
        }

        // ---------------- 계획(목록) 만들기 ----------------
        bool ValidatePaths(bool forRun)
        {
            NormalizeScriptsPath(txtFrom);
            NormalizeScriptsPath(txtTo);
            string from = txtFrom.Text.Trim(), to = txtTo.Text.Trim();
            if (!Directory.Exists(from)) { Warn("원본(From) 폴더가 존재하지 않습니다:\n" + from); return false; }
            if (!Directory.Exists(to)) { Warn("대상(To) 폴더가 존재하지 않습니다:\n" + to); return false; }
            if (string.Equals(Path.GetFullPath(from).TrimEnd('\\'), Path.GetFullPath(to).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase))
            { Warn("원본과 대상 폴더가 같습니다."); return false; }
            if (forRun && !File.Exists(Path.Combine(to, ".editor")))
            {
                var r = MessageBox.Show(this,
                    "대상 폴더에 .editor 파일이 없습니다.\n\n" +
                    "이 파일은 Horizon 에디터에서 해당 월드를 열고 Scripts 패널을 표시하면 생성됩니다.\n" +
                    ".editor가 없으면 등록 완료를 확인할 수 없어 모든 파일이 타임아웃됩니다.\n\n" +
                    "그래도 계속할까요?", Text, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
                if (r != DialogResult.Yes) return false;
            }
            return true;
        }

        void Warn(string msg) { MessageBox.Show(this, msg, Text, MessageBoxButtons.OK, MessageBoxIcon.Warning); }

        List<string> BuildPlan(out int alreadyCount)
        {
            string from = txtFrom.Text.Trim(), to = txtTo.Text.Trim();
            var names = Directory.GetFiles(from, "*.ts").Select(Path.GetFileNameWithoutExtension)
                                 .Where(n => !n.StartsWith(".")).Distinct(StringComparer.Ordinal).ToList();
            var inTo = new HashSet<string>(Directory.GetFiles(to, "*.ts").Select(Path.GetFileNameWithoutExtension), StringComparer.Ordinal);
            alreadyCount = names.Count(inTo.Contains);
            return chkDepOrder.Checked ? DependencyOrder.Order(names, from)
                                       : names.OrderBy(n => n, StringComparer.Ordinal).ToList();
        }

        void RefreshPlan()
        {
            if (worker != null) return;
            if (!ValidatePaths(false)) return;
            SaveSettingsFromUi();

            string to = txtTo.Text.Trim();
            string raw;
            var registry = EditorRegistry.Read(Path.Combine(to, ".editor"), out raw);
            var inTo = new HashSet<string>(Directory.GetFiles(to, "*.ts").Select(Path.GetFileNameWithoutExtension), StringComparer.Ordinal);

            int already;
            List<string> plan;
            try { plan = BuildPlan(out already); }
            catch (Exception ex) { Warn("목록을 만들 수 없습니다: " + ex.Message); return; }

            list.BeginUpdate();
            list.Items.Clear();
            int i = 0;
            foreach (string name in plan)
            {
                i++;
                var item = new ListViewItem(i.ToString());
                item.SubItems.Add(name + ".ts");
                if (inTo.Contains(name))
                {
                    item.SubItems.Add(registry.Contains(name) ? "대상에 존재 (등록됨)" : "대상에 존재 (미등록!)");
                    item.SubItems.Add("");
                    item.SubItems.Add(chkOverwrite.Checked ? "덮어쓰기 예정" : "내용이 같으면 건너뜀");
                    item.BackColor = registry.Contains(name) ? ColorSkip : ColorWarn;
                }
                else
                {
                    item.SubItems.Add("대기");
                    item.SubItems.Add("");
                    item.SubItems.Add(registry.Contains(name) ? ".editor에 이전 항목 있음" : "");
                }
                item.Tag = name;
                list.Items.Add(item);
            }
            list.EndUpdate();
            progress.Value = 0;
            progress.Maximum = Math.Max(1, plan.Count);

            lblStatus.Text = string.Format("From .ts {0}개  |  To .ts {1}개, .editor 등록 {2}개  |  이미 대상에 있음 {3}개",
                                           plan.Count, inTo.Count, registry.Count, already);
            Log(string.Format("목록 갱신: 원본 {0}개 파일, 대상 폴더에 이미 {1}개 존재, 대상 .editor 등록 {2}개{3}",
                              plan.Count, already, registry.Count, raw == null ? " (.editor 없음)" : ""));
            if (raw == null) Log("주의: 대상 폴더에 .editor 파일이 없습니다. Horizon 에디터에서 대상 월드를 열어 두세요.");
            SetPhaseIdle(string.Format("대기 중 — 옮길 파일 {0}개 (이미 대상에 있는 {1}개는 건너뜀). ▶ 시작을 누르세요.", plan.Count - already, already));
        }

        // ---------------- 실행 ----------------
        void StartRun()
        {
            if (worker != null) return;
            if (!ValidatePaths(true)) return;
            SaveSettingsFromUi();
            RefreshPlan();
            if (list.Items.Count == 0) { Warn("원본 폴더에 .ts 파일이 없습니다."); return; }

            if (chkMove.Checked)
            {
                var r = MessageBox.Show(this,
                    "'복사 후 원본 삭제(이동)'이 켜져 있습니다.\n등록이 확인된 파일은 원본(From) 폴더에서 삭제됩니다.\n\n계속할까요?",
                    Text, MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (r != DialogResult.Yes) return;
            }

            try
            {
                string logPath = Path.Combine(Settings.DataDir, "migrate_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".log");
                logFile = new StreamWriter(logPath, false, Encoding.UTF8);
                Log("로그 파일: " + logPath);
            }
            catch { logFile = null; }

            var job = new Job();
            job.From = txtFrom.Text.Trim();
            job.To = txtTo.Text.Trim();
            job.TimeoutMs = (int)numTimeout.Value * 1000;
            job.IntervalMs = (int)numInterval.Value;
            job.DelayMs = (int)numDelay.Value;
            job.MoveOriginal = chkMove.Checked;
            job.Overwrite = chkOverwrite.Checked;
            job.StopOnTimeout = chkStopOnTimeout.Checked;
            job.Names = list.Items.Cast<ListViewItem>().Select(it => (string)it.Tag).ToList();

            SetRunning(true);
            stopEvent.Reset();
            lock (stateLock)
            {
                cDone = cSkip = cFail = cWarn = 0;
                stRunStart = DateTime.Now;
                stIndex = 0; stTotal = job.Names.Count; stPhase = 0; stName = "";
            }
            phasePanel.BackColor = PhaseBusy;
            lblPhase.Text = "작업 시작…";
            lblDetail.Text = "";
            uiTimer.Start();
            Taskbar.State(Handle, Taskbar.Normal);
            Taskbar.Value(Handle, 0, job.Names.Count);

            Log(string.Format("=== 시작: {0}개 파일, 제한 {1}초, 확인 주기 {2}ms, 파일 간 대기 {3}ms, {4} ===",
                              job.Names.Count, numTimeout.Value, job.IntervalMs, job.DelayMs, job.MoveOriginal ? "이동" : "복사"));
            Log("From: " + job.From);
            Log("To:   " + job.To);

            worker = new Thread(() => RunJob(job));
            worker.IsBackground = true;
            worker.Start();
        }

        void RequestStop()
        {
            if (worker == null) return;
            stopEvent.Set();
            btnStop.Enabled = false;
            Log("중지 요청됨 — 현재 파일 처리 후 멈춥니다.");
            lblDetail.Text = "중지 요청됨… 현재 파일을 마무리하는 중";
        }

        void SetRunning(bool running)
        {
            foreach (Control c in new Control[] { txtFrom, txtTo, btnFrom, btnTo, btnRefresh, btnStart, numTimeout, numInterval, numDelay, chkDepOrder, chkMove, chkOverwrite, chkStopOnTimeout })
                c.Enabled = !running;
            btnStop.Enabled = running;
            UseWaitCursor = running;
        }

        class Job
        {
            public string From, To;
            public int TimeoutMs, IntervalMs, DelayMs;
            public bool MoveOriginal, Overwrite, StopOnTimeout;
            public List<string> Names;
        }

        void SetRow(int index, string status, string elapsed, string note, Color? color)
        {
            UI(delegate
            {
                if (index < 0 || index >= list.Items.Count) return;
                var it = list.Items[index];
                if (status != null) it.SubItems[2].Text = status;
                if (elapsed != null) it.SubItems[3].Text = elapsed;
                if (note != null) it.SubItems[4].Text = note;
                if (color.HasValue) it.BackColor = color.Value;
                it.EnsureVisible();
            });
        }

        void SetProgress(int done, int total)
        {
            UI(delegate
            {
                progress.Value = Math.Min(progress.Maximum, done);
                Taskbar.Value(Handle, done, total);
                Text = string.Format("[{0}/{1}] Horizon Worlds 스크립트 이주 도구", done, total);
            });
        }

        static bool SameContent(string a, string b)
        {
            try { return File.ReadAllBytes(a).SequenceEqual(File.ReadAllBytes(b)); }
            catch { return false; }
        }

        void Count(int done, int skip, int fail, int warn)
        {
            lock (stateLock) { cDone += done; cSkip += skip; cFail += fail; cWarn += warn; }
        }

        void RunJob(Job job)
        {
            string editorPath = Path.Combine(job.To, ".editor");
            int total = job.Names.Count;
            int processed = 0;
            bool stopped = false;
            string summary;
            bool okOverall = true;

            try
            {
                for (int i = 0; i < total; i++)
                {
                    if (stopEvent.WaitOne(0)) { stopped = true; break; }
                    processed = i + 1;

                    string name = job.Names[i];
                    string src = Path.Combine(job.From, name + ".ts");
                    string dst = Path.Combine(job.To, name + ".ts");
                    SetState(i + 1, total, 1, name, job.TimeoutMs);

                    string rawBefore;
                    var regBefore = EditorRegistry.Read(editorPath, out rawBefore);
                    bool hadKey = regBefore.Contains(name);

                    if (!File.Exists(src))
                    {
                        SetRow(i, "건너뜀", "", "원본 파일이 사라짐", ColorSkip);
                        Log("SKIP    " + name + ": 원본 파일이 없습니다");
                        Count(0, 1, 0, 0); SetProgress(i + 1, total); continue;
                    }

                    if (File.Exists(dst))
                    {
                        if (SameContent(src, dst))
                        {
                            string note = hadKey ? "동일 파일이 이미 존재" : "동일 파일 존재하나 .editor 미등록";
                            SetRow(i, "건너뜀", "", note, hadKey ? ColorSkip : ColorWarn);
                            Log("SKIP    " + name + ": " + note);
                            Count(0, 1, 0, hadKey ? 0 : 1);
                            if (job.MoveOriginal && hadKey) TryDeleteOriginal(src, name);
                            SetProgress(i + 1, total); continue;
                        }
                        if (!job.Overwrite)
                        {
                            SetRow(i, "건너뜀", "", "내용이 다른 파일 존재 (덮어쓰기 꺼짐)", ColorWarn);
                            Log("SKIP    " + name + ": 대상에 내용이 다른 파일이 있어 건너뜀");
                            Count(0, 1, 0, 1); SetProgress(i + 1, total); continue;
                        }
                    }

                    // 1) 복사
                    SetRow(i, "① 복사 중…", "", "", ColorWait);
                    try
                    {
                        File.Copy(src, dst, true);
                    }
                    catch (Exception ex)
                    {
                        SetRow(i, "오류", "", "복사 실패: " + ex.Message, ColorFail);
                        Log("FAIL    " + name + ": 복사 실패 — " + ex.Message);
                        Count(0, 0, 1, 0);
                        SetProgress(i + 1, total);
                        if (job.StopOnTimeout) { stopped = true; okOverall = false; break; }
                        continue;
                    }
                    Log("COPY    " + name + ".ts → 대상 폴더, .editor 등록 대기 중" + (hadKey ? " (.editor에 기존 항목 있음: 파일 변경 감지로 판단)" : ""));

                    // 2) .editor 등록 대기
                    SetState(i + 1, total, 2, name, job.TimeoutMs);
                    var sw = Stopwatch.StartNew();
                    bool registered = false;
                    while (true)
                    {
                        string rawNow;
                        var regNow = EditorRegistry.Read(editorPath, out rawNow);
                        if (regNow.Contains(name) && (!hadKey || rawNow != rawBefore))
                        {
                            registered = true; break;
                        }
                        if (sw.ElapsedMilliseconds >= job.TimeoutMs) break;
                        SetRow(i, string.Format("② 등록 대기 중… ({0}초)", (int)(sw.ElapsedMilliseconds / 1000)), null, null, null);
                        int wait = (int)Math.Min(job.IntervalMs, Math.Max(0, job.TimeoutMs - sw.ElapsedMilliseconds));
                        if (stopEvent.WaitOne(wait)) { stopped = true; break; }
                    }
                    string secs = (sw.ElapsedMilliseconds / 1000.0).ToString("0.0");

                    if (registered)
                    {
                        string note = job.MoveOriginal ? (TryDeleteOriginal(src, name) ? "원본 삭제됨" : "원본 삭제 실패") : "";
                        SetRow(i, "✔ 완료", secs, note, ColorDone);
                        Log("OK      " + name + " (" + secs + "초 만에 등록됨)");
                        Count(1, 0, 0, 0);
                        SetProgress(i + 1, total);
                    }
                    else if (stopped)
                    {
                        SetRow(i, "중지됨 (등록 미확인)", secs, "파일은 대상 폴더에 복사된 상태", ColorWarn);
                        Log("STOP    " + name + ": 등록 확인 전에 중지됨");
                        processed--; // 미확인
                        break;
                    }
                    else if (hadKey)
                    {
                        // 덮어쓰기: .editor에 이미 키가 있어 다시 쓰이지 않을 수 있다. 경고만 하고 계속.
                        SetRow(i, "완료 (변경 감지 안 됨)", secs, ".editor가 다시 쓰이지 않음 — 기존 등록 유지", ColorWarn);
                        Log("WARN    " + name + ": .editor에 기존 항목이 있고 " + secs + "초 동안 변화가 없었습니다. 계속 진행합니다.");
                        Count(1, 0, 0, 1);
                        SetProgress(i + 1, total);
                    }
                    else
                    {
                        SetRow(i, "✖ 타임아웃", secs, ".editor에 등록되지 않음", ColorFail);
                        Log("TIMEOUT " + name + ": " + (job.TimeoutMs / 1000) + "초 동안 .editor에 등록되지 않았습니다.");
                        Log("        → Horizon 에디터에서 대상 월드가 열려 있고 Scripts 패널이 동작 중인지 확인하세요.");
                        Count(0, 0, 1, 0);
                        SetProgress(i + 1, total);
                        okOverall = false;
                        if (job.StopOnTimeout) { stopped = true; break; }
                    }

                    // 3) 다음 파일 전 대기
                    if (i + 1 < total && job.DelayMs > 0)
                    {
                        SetState(i + 1, total, 3, name, job.TimeoutMs);
                        if (stopEvent.WaitOne(job.DelayMs)) { stopped = true; break; }
                    }
                }

                int done, skip, fail, warn;
                lock (stateLock) { done = cDone; skip = cSkip; fail = cFail; warn = cWarn; }
                int remaining = total - processed;
                summary = string.Format("=== {0}: 완료 {1}, 건너뜀 {2}, 실패 {3}, 경고 {4}{5} ===",
                    stopped ? "중단됨" : "모든 작업 종료", done, skip, fail, warn,
                    remaining > 0 ? ", 미처리 " + remaining : "");

                if (stopped)
                {
                    okOverall = false;
                    SetPhaseFinal(false, "■ 중단됨 — " + processed + "/" + total + " 처리",
                        fail > 0 ? "타임아웃 또는 오류로 멈췄습니다. Horizon 에디터에서 대상 월드가 열려 있는지 확인한 뒤 ▶ 시작을 다시 누르면 이미 옮긴 파일은 건너뛰고 이어서 진행합니다."
                                 : "사용자가 중지했습니다. ▶ 시작을 다시 누르면 이미 옮긴 파일은 건너뛰고 이어서 진행합니다.");
                }
                else
                {
                    SetPhaseFinal(fail == 0, fail == 0 ? "✔ 모든 작업 종료 — " + total + "개 파일 처리 완료" : "모든 작업 종료 (실패 " + fail + "건)",
                        fail == 0 ? "모든 스크립트가 대상 폴더로 옮겨졌고 .editor에 등록이 확인되었습니다."
                                  : "일부 파일이 등록되지 않았습니다. 목록의 빨간 항목과 로그를 확인하세요.");
                }
            }
            catch (Exception ex)
            {
                okOverall = false;
                summary = "=== 예기치 않은 오류로 중단: " + ex.Message + " ===";
                SetPhaseFinal(false, "오류로 중단됨", ex.Message);
            }

            Log(summary);
            UI(delegate
            {
                uiTimer.Stop();
                SetRunning(false);
                worker = null;
                lblStatus.Text = summary.Trim('=', ' ');
                Text = "Horizon Worlds 스크립트 이주 도구 v" + Program.Version + " — " + (okOverall ? "완료" : "중단");
                try { if (logFile != null) { logFile.Flush(); logFile.Close(); } } catch { }
                logFile = null;
                Taskbar.State(Handle, okOverall ? Taskbar.NoProgress : Taskbar.Error);
                Taskbar.Flash(Handle);
                if (okOverall) System.Media.SystemSounds.Asterisk.Play();
                else System.Media.SystemSounds.Exclamation.Play();
            });
        }

        bool TryDeleteOriginal(string src, string name)
        {
            try { File.Delete(src); Log("DEL     원본 삭제: " + name + ".ts"); return true; }
            catch (Exception ex) { Log("WARN    원본 삭제 실패 " + name + ".ts: " + ex.Message); return false; }
        }

        void OnClosing(object sender, FormClosingEventArgs e)
        {
            if (worker != null)
            {
                var r = MessageBox.Show(this, "작업이 진행 중입니다. 중지하고 종료할까요?", Text, MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                if (r != DialogResult.Yes) { e.Cancel = true; return; }
                stopEvent.Set();
                try { worker.Join(3000); } catch { }
            }
            SaveSettingsFromUi();
        }
    }
}
