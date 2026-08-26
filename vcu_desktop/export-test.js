const { app, BrowserWindow, session } = require("electron");
const fs = require("fs");
const path = require("path");

const samplePath = process.argv.find((argument) => /\.txt$/i.test(argument));
const packagedViewerPath = process.argv.find((argument) => /index\.html$/i.test(argument));
let sourceWindow = null;
let reportWindow = null;
let finished = false;
let viewerChecks = null;

function finish(code, message) {
  if (finished) return;
  finished = true;
  if (message) console.log(message);
  app.exit(code);
}

function waitFor(condition, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        if (await condition()) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for the analyser"));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 100);
  });
}

async function verifyReport(reportPath) {
  const stats = fs.statSync(reportPath);
  if (stats.size < 10000) throw new Error("Generated HTML report is unexpectedly small");

  reportWindow = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await reportWindow.loadFile(reportPath);
  const result = await reportWindow.webContents.executeJavaScript(`(() => {
    const environmentKeys = ["bg_items", "ag_items", "bp_items", "ap_items"];
    document.querySelector("#faultListBody tr")?.click();
    return {
      heading: document.querySelector(".header")?.textContent?.trim(),
      reportFaults: FAULT_DATA?.length || 0,
      schemaFields: Object.keys(FAULT_DATA?.[0] || {}).join(","),
      validClientDate: /^\\d{2}\\.\\d{2}\\.\\d{4} \\d{2}:\\d{2}:\\d{2}$/.test(FAULT_DATA?.[0]?.date_time || ""),
      hasFourEnvironmentArrays: environmentKeys.every(
        key => Array.isArray(FAULT_DATA?.[0]?.[key])
      ),
      renderedFaultRows: document.querySelectorAll("#faultListBody tr").length,
      expectedEnvironmentTables: environmentKeys.filter(key => FAULT_DATA?.[0]?.[key]?.length).length,
      renderedEnvironmentTables: document.querySelectorAll(".bg-table-card").length,
      activeFaultRows: document.querySelectorAll("#faultListBody tr.active").length,
      firstFaultDDS: FAULT_DATA?.[0]?.msg || ""
    };
  })()`);

  const expectedFields = "id,device,date_time,msg,has_env,bg_items,ag_items,bp_items,ap_items";
  const passed = /^(ABB|CGL) Diagnostic Report \(Formal Data View\)$/.test(result.heading)
    && result.reportFaults > 0
    && result.schemaFields === expectedFields
    && result.validClientDate
    && result.hasFourEnvironmentArrays
    && result.renderedFaultRows === result.reportFaults
    && result.renderedEnvironmentTables === result.expectedEnvironmentTables
    && result.activeFaultRows === 1
    && result.firstFaultDDS.length > 0;
  if (!passed) throw new Error(`Generated report verification failed: ${JSON.stringify(result)}`);
  reportWindow.setSize(1600, 900);
  const screenshotPath = reportPath.replace(/\.html$/i, ".png");
  const screenshot = await reportWindow.webContents.capturePage();
  fs.writeFileSync(screenshotPath, screenshot.toPNG());
  return { ...result, viewerChecks, reportBytes: stats.size, reportPath, screenshotPath };
}

