const { app, BrowserWindow, Notification, session } = require("electron");
const fs = require("fs");
const path = require("path");

const isSmokeTest = process.argv.includes("--vcu-smoke-test");
const hasInstanceLock = app.requestSingleInstanceLock();

if (!hasInstanceLock) {
  app.quit();
}

let mainWindow = null;

function uniqueDownloadPath(filename) {
  const downloads = app.getPath("downloads");
  const extension = path.extname(filename);
  const base = path.basename(filename, extension);
  let candidate = path.join(downloads, filename);
  let suffix = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(downloads, `${base} (${suffix})${extension}`);
    suffix += 1;
  }
  return candidate;
}

function configureDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    const destination = uniqueDownloadPath(item.getFilename());
    item.setSavePath(destination);
    item.once("done", (_downloadEvent, state) => {
      if (state === "completed" && Notification.isSupported()) {
        new Notification({
          title: "Export saved",
          body: path.basename(destination)
        }).show();
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#eef2f7",
    title: "CDAC VCU Fault Analyser",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  const viewerPath = app.isPackaged
    ? path.join(process.resourcesPath, "viewer", "index.html")
    : path.join(__dirname, "..", "vcu_fault_viewer", "index.html");

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`Viewer load failed (${code}): ${description}`);
    if (isSmokeTest) app.exit(1);
  });
  mainWindow.webContents.on("did-finish-load", async () => {
    if (isSmokeTest) {
      try {
        const checks = await mainWindow.webContents.executeJavaScript(`({
          title: document.querySelector("h1")?.textContent?.trim(),
          hasUpload: Boolean(document.getElementById("fileInput")),
          hasHtmlExport: Boolean(document.getElementById("exportHtml")),
          hasDecoder: typeof window.VCUDecoder?.parseLog === "function",
          abbCount: window.VCU_DICTIONARIES?.ddsSets?.ABB?.length || 0,
          cglCount: window.VCU_DICTIONARIES?.ddsSets?.CGL?.length || 0,
          hasExcel: Boolean(window.XLSX?.utils),
          hasPdf: typeof window.jspdf?.jsPDF === "function"
        })`);
        const passed = checks.title === "CDAC VCU FAULT ANALYSER"
          && checks.hasUpload
          && checks.hasHtmlExport
          && checks.hasDecoder
          && checks.abbCount > 0
          && checks.cglCount > 0
          && checks.hasExcel
          && checks.hasPdf;
        if (!passed) console.error("Packaged analyser checks failed", checks);
        app.exit(passed ? 0 : 1);
      } catch (error) {
        console.error("Packaged analyser checks failed", error);
        app.exit(1);
      }
      return;
    }
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadFile(viewerPath);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await session.defaultSession.clearCache();
  configureDownloads();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  createWindow();
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  app.quit();
});
