const { app, BrowserWindow, Notification, ipcMain, session } = require("electron");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const isSmokeTest = process.argv.includes("--vcu-smoke-test");
const hasInstanceLock = app.requestSingleInstanceLock();

if (!hasInstanceLock) {
  app.quit();
}

let mainWindow = null;

function safeExportFilename(filename) {
  const fallback = "vcu_export";
  const clean = path.basename(String(filename || fallback))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

function uniqueDownloadPath(filename) {
  const downloads = app.getPath("downloads");
  const safeName = safeExportFilename(filename);
  const extension = path.extname(safeName);
  const base = path.basename(safeName, extension);
  let candidate = path.join(downloads, safeName);
  let suffix = 2;

  while (fs.existsSync(candidate)) {
    candidate = path.join(downloads, `${base} (${suffix})${extension}`);
    suffix += 1;
  }
  return candidate;
}

function notifyExportSaved(destination) {
  if (!Notification.isSupported()) return;
  new Notification({
    title: "Export saved",
    body: path.basename(destination)
  }).show();
}

function configureDownloads() {
  session.defaultSession.on("will-download", (_event, item) => {
    const destination = uniqueDownloadPath(item.getFilename());
    item.setSavePath(destination);
    item.once("done", (_downloadEvent, state) => {
      if (state === "completed") notifyExportSaved(destination);
    });
  });
}

function configureExportBridge() {
  ipcMain.handle("vcu:save-export", async (_event, payload) => {
    const destination = uniqueDownloadPath(payload && payload.filename);
    const bytes = payload && payload.bytes;
    const buffer = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
    await fsp.writeFile(destination, buffer);
    notifyExportSaved(destination);
    return { destination };
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
      preload: path.join(__dirname, "preload.js"),
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
          hasDepthFilters: Boolean(document.getElementById("depthClearFilters")),
          hasHtmlExport: Boolean(document.getElementById("exportHtml")),
          hasDecoder: typeof window.VCUDecoder?.parseLog === "function",
          abbCount: window.VCU_DICTIONARIES?.ddsSets?.ABB?.length || 0,
          cglCount: window.VCU_DICTIONARIES?.ddsSets?.CGL?.length || 0,
          hasExcel: Boolean(window.XLSX?.utils),
          hasPdf: typeof window.jspdf?.jsPDF === "function"
        })`);
        const passed = checks.title === "CDAC VCU FAULT ANALYSER"
          && checks.hasUpload
          && checks.hasDepthFilters
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
  configureExportBridge();
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