app.whenReady().then(async () => {
  try {
    if (!samplePath || !fs.existsSync(samplePath)) {
      throw new Error("Pass an existing VCU .txt sample path to the HTML export test");
    }

    const outputPath = path.join(app.getPath("temp"), `cdac-vcu-html-export-${Date.now()}.html`);
    session.defaultSession.once("will-download", (_event, item) => {
      item.setSavePath(outputPath);
      item.once("done", async (_downloadEvent, state) => {
        if (state !== "completed") {
          finish(1, `HTML download ended with state: ${state}`);
          return;
        }
        try {
          const result = await verifyReport(outputPath);
          finish(0, JSON.stringify(result));
        } catch (error) {
          finish(1, error.stack || error.message);
        }
      });
    });

    sourceWindow = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    await sourceWindow.loadFile(packagedViewerPath || path.join(__dirname, "..", "vcu_fault_viewer", "index.html"));

    const base64 = fs.readFileSync(samplePath).toString("base64");
    const fileName = path.basename(samplePath);
    await sourceWindow.webContents.executeJavaScript(`(() => {
      const binary = atob(${JSON.stringify(base64)});
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      const file = new File([bytes], ${JSON.stringify(fileName)}, { type: "text/plain" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.getElementById("fileInput");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);

    await waitFor(() => sourceWindow.webContents.executeJavaScript(`
      document.getElementById("fileStatus").textContent.includes("loaded with")
        && !document.getElementById("exportHtml").disabled
    `));

    viewerChecks = await sourceWindow.webContents.executeJavaScript(`(() => {
      document.getElementById("depthAnalysisTab").click();
      const faultCheckbox = document.querySelector("#depthBody input[type='checkbox']");
      document.getElementById("depthSelectAll").click();
      const chooseButton = document.getElementById("depthChooseParameters");
      const chooseDisabled = chooseButton.disabled;
      chooseButton.click();
      const parameterCheckbox = document.querySelector("#parameterList input[type='checkbox']");
      parameterCheckbox?.click();
      const runButton = document.getElementById("runDepthAnalysis");
      const runDisabled = runButton.disabled;
      runButton.click();

      const initialRows = document.querySelectorAll(".depth-pivot-table tbody tr:not(.empty-row)").length;
      const filterCells = document.querySelectorAll(".depth-filter-row th").length;
      const sortControls = document.querySelectorAll(".depth-sort-select").length;
      const sortControl = document.querySelector(".depth-sort-select");
      const firstColumnValues = () => Array.from(
        document.querySelectorAll(".depth-pivot-table tbody tr:not(.empty-row) td:first-child")
      ).map(cell => cell.textContent.trim());
      if (sortControl) {
        sortControl.value = "asc";
        sortControl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const ascendingValues = firstColumnValues();
      if (sortControl) {
        sortControl.value = "desc";
        sortControl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const descendingValues = firstColumnValues();
      const sortReversed = ascendingValues.length < 2
        || (ascendingValues[0] === descendingValues[descendingValues.length - 1]
          && ascendingValues[ascendingValues.length - 1] === descendingValues[0]);
      const textFilter = document.querySelector(".depth-filter-row input[type='search']");
      if (textFilter) {
        textFilter.value = "__no_matching_depth_row__";
        textFilter.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const filteredRows = document.querySelectorAll(".depth-pivot-table tbody tr:not(.empty-row)").length;
      const clearEnabled = !document.getElementById("depthClearFilters").disabled;
      document.getElementById("depthClearFilters").click();
      const restoredRows = document.querySelectorAll(".depth-pivot-table tbody tr:not(.empty-row)").length;
      return {
        faultCheckboxFound: Boolean(faultCheckbox),
        chooseDisabled,
        parameterCheckboxFound: Boolean(parameterCheckbox),
        runDisabled,
        resultsHidden: document.getElementById("depthResultsView").hidden,
        initialRows,
        filterCells,
        sortControls,
        sortReversed,
        filteredRows,
        clearEnabled,
        restoredRows,
        hasFilterRow: Boolean(document.querySelector(".depth-filter-row"))
      };
    })()`);
    const depthPassed = viewerChecks.initialRows > 0
      && viewerChecks.filterCells >= 6
      && viewerChecks.sortControls === viewerChecks.filterCells
      && viewerChecks.sortReversed
      && viewerChecks.filteredRows === 0
      && viewerChecks.clearEnabled
      && viewerChecks.restoredRows === viewerChecks.initialRows
      && viewerChecks.hasFilterRow;
    if (!depthPassed) throw new Error(`Depth-analysis verification failed: ${JSON.stringify(viewerChecks)}`);

    await sourceWindow.webContents.executeJavaScript(`document.getElementById("exportHtml").click()`);
  } catch (error) {
    finish(1, error.stack || error.message);
  }
});

app.on("window-all-closed", () => {
  if (!finished) finish(1, "A test window closed before verification completed");
});
