(function () {
  const state = {
    parsed: null,
    faults: [],
    filtered: [],
    selectedFault: null,
    selectedGroup: null,
    matrixGroups: [],
    depthFaultIds: new Set(),
    availableParameters: [],
    selectedParameterKeys: new Set(),
    depthColumnFilters: new Map(),
    depthSort: { key: "", direction: "" },
    view: "faults",
    buffer: null,
    propulsion: "CGL",
    fileName: ""
  };

  const el = {
    fileInput: document.getElementById("fileInput"),
    propulsionInputs: [...document.querySelectorAll('input[name="propulsion"]')],
    fileStatus: document.getElementById("fileStatus"),
    recordCount: document.getElementById("recordCount"),
    faultCount: document.getElementById("faultCount"),
    knownCount: document.getElementById("knownCount"),
    rangeText: document.getElementById("rangeText"),
    faultBody: document.getElementById("faultBody"),
    matrixBody: document.getElementById("matrixBody"),
    occurrenceBody: document.getElementById("occurrenceBody"),
    faultListView: document.getElementById("faultListView"),
    matrixView: document.getElementById("matrixView"),
    occurrenceView: document.getElementById("occurrenceView"),
    faultListTab: document.getElementById("faultListTab"),
    faultMatrixTab: document.getElementById("faultMatrixTab"),
    faultFilters: document.getElementById("faultFilters"),
    occurrenceBack: document.getElementById("occurrenceBack"),
    occurrenceTitle: document.getElementById("occurrenceTitle"),
    occurrenceSubtitle: document.getElementById("occurrenceSubtitle"),
    matrixExcelExport: document.getElementById("matrixExcelExport"),
    matrixPdfExport: document.getElementById("matrixPdfExport"),
    depthAnalysisTab: document.getElementById("depthAnalysisTab"),
    depthSelectionView: document.getElementById("depthSelectionView"),
    depthResultsView: document.getElementById("depthResultsView"),
    depthBody: document.getElementById("depthBody"),
    depthSelectAll: document.getElementById("depthSelectAll"),
    depthSelectedCount: document.getElementById("depthSelectedCount"),
    depthClearSelection: document.getElementById("depthClearSelection"),
    depthChooseParameters: document.getElementById("depthChooseParameters"),
    depthResultsBack: document.getElementById("depthResultsBack"),
    depthChangeParameters: document.getElementById("depthChangeParameters"),
    depthResultsSubtitle: document.getElementById("depthResultsSubtitle"),
    depthResultsBody: document.getElementById("depthResultsBody"),
    depthClearFilters: document.getElementById("depthClearFilters"),
    depthExcelExport: document.getElementById("depthExcelExport"),
    depthPdfExport: document.getElementById("depthPdfExport"),
    parameterDialog: document.getElementById("parameterDialog"),
    parameterDialogClose: document.getElementById("parameterDialogClose"),
    parameterDialogSubtitle: document.getElementById("parameterDialogSubtitle"),
    parameterSearch: document.getElementById("parameterSearch"),
    parameterSelectVisible: document.getElementById("parameterSelectVisible"),
    parameterClear: document.getElementById("parameterClear"),
    parameterList: document.getElementById("parameterList"),
    parameterSelectedCount: document.getElementById("parameterSelectedCount"),
    parameterCancel: document.getElementById("parameterCancel"),
    runDepthAnalysis: document.getElementById("runDepthAnalysis"),
    searchBox: document.getElementById("searchBox"),
    statusFilter: document.getElementById("statusFilter"),
    exportHtml: document.getElementById("exportHtml"),
    exportFaults: document.getElementById("exportFaults"),
    exportEnv: document.getElementById("exportEnv"),
    detailScreen: document.getElementById("detailScreen"),
    backButton: document.getElementById("backButton"),
    detailExport: document.getElementById("detailExport"),
    detailExcelExport: document.getElementById("detailExcelExport"),
    detailPdfExport: document.getElementById("detailPdfExport"),
    detailSubtitle: document.getElementById("detailSubtitle"),
    detailRef: document.getElementById("detailRef"),
    detailDate: document.getElementById("detailDate"),
    detailProcessor: document.getElementById("detailProcessor"),
    detailPropulsion: document.getElementById("detailPropulsion"),
    detailCount: document.getElementById("detailCount"),
    detailFaultText: document.getElementById("detailFaultText"),
    globalDigitalBody: document.getElementById("globalDigitalBody"),
    procDigitalBody: document.getElementById("procDigitalBody"),
    globalAnalogBody: document.getElementById("globalAnalogBody"),
    procAnalogBody: document.getElementById("procAnalogBody"),
    environmentPanel: document.getElementById("environmentPanel"),
    envGrid: document.getElementById("envGrid"),
    envScopeButtons: [...document.querySelectorAll("[data-env-scope]")],
    procDigitalTitle: document.getElementById("procDigitalTitle"),
    procAnalogTitle: document.getElementById("procAnalogTitle")
  };

  function setEnabled(enabled) {
    el.searchBox.disabled = !enabled;
    el.statusFilter.disabled = !enabled;
    el.exportHtml.disabled = !enabled;
    el.exportFaults.disabled = !enabled;
    el.exportEnv.disabled = !enabled;
    el.matrixExcelExport.disabled = !enabled;
    el.matrixPdfExport.disabled = !enabled;
  }

  function escapeCsv(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function exportBaseName() {
    return (state.fileName || "vcu_log").replace(/\.[^.]+$/, "");
  }

  function reportEnvironmentValues(rows) {
    return rows.map((row) => [row.process || "", row.signal || "", row.value || ""]);
  }

  function clientReportDateTime(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  }

  function buildHtmlReportData() {
    const environmentCache = new Map();
    const faults = state.faults.map((fault, index) => {
      if (!environmentCache.has(fault.record.slNo)) {
        const env = VCUDecoder.envRows(fault.record, state.parsed.maps);
        environmentCache.set(fault.record.slNo, {
          bg_items: reportEnvironmentValues(env.globalDigital),
          ag_items: reportEnvironmentValues(env.globalAnalog),
          bp_items: reportEnvironmentValues(env.processorDigital),
          ap_items: reportEnvironmentValues(env.processorAnalog)
        });
      }
      const environment = environmentCache.get(fault.record.slNo);
      return {
        id: index + 1,
        device: fault.record.processor,
        date_time: clientReportDateTime(fault.record.date),
        msg: fault.faultText,
        has_env: Object.values(environment).some((rows) => rows.length > 0),
        bg_items: environment.bg_items,
        ag_items: environment.ag_items,
        bp_items: environment.bp_items,
        ap_items: environment.ap_items
      };
    });
    const dates = state.faults.map((fault) => fault.record.date).sort((a, b) => a - b);
    return {
      sourceFile: state.fileName,
      propulsion: state.propulsion,
      generatedAt: new Date().toLocaleString("en-IN"),
      recordCount: state.parsed.records.length,
      faultCount: state.faults.length,
      definedCount: state.faults.filter((fault) => fault.defined).length,
      dateRange: dates.length
        ? `${clientReportDateTime(dates[0])} to ${clientReportDateTime(dates[dates.length - 1])}`
        : "-",
      faults
    };
  }

  function htmlText(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildHtmlReport() {
    const report = buildHtmlReportData();
    const serialized = JSON.stringify(report.faults)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    const title = `${report.propulsion} Fault Report`;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlText(title)}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #f4f5f7;
      color: #333;
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      background-color: #003366;
      color: white;
      padding: 12px 20px;
      font-size: 1.1rem;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 10;
      flex-shrink: 0;
    }
    .main-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .pane {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 15px;
    }
    .pane-left {
      border-right: 4px solid #ccd2d9;
      background-color: #fff;
      width: 40%;
      flex: none;
      resize: horizontal;
      min-width: 20%;
      max-width: 80%;
    }
    .pane-right {
      background-color: #f4f5f7;
    }
    .toolbar {
      padding-bottom: 12px;
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .toolbar input {
      padding: 6px 12px;
      width: 350px;
      border: 1px solid #aebac6;
      border-radius: 3px;
      font-size: 0.95rem;
    }
    .toolbar input:focus {
      outline: none;
      border-color: #003366;
      box-shadow: 0 0 3px rgba(0, 51, 102, 0.5);
    }
    .table-container {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #aebac6;
      background: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    th, td {
      padding: 6px 10px;
      border: 1px solid #d5dbe0;
      text-align: left;
      white-space: nowrap;
      vertical-align: top;
    }
    th {
      background-color: #e4e9f0;
      color: #003366;
      position: sticky;
      top: 0;
      cursor: pointer;
      user-select: none;
      font-weight: bold;
      z-index: 5;
      resize: horizontal;
      overflow: auto;
    }
    th:hover {
      background-color: #d1dae3;
    }
    tr:hover td {
      background-color: #f0f4f8;
      cursor: pointer;
    }
    tr.active td {
      background-color: #cce0ff !important;
    }
    .bg-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 15px;
      overflow-y: auto;
      flex: 1;
      box-sizing: border-box;
    }
    .bg-table-card {
      border: 1px solid #aebac6;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 4px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      min-height: 0;
    }
    .bg-table-header {
      background-color: #003366;
      color: white;
      padding: 8px 12px;
      font-weight: bold;
      font-size: 0.85rem;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
    }
    .bg-table-wrapper {
      overflow-y: auto;
      flex: 1;
    }
    .bg-table-wrapper th {
      background-color: #f0f4f8;
      color: #333;
      cursor: pointer;
      font-weight: 600;
    }
    .bg-table-wrapper tr:hover td {
      background-color: #fff;
      cursor: default;
    }
    .empty-state {
      padding: 30px;
      text-align: center;
      color: #555;
      grid-column: 1 / -1;
      font-style: italic;
    }
    .val-true { color: #008000; font-weight: bold; }
    .val-false { color: #666; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    ::-webkit-scrollbar-thumb { background: #bcc5ce; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #99a5b3; }
    @media (max-width:900px) {
      body { overflow: auto; }
      .main-container { min-height: 1200px; flex-direction: column; overflow: visible; }
      .pane-left { width: auto; min-width: 0; max-width: none; height: 45vh; resize: none; border-right: 0; border-bottom: 4px solid #ccd2d9; }
      .toolbar { flex-direction: column; align-items: stretch; gap: 8px; }
      .toolbar input { width: auto !important; }
      .bg-grid { grid-template-columns: 1fr; grid-template-rows: repeat(4, 280px); overflow: visible; }
    }
  </style>
</head>
<body>
  <div class="header">${htmlText(report.propulsion)} Diagnostic Report (Formal Data View)</div>
  <div class="main-container">
    <div class="pane pane-left">
      <div class="toolbar">
        <input type="text" id="searchInput" placeholder="Filter faults by Device, Date, Time, or Message..." onkeyup="filterFaults()">
        <span id="faultCount" style="font-size: 0.9rem; color: #555; font-weight: bold;"></span>
      </div>
      <div class="table-container">
        <table id="faultTable">
          <thead>
            <tr>
              <th onclick="sortTable(0, 'num')">No. &#x21C5;</th>
              <th onclick="sortTable(1, 'str')">Device &#x21C5;</th>
              <th onclick="sortTable(2, 'str')">Date Time &#x21C5;</th>
              <th onclick="sortTable(3, 'str')">Message &#x21C5;</th>
            </tr>
          </thead>
          <tbody id="faultListBody"></tbody>
        </table>
      </div>
    </div>
    <div class="pane pane-right">
      <div class="toolbar">
        <input type="text" id="bgSearchInput" placeholder="Filter background data (Process Value, Name, Value)..." onkeyup="filterBgData()" style="width: 100%;">
      </div>
      <div class="bg-grid" id="bgGrid">
        <div class="empty-state">Select a fault record on the left to view its environmental background data.</div>
      </div>
    </div>
  </div>
  <script>
    const FAULT_DATA = ${serialized};
    const tbody = document.getElementById("faultListBody");
    const faultCount = document.getElementById("faultCount");
    const bgGrid = document.getElementById("bgGrid");
    const bgSearchInput = document.getElementById("bgSearchInput");
    let sortCol = -1;
    let sortAsc = true;
    const bgSortStates = {};

    function escapeText(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function init() {
      renderTable(FAULT_DATA);
      updateCount(FAULT_DATA.length);
    }

    function updateCount(count) {
      faultCount.textContent = count.toLocaleString("en-IN") + " fault records found";
    }

    function renderTable(data) {
      tbody.innerHTML = "";
      data.forEach(function(fault) {
        const row = document.createElement("tr");
        row.dataset.faultId = String(fault.id);
        row.innerHTML = "<td>" + escapeText(fault.id) + "</td>"
          + "<td>" + escapeText(fault.device) + "</td>"
          + "<td>" + escapeText(fault.date_time) + "</td>"
          + '<td style="white-space: normal;">' + escapeText(fault.msg) + "</td>";
        row.onclick = function() { selectFault(row, fault); };
        tbody.appendChild(row);
      });
    }

    function filterFaults() {
      const query = document.getElementById("searchInput").value.toLowerCase();
      const filtered = FAULT_DATA.filter(function(fault) {
        return [fault.id, fault.device, fault.date_time, fault.msg]
          .some(function(value) { return String(value == null ? "" : value).toLowerCase().includes(query); });
      });
      renderTable(filtered);
      updateCount(filtered.length);
      bgGrid.innerHTML = '<div class="empty-state">Select a fault record on the left to view its environmental background data.</div>';
      bgSearchInput.value = "";
    }

    function filterBgData() {
      const query = bgSearchInput.value.toLowerCase();
      document.querySelectorAll(".bg-table-wrapper tbody").forEach(function(body) {
        body.querySelectorAll("tr").forEach(function(row) {
          row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
        });
      });
    }

    function sortTable(colIdx, type) {
      if (sortCol === colIdx) sortAsc = !sortAsc;
      else {
        sortCol = colIdx;
        sortAsc = true;
      }
      const currentData = Array.from(tbody.querySelectorAll("tr")).map(function(row) {
        const id = Number(row.dataset.faultId || row.cells[0].innerText);
        return FAULT_DATA.find(function(fault) { return fault.id === id; });
      }).filter(Boolean);
      currentData.sort(function(a, b) {
        const left = colIdx === 0 ? a.id : colIdx === 1 ? a.device : colIdx === 2 ? a.date_time : a.msg;
        const right = colIdx === 0 ? b.id : colIdx === 1 ? b.device : colIdx === 2 ? b.date_time : b.msg;
        if (type === "num") return sortAsc ? left - right : right - left;
        return sortAsc
          ? String(left).localeCompare(String(right), undefined, { numeric: true })
          : String(right).localeCompare(String(left), undefined, { numeric: true });
      });
      renderTable(currentData);
    }

    function sortBgTable(tableId, colIdx) {
      const table = document.getElementById(tableId);
      const body = table.querySelector("tbody");
      const rows = Array.from(body.querySelectorAll("tr"));
      if (!bgSortStates[tableId]) bgSortStates[tableId] = { col: -1, asc: true };
      if (bgSortStates[tableId].col === colIdx) {
        bgSortStates[tableId].asc = !bgSortStates[tableId].asc;
      } else {
        bgSortStates[tableId].col = colIdx;
        bgSortStates[tableId].asc = true;
      }
      const asc = bgSortStates[tableId].asc;
      rows.sort(function(a, b) {
        const left = a.cells[colIdx].innerText;
        const right = b.cells[colIdx].innerText;
        const leftNumber = Number.parseFloat(left);
        const rightNumber = Number.parseFloat(right);
        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
          return asc ? leftNumber - rightNumber : rightNumber - leftNumber;
        }
        return asc
          ? left.localeCompare(right, undefined, { numeric: true })
          : right.localeCompare(left, undefined, { numeric: true });
      });
      body.innerHTML = "";
      rows.forEach(function(row) { body.appendChild(row); });
    }

    function formatVal(value) {
      const text = escapeText(value);
      if (value === "TRUE") return '<span class="val-true">TRUE</span>';
      if (value === "FALSE") return '<span class="val-false">FALSE</span>';
      return text;
    }

    function selectFault(row, fault) {
      Array.from(tbody.querySelectorAll("tr")).forEach(function(item) {
        item.classList.remove("active");
      });
      row.classList.add("active");
      bgSearchInput.value = "";
      if (!fault.has_env) {
        bgGrid.innerHTML = '<div class="empty-state">No background data available for this fault.</div>';
        return;
      }
      let html = "";
      html += renderBgTable("bg_t1", "Binary Global Process Values", ["ProcessValue", "SignalName", "Value"], fault.bg_items);
      html += renderBgTable("bg_t2", "Analog Global Process Values", ["ProcessValue", "SignalName", "SignalValue"], fault.ag_items);
      html += renderBgTable("bg_t3", "Binary Processor Specific Process Values", ["ProcessValue", "SignalName", "Value"], fault.bp_items);
      html += renderBgTable("bg_t4", "Analog Processor Specific Process Values", ["ProcessValue", "SignalName", "SignalValue"], fault.ap_items);
      bgGrid.innerHTML = html || '<div class="empty-state">No mapped data available for this fault.</div>';
    }

    function renderBgTable(tableId, title, columns, rows) {
      if (!rows || !rows.length) return "";
      const headings = columns.map(function(column, index) {
        return '<th onclick="sortBgTable(\\'' + tableId + '\\', ' + index + ')">' + escapeText(column) + " &#x21C5;</th>";
      }).join("");
      const body = rows.map(function(row) {
        return "<tr>" + row.map(function(cell) {
          return "<td>" + formatVal(cell) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      return '<div class="bg-table-card">'
        + '<div class="bg-table-header">' + escapeText(title) + "</div>"
        + '<div class="bg-table-wrapper">'
        + '<table id="' + tableId + '"><thead><tr>' + headings + '</tr></thead><tbody>' + body + "</tbody></table>"
        + "</div></div>";
    }

    init();
  </script>
</body>
</html>`;
  }

  async function exportHtmlReport() {
    if (!state.parsed) return;
    const originalText = el.exportHtml.textContent;
    el.exportHtml.disabled = true;
    el.exportHtml.textContent = "Preparing...";
    await new Promise((resolve) => window.requestAnimationFrame(() => window.setTimeout(resolve, 0)));
    try {
      const html = buildHtmlReport();
      const filename = `${exportBaseName()}_${state.propulsion}_fault_environment_report.html`;
      downloadBlob(filename, new Blob([html], { type: "text/html;charset=utf-8" }));
    } catch (error) {
      console.error(error);
      window.alert("The HTML report could not be created. Refresh the analyser and try again.");
    } finally {
      el.exportHtml.textContent = originalText;
      el.exportHtml.disabled = false;
    }
  }

  function runExport(action) {
    try {
      action();
    } catch (error) {
      console.error(error);
      window.alert("The export could not be created. Refresh the viewer and try again.");
    }
  }

  function safeSheetName(name, usedNames) {
    const clean = String(name || "Sheet").replace(/[\\/?*\[\]:]/g, " ").trim() || "Sheet";
    let candidate = clean.slice(0, 31);
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const tail = ` ${suffix}`;
      candidate = `${clean.slice(0, 31 - tail.length)}${tail}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  }

  function writeExcelWorkbook(filename, sheets) {
    if (!window.XLSX) throw new Error("Excel export library is unavailable");
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();
    for (const sheet of sheets) {
      const rows = sheet.rows && sheet.rows.length ? sheet.rows : [["No data"]];
      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const columnCount = Math.max(...rows.map((row) => row.length));
      worksheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => {
        const width = Math.max(
          10,
          ...rows.map((row) => String(row[columnIndex] ?? "").length + 2)
        );
        return { wch: Math.min(width, 48) };
      });
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name, usedNames));
    }
    XLSX.writeFile(workbook, filename);
  }

  function createPdf(options = {}) {
    const JsPdf = window.jspdf && window.jspdf.jsPDF;
    if (!JsPdf) throw new Error("PDF export library is unavailable");
    const doc = new JsPdf(options);
    if (typeof doc.autoTable !== "function") throw new Error("PDF table library is unavailable");
    return doc;
  }

  function addPdfHeading(doc, title, subtitle) {
    doc.setTextColor(12, 61, 145);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 32, 28);
    doc.setTextColor(16, 24, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (subtitle) doc.text(subtitle, 32, 42);
  }

  function pdfTableOptions() {
    return {
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 3, textColor: [16, 24, 32] },
      headStyles: { fillColor: [5, 28, 93], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      margin: { left: 32, right: 32 }
    };
  }

  function parameterExportLabel(parameter) {
    const process = parameter.process || parameter.signal;
    return parameter.signal && parameter.signal !== process
      ? `${process} [${parameter.signal}]`
      : process;
  }

  function setSummary() {
    if (!state.parsed) {
      el.recordCount.textContent = "0";
      el.faultCount.textContent = "0";
      el.knownCount.textContent = "0";
      el.rangeText.textContent = "-";
      return;
    }
    const records = state.parsed.records;
    const dates = state.faults.map((f) => f.record.date).sort((a, b) => a - b);
    el.recordCount.textContent = records.length.toLocaleString("en-IN");
    el.faultCount.textContent = state.faults.length.toLocaleString("en-IN");
    el.knownCount.textContent = state.faults.filter((f) => f.defined).length.toLocaleString("en-IN");
    el.rangeText.textContent = dates.length
      ? `${VCUDecoder.formatDate(dates[0])} to ${VCUDecoder.formatDate(dates[dates.length - 1])}`
      : "-";
  }

  function applyFilters() {
    if (!state.parsed) return;
    const q = el.searchBox.value.trim().toLowerCase();
    const status = el.statusFilter.value;
    state.filtered = state.faults.filter((fault) => {
      const haystack = [
        fault.record.slNo,
        fault.record.dateText,
        fault.record.processor,
        fault.record.envProcessor,
        fault.info1,
        fault.codeHex,
        fault.faultText
      ].join(" ").toLowerCase();
      const statusOk =
        status === "all" ||
        fault.info1 === status ||
        (status === "undefined" && !fault.defined);
      return statusOk && (!q || haystack.includes(q));
    });
    if (state.view === "matrix") renderMatrix();
    if (state.view === "faults") renderFaultTable();
    if (state.view === "depth") renderDepthTable();
  }

  function renderFaultTable() {
    el.faultBody.textContent = "";
    if (!state.filtered.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = state.parsed ? "No matching fault" : "Upload TXT";
      row.appendChild(cell);
      el.faultBody.appendChild(row);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const fault of state.filtered) {
      const row = document.createElement("tr");
      row.dataset.id = fault.id;
      row.className = state.selectedFault && state.selectedFault.id === fault.id ? "active" : "";
      const values = [
        fault.record.slNo,
        String(fault.record.errorCount).padStart(2, "0"),
        fault.record.dateText,
        fault.faultText,
        fault.record.processor,
        fault.info1,
        fault.codeHex,
        fault.record.envCount.toString(16).padStart(2, "0")
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 3 && !fault.defined) cell.className = "status-undefined";
        row.appendChild(cell);
      });
      row.addEventListener("click", () => showDetail(fault));
      frag.appendChild(row);
    }
    el.faultBody.appendChild(frag);
  }

  function ddsCode(fault) {
    return String(parseInt(fault.codeHex, 16)).padStart(4, "0");
  }

  function buildMatrix(faults) {
    const groups = new Map();
    for (const fault of faults) {
      const key = `${fault.record.processor}|${fault.codeHex}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          processor: fault.record.processor,
          code: ddsCode(fault),
          faultText: fault.faultText,
          defined: fault.defined,
          occurrences: []
        });
      }
      groups.get(key).occurrences.push(fault);
    }

    return [...groups.values()]
      .map((group) => {
        group.occurrences.sort((a, b) => b.record.date - a.record.date || b.record.slNo - a.record.slNo);
        group.lastSeen = group.occurrences[0];
        group.firstSeen = group.occurrences[group.occurrences.length - 1];
        return group;
      })
      .sort((a, b) => b.occurrences.length - a.occurrences.length || a.faultText.localeCompare(b.faultText));
  }

  function renderMatrix() {
    state.matrixGroups = buildMatrix(state.filtered);
    el.matrixBody.textContent = "";
    const frag = document.createDocumentFragment();

    for (const group of state.matrixGroups) {
      const row = document.createElement("tr");
      const faultCell = document.createElement("td");
      faultCell.textContent = group.faultText;
      if (!group.defined) faultCell.className = "status-undefined";

      const processorCell = document.createElement("td");
      processorCell.textContent = group.processor;
      const codeCell = document.createElement("td");
      codeCell.textContent = group.code;

      const countCell = document.createElement("td");
      const countButton = document.createElement("button");
      countButton.type = "button";
      countButton.className = "matrix-count";
      countButton.textContent = group.occurrences.length.toLocaleString("en-IN");
      countButton.title = `Show all dates for ${group.faultText}`;
      countButton.addEventListener("click", () => showOccurrences(group));
      countCell.appendChild(countButton);

      const firstCell = document.createElement("td");
      firstCell.textContent = group.firstSeen.record.dateText;
      const lastCell = document.createElement("td");
      lastCell.textContent = group.lastSeen.record.dateText;
      row.append(faultCell, processorCell, codeCell, countCell, firstCell, lastCell);
      frag.appendChild(row);
    }

    if (!state.matrixGroups.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = state.parsed ? "No matching faults" : "Upload TXT";
      row.appendChild(cell);
      frag.appendChild(row);
    }
    el.matrixBody.appendChild(frag);
  }

  function matrixExportRows() {
    return [
      ["Fault", "Processor", "DDS Code", "Occurrences", "First Seen", "Last Seen"],
      ...state.matrixGroups.map((group) => [
        group.faultText,
        group.processor,
        group.code,
        group.occurrences.length,
        group.firstSeen.record.dateText,
        group.lastSeen.record.dateText
      ])
    ];
  }

  function exportMatrixExcel() {
    renderMatrix();
    writeExcelWorkbook(
      `${exportBaseName()}_${state.propulsion}_fault_count_matrix.xlsx`,
      [{ name: "Fault Count Matrix", rows: matrixExportRows() }]
    );
  }

  function exportMatrixPdf() {
    renderMatrix();
    const rows = matrixExportRows();
    const doc = createPdf({ orientation: "landscape", unit: "pt", format: "a4" });
    addPdfHeading(doc, "CDAC VCU Fault Count Matrix", `${exportBaseName()} | ${state.propulsion} DDS`);
    doc.autoTable({
      ...pdfTableOptions(),
      head: [rows[0]],
      body: rows.slice(1),
      startY: 52,
      styles: { ...pdfTableOptions().styles, fontSize: 6.5 }
    });
    doc.save(`${exportBaseName()}_${state.propulsion}_fault_count_matrix.pdf`);
  }

  function renderOccurrences() {
    const group = state.selectedGroup;
    if (!group) return;
    el.occurrenceTitle.textContent = group.faultText;
    el.occurrenceSubtitle.textContent = `${group.occurrences.length.toLocaleString("en-IN")} occurrences | ${group.processor} | DDS ${group.code}`;
    el.occurrenceBody.textContent = "";
    const frag = document.createDocumentFragment();

    group.occurrences.forEach((fault, index) => {
      const row = document.createElement("tr");
      const noCell = document.createElement("td");
      noCell.textContent = index + 1;
      const refCell = document.createElement("td");
      refCell.textContent = fault.record.slNo;
      const dateCell = document.createElement("td");
      const dateButton = document.createElement("button");
      dateButton.type = "button";
      dateButton.className = "occurrence-date";
      dateButton.textContent = fault.record.dateText;
      dateButton.title = "Open environment data for this occurrence";
      dateButton.addEventListener("click", () => showDetail(fault));
      dateCell.appendChild(dateButton);
      const processorCell = document.createElement("td");
      processorCell.textContent = fault.record.processor;
      const infoCell = document.createElement("td");
      infoCell.textContent = fault.info1;
      const envCell = document.createElement("td");
      envCell.textContent = fault.record.envCount;
      row.append(noCell, refCell, dateCell, processorCell, infoCell, envCell);
      frag.appendChild(row);
    });
    el.occurrenceBody.appendChild(frag);
  }

  function selectedDepthFaults() {
    return state.faults.filter((fault) => state.depthFaultIds.has(fault.id));
  }

  function updateDepthSelectionUI() {
    const selectedCount = state.depthFaultIds.size;
    el.depthSelectedCount.textContent = selectedCount.toLocaleString("en-IN");
    el.depthChooseParameters.disabled = selectedCount === 0;
    el.depthClearSelection.disabled = selectedCount === 0;

    const visibleCount = state.filtered.length;
    const visibleSelected = state.filtered.filter((fault) => state.depthFaultIds.has(fault.id)).length;
    el.depthSelectAll.disabled = !state.parsed || visibleCount === 0;
    el.depthSelectAll.checked = visibleCount > 0 && visibleSelected === visibleCount;
    el.depthSelectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleCount;
  }

  function renderDepthTable() {
    el.depthBody.textContent = "";
    const frag = document.createDocumentFragment();

    for (const fault of state.filtered) {
      const row = document.createElement("tr");
      const selectCell = document.createElement("td");
      selectCell.className = "checkbox-column";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.depthFaultIds.has(fault.id);
      checkbox.setAttribute("aria-label", `Select ${fault.faultText} at ${fault.record.dateText}`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.depthFaultIds.add(fault.id);
        else state.depthFaultIds.delete(fault.id);
        row.classList.toggle("selected", checkbox.checked);
        updateDepthSelectionUI();
      });
      selectCell.appendChild(checkbox);

      const values = [
        fault.record.slNo,
        fault.record.dateText,
        fault.faultText,
        fault.record.processor,
        fault.info1,
        fault.codeHex,
        fault.record.envCount.toString(16).padStart(2, "0")
      ];
      row.appendChild(selectCell);
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 2 && !fault.defined) cell.className = "status-undefined";
        row.appendChild(cell);
      });
      row.classList.toggle("selected", checkbox.checked);
      frag.appendChild(row);
    }

    if (!state.filtered.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = 8;
      cell.textContent = state.parsed ? "No matching faults" : "Upload TXT";
      row.appendChild(cell);
      frag.appendChild(row);
    }
    el.depthBody.appendChild(frag);
    updateDepthSelectionUI();
  }

  function environmentParameterKey(row) {
    return [row.Scope, row.Kind, row.ProcessValue, row.SignalName].join("\u001f");
  }

  function collectAvailableParameters(faults) {
    const representatives = new Map();
    for (const fault of faults) {
      if (!representatives.has(fault.record.envProcessor)) {
        representatives.set(fault.record.envProcessor, fault);
      }
    }

    const parameters = new Map();
    for (const fault of representatives.values()) {
      const rows = VCUDecoder.longEnvironmentRows(fault, state.parsed.maps);
      for (const row of rows) {
        if (!row.ProcessValue && !row.SignalName) continue;
        const key = environmentParameterKey(row);
        if (!parameters.has(key)) {
          parameters.set(key, {
            key,
            scope: row.Scope,
            kind: row.Kind,
            process: row.ProcessValue,
            signal: row.SignalName
          });
        }
      }
    }

    const scopeOrder = { Global: 0, Processor: 1 };
    return [...parameters.values()].sort((a, b) =>
      (scopeOrder[a.scope] ?? 9) - (scopeOrder[b.scope] ?? 9) ||
      (a.kind === "Digital" ? 0 : 1) - (b.kind === "Digital" ? 0 : 1) ||
      a.process.localeCompare(b.process) ||
      a.signal.localeCompare(b.signal)
    );
  }

  function parameterMatches(parameter, query) {
    if (!query) return true;
    return [parameter.scope, parameter.kind, parameter.process, parameter.signal]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function parameterGroupName(parameter) {
    const kind = parameter.kind === "Digital" ? "Binary" : "Analog / Numeric";
    return `${parameter.scope} ${kind}`;
  }

  function updateParameterSelectionUI() {
    const count = state.selectedParameterKeys.size;
    el.parameterSelectedCount.textContent = `${count.toLocaleString("en-IN")} parameter${count === 1 ? "" : "s"} selected`;
    el.runDepthAnalysis.disabled = count === 0;
  }

  function renderParameterList() {
    const query = el.parameterSearch.value.trim().toLowerCase();
    const visible = state.availableParameters.filter((parameter) => parameterMatches(parameter, query));
    el.parameterList.textContent = "";
    const groups = new Map();
    for (const parameter of visible) {
      const name = parameterGroupName(parameter);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(parameter);
    }

    const frag = document.createDocumentFragment();
    for (const [name, parameters] of groups) {
      const section = document.createElement("section");
      section.className = "parameter-group";
      const heading = document.createElement("h3");
      heading.textContent = `${name} (${parameters.length})`;
      const options = document.createElement("div");
      options.className = "parameter-options";

      for (const parameter of parameters) {
        const label = document.createElement("label");
        label.className = "parameter-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedParameterKeys.has(parameter.key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.selectedParameterKeys.add(parameter.key);
          else state.selectedParameterKeys.delete(parameter.key);
          updateParameterSelectionUI();
        });
        const copy = document.createElement("span");
        const process = document.createElement("strong");
        process.textContent = parameter.process || parameter.signal;
        const signal = document.createElement("small");
        signal.textContent = parameter.signal || "No signal name";
        copy.append(process, signal);
        label.append(checkbox, copy);
        options.appendChild(label);
      }
      section.append(heading, options);
      frag.appendChild(section);
    }

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "parameter-empty";
      empty.textContent = "No environment parameters match this search.";
      frag.appendChild(empty);
    }
    el.parameterList.appendChild(frag);
    updateParameterSelectionUI();
  }

  function openParameterDialog() {
    const faults = selectedDepthFaults();
    if (!faults.length) return;
    state.availableParameters = collectAvailableParameters(faults);
    const availableKeys = new Set(state.availableParameters.map((parameter) => parameter.key));
    state.selectedParameterKeys = new Set(
      [...state.selectedParameterKeys].filter((key) => availableKeys.has(key))
    );
    el.parameterDialogSubtitle.textContent = `${faults.length.toLocaleString("en-IN")} selected fault occurrences | ${state.availableParameters.length.toLocaleString("en-IN")} available parameters`;
    el.parameterSearch.value = "";
    renderParameterList();
    if (!el.parameterDialog.open) el.parameterDialog.showModal();
  }

  function buildDepthComparisonData() {
    const faults = selectedDepthFaults();
    const parameters = state.availableParameters.filter((parameter) =>
      state.selectedParameterKeys.has(parameter.key)
    );
    const comparisons = faults.map((fault) => {
      const values = new Map();
      for (const row of VCUDecoder.longEnvironmentRows(fault, state.parsed.maps)) {
        values.set(environmentParameterKey(row), row.Decoded_Value);
      }
      return { fault, values };
    });
    return { faults, parameters, comparisons };
  }

  function parseDepthNumber(value) {
    const text = String(value ?? "").trim().replace(/,/g, "");
    const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s|$)/);
    if (!match) return null;
    const number = Number(match[1]);
    return Number.isFinite(number) ? number : null;
  }

  function depthParameterType(parameter, comparisons) {
    const values = comparisons
      .filter((comparison) => comparison.values.has(parameter.key))
      .map((comparison) => String(comparison.values.get(parameter.key) ?? "").trim())
      .filter((value) => value && value !== "Not available");
    if (values.length && values.every((value) => value === "TRUE" || value === "FALSE")) return "binary";
    if (values.length && values.every((value) => parseDepthNumber(value) !== null)) return "number";
    return "text";
  }

  function depthColumnDefinitions(data) {
    return [
      {
        key: "meta:date",
        label: "Date & Time",
        filterType: "text",
        sortType: "date",
        value: (comparison) => comparison.fault.record.dateText,
        sortValue: (comparison) => comparison.fault.record.date.getTime(),
        isDate: true
      },
      {
        key: "meta:fault",
        label: "Fault DDS",
        filterType: "text",
        sortType: "text",
        value: (comparison) => comparison.fault.faultText
      },
      {
        key: "meta:processor",
        label: "Processor",
        filterType: "text",
        sortType: "text",
        value: (comparison) => comparison.fault.record.processor
      },
      {
        key: "meta:slNo",
        label: "SL_No",
        filterType: "number",
        sortType: "number",
        value: (comparison) => comparison.fault.record.slNo
      },
      {
        key: "meta:info1",
        label: "Info1",
        filterType: "number",
        sortType: "number",
        value: (comparison) => comparison.fault.info1
      },
      ...data.parameters.map((parameter) => {
        const filterType = depthParameterType(parameter, data.comparisons);
        return {
          key: `parameter:${parameter.key}`,
          label: parameter.process || parameter.signal,
          signal: parameter.signal || "No signal name",
          title: `${parameter.scope} | ${parameter.kind} | ${parameter.signal || "No signal name"}`,
          filterType,
          sortType: filterType === "number" ? "number" : "text",
          parameter,
          value: (comparison) => comparison.values.has(parameter.key)
            ? comparison.values.get(parameter.key)
            : "Not available"
        };
      })
    ];
  }

  function depthFilterMatches(comparison, column) {
    const filter = state.depthColumnFilters.get(column.key);
    if (!filter) return true;
    const value = column.value(comparison);
    if (column.filterType === "binary") {
      return !filter.value || String(value).toUpperCase() === filter.value;
    }
    if (column.filterType === "number") {
      if (!filter.operator || filter.value === "") return true;
      const actual = parseDepthNumber(value);
      const expected = Number(filter.value);
      if (actual === null || !Number.isFinite(expected)) return false;
      if (filter.operator === "lt") return actual < expected;
      if (filter.operator === "lte") return actual <= expected;
      if (filter.operator === "gt") return actual > expected;
      if (filter.operator === "gte") return actual >= expected;
      return actual === expected;
    }
    const query = String(filter.value || "").trim().toLowerCase();
    return !query || String(value ?? "").toLowerCase().includes(query);
  }

  function applyDepthFiltersAndSort(comparisons, columns) {
    const visible = comparisons.filter((comparison) =>
      columns.every((column) => depthFilterMatches(comparison, column))
    );
    const sortColumn = columns.find((column) => column.key === state.depthSort.key);
    if (!sortColumn || !state.depthSort.direction) return visible;
    return [...visible].sort((a, b) => {
      const rawA = sortColumn.sortValue ? sortColumn.sortValue(a) : sortColumn.value(a);
      const rawB = sortColumn.sortValue ? sortColumn.sortValue(b) : sortColumn.value(b);
      const valueA = sortColumn.sortType === "number" ? parseDepthNumber(rawA) : rawA;
      const valueB = sortColumn.sortType === "number" ? parseDepthNumber(rawB) : rawB;
      const missingA = valueA === null || valueA === undefined || valueA === "" || valueA === "Not available";
      const missingB = valueB === null || valueB === undefined || valueB === "" || valueB === "Not available";
      if (missingA !== missingB) return missingA ? 1 : -1;
      let result = 0;
      if (sortColumn.sortType === "number" || sortColumn.sortType === "date") {
        result = Number(valueA) - Number(valueB);
      } else {
        result = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: "base" });
      }
      return state.depthSort.direction === "desc" ? -result : result;
    });
  }

  function addSelectOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function createDepthFilterCell(column, refreshRows) {
    const cell = document.createElement("th");
    cell.className = "depth-filter-cell";
    if (column.parameter) cell.classList.add("parameter-filter-cell");
    cell.dataset.columnKey = column.key;
    cell.dataset.filterType = column.filterType;
    const controls = document.createElement("div");
    controls.className = "depth-column-controls";
    const current = state.depthColumnFilters.get(column.key) || {};

    if (column.filterType === "binary") {
      const select = document.createElement("select");
      select.className = "depth-value-filter";
      select.setAttribute("aria-label", `Filter ${column.label}`);
      addSelectOption(select, "", "All values");
      addSelectOption(select, "TRUE", "TRUE");
      addSelectOption(select, "FALSE", "FALSE");
      select.value = current.value || "";
      select.addEventListener("change", () => {
        state.depthColumnFilters.set(column.key, { value: select.value });
        refreshRows();
      });
      controls.appendChild(select);
    } else if (column.filterType === "number") {
      const pair = document.createElement("div");
      pair.className = "depth-number-filter";
      const operator = document.createElement("select");
      operator.className = "depth-number-operator";
      operator.setAttribute("aria-label", `Comparison for ${column.label}`);
      [["", "All"], ["lt", "<"], ["lte", "<="], ["eq", "="], ["gte", ">="], ["gt", ">"]]
        .forEach(([value, label]) => addSelectOption(operator, value, label));
      operator.value = current.operator || "";
      const input = document.createElement("input");
      input.type = "number";
      input.step = "any";
      input.className = "depth-number-value";
      input.placeholder = "Value";
      input.value = current.value || "";
      input.setAttribute("aria-label", `Value for ${column.label}`);
      const update = () => {
        if (input.value && !operator.value) operator.value = "eq";
        state.depthColumnFilters.set(column.key, { operator: operator.value, value: input.value });
        refreshRows();
      };
      operator.addEventListener("change", update);
      input.addEventListener("input", update);
      pair.append(operator, input);
      controls.appendChild(pair);
    } else {
      const input = document.createElement("input");
      input.type = "search";
      input.className = "depth-text-filter";
      input.placeholder = "Search...";
      input.value = current.value || "";
      input.setAttribute("aria-label", `Search ${column.label}`);
      input.addEventListener("input", () => {
        state.depthColumnFilters.set(column.key, { value: input.value });
        refreshRows();
      });
      controls.appendChild(input);
    }

    const sort = document.createElement("select");
    sort.className = "depth-sort-select";
    sort.dataset.columnKey = column.key;
    sort.setAttribute("aria-label", `Sort ${column.label}`);
    addSelectOption(sort, "", "No sort");
    addSelectOption(sort, "asc", "Sort ascending");
    addSelectOption(sort, "desc", "Sort descending");
    sort.value = state.depthSort.key === column.key ? state.depthSort.direction : "";
    sort.addEventListener("change", () => {
      state.depthSort = { key: sort.value ? column.key : "", direction: sort.value };
      el.depthResultsBody.querySelectorAll(".depth-sort-select").forEach((other) => {
        if (other !== sort) other.value = "";
      });
      refreshRows();
    });
    controls.appendChild(sort);
    cell.appendChild(controls);
    return cell;
  }

  function updateDepthResultsSubtitle(parameterCount, visibleCount, totalCount) {
    const parameterText = `${parameterCount.toLocaleString("en-IN")} parameters compared`;
    el.depthResultsSubtitle.textContent = visibleCount === totalCount
      ? `${parameterText} across ${totalCount.toLocaleString("en-IN")} fault occurrences`
      : `${parameterText} | ${visibleCount.toLocaleString("en-IN")} of ${totalCount.toLocaleString("en-IN")} occurrences match filters`;
  }

  function hasActiveDepthFilters() {
    if (state.depthSort.direction) return true;
    return [...state.depthColumnFilters.values()].some((filter) =>
      Boolean(filter.value) || Boolean(filter.operator)
    );
  }

  function renderDepthResultRows(tbody, data, columns) {
    const comparisons = applyDepthFiltersAndSort(data.comparisons, columns);
    updateDepthResultsSubtitle(data.parameters.length, comparisons.length, data.comparisons.length);
    el.depthClearFilters.disabled = !hasActiveDepthFilters();
    tbody.textContent = "";
    const fragment = document.createDocumentFragment();
    for (const comparison of comparisons) {
      const row = document.createElement("tr");
      for (const column of columns) {
        const cell = document.createElement("td");
        const value = column.value(comparison);
        if (column.isDate) {
          const dateButton = document.createElement("button");
          dateButton.type = "button";
          dateButton.className = "analysis-date";
          dateButton.textContent = value;
          dateButton.title = "Open environment data for this fault occurrence";
          dateButton.addEventListener("click", () => showDetail(comparison.fault));
          cell.appendChild(dateButton);
        } else {
          cell.textContent = value;
        }
        if (column.parameter) cell.classList.add("parameter-value");
        if (value === "Not available") cell.classList.add("not-available");
        if (value === "TRUE") cell.classList.add("true-value");
        if (value === "FALSE") cell.classList.add("false-value");
        row.appendChild(cell);
      }
      fragment.appendChild(row);
    }
    if (!comparisons.length) {
      const row = document.createElement("tr");
      row.className = "empty-row";
      const cell = document.createElement("td");
      cell.colSpan = columns.length;
      cell.textContent = "No depth-analysis rows match the selected filters.";
      row.appendChild(cell);
      fragment.appendChild(row);
    }
    tbody.appendChild(fragment);
    return comparisons;
  }

  function renderDepthResults() {
    const data = buildDepthComparisonData();
    const columns = depthColumnDefinitions(data);
    const validKeys = new Set(columns.map((column) => column.key));
    for (const key of state.depthColumnFilters.keys()) {
      if (!validKeys.has(key)) state.depthColumnFilters.delete(key);
    }
    if (!validKeys.has(state.depthSort.key)) state.depthSort = { key: "", direction: "" };
    el.depthResultsBody.textContent = "";

    const tableWrap = document.createElement("div");
    tableWrap.className = "depth-pivot-wrap depth-combined-table-wrap";
    const table = document.createElement("table");
    table.className = "depth-pivot-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const column of columns) {
      const cell = document.createElement("th");
      if (column.parameter) {
        cell.className = "parameter-heading";
        cell.title = column.title;
        const process = document.createElement("strong");
        process.textContent = column.label;
        const signal = document.createElement("small");
        signal.textContent = column.signal;
        cell.append(process, signal);
      } else {
        cell.textContent = column.label;
      }
      headRow.appendChild(cell);
    }

    const filterRow = document.createElement("tr");
    filterRow.className = "depth-filter-row";
    const tbody = document.createElement("tbody");
    const refreshRows = () => renderDepthResultRows(tbody, data, columns);
    columns.forEach((column) => filterRow.appendChild(createDepthFilterCell(column, refreshRows)));
    thead.append(headRow, filterRow);
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    el.depthResultsBody.appendChild(tableWrap);
    refreshRows();
    el.depthResultsBody.scrollTop = 0;
  }

  function depthExportRows(data = buildDepthComparisonData()) {
    const columns = depthColumnDefinitions(data);
    const comparisons = applyDepthFiltersAndSort(data.comparisons, columns);
    const header = [
      "Date & Time",
      "Fault DDS",
      "Processor",
      "SL_No",
      "Info1",
      ...data.parameters.map(parameterExportLabel)
    ];
    const rows = comparisons.map((comparison) => [
      comparison.fault.record.dateText,
      comparison.fault.faultText,
      comparison.fault.record.processor,
      comparison.fault.record.slNo,
      comparison.fault.info1,
      ...data.parameters.map((parameter) =>
        comparison.values.has(parameter.key)
          ? comparison.values.get(parameter.key)
          : "Not available"
      )
    ]);
    return [header, ...rows];
  }

  function exportDepthExcel() {
    const rows = depthExportRows();
    writeExcelWorkbook(
      `${exportBaseName()}_${state.propulsion}_depth_analysis.xlsx`,
      [
        {
          name: "Depth Analysis",
          rows
        }
      ]
    );
  }

  function exportDepthPdf() {
    const rows = depthExportRows();
    const doc = createPdf({ orientation: "landscape", unit: "pt", format: "a3" });
    addPdfHeading(
      doc,
      "CDAC VCU Depth Analysis",
      `${exportBaseName()} | ${state.propulsion} DDS | ${rows.length - 1} fault occurrences`
    );
    const options = pdfTableOptions();
    doc.autoTable({
      ...options,
      head: [rows[0]],
      body: rows.slice(1),
      startY: 52,
      styles: { ...options.styles, fontSize: 5.5, cellPadding: 2.5 },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1],
      horizontalPageBreakBehaviour: "immediately",
      columnStyles: {
        0: { cellWidth: 112 },
        1: { cellWidth: 190 },
        2: { cellWidth: 50 },
        3: { cellWidth: 42 },
        4: { cellWidth: 38 }
      }
    });
    doc.save(`${exportBaseName()}_${state.propulsion}_depth_analysis.pdf`);
  }

  function setView(view) {
    state.view = view;
    el.faultListView.hidden = view !== "faults";
    el.matrixView.hidden = view !== "matrix";
    el.occurrenceView.hidden = view !== "occurrences";
    el.depthSelectionView.hidden = view !== "depth";
    el.depthResultsView.hidden = view !== "depthResults";
    el.faultFilters.hidden = view === "occurrences" || view === "depthResults";
    el.faultListTab.classList.toggle("active", view === "faults");
    el.faultMatrixTab.classList.toggle("active", view === "matrix" || view === "occurrences");
    el.depthAnalysisTab.classList.toggle("active", view === "depth" || view === "depthResults");
    el.searchBox.placeholder = view === "matrix"
      ? "Search fault matrix..."
      : view === "depth"
        ? "Search faults to select..."
        : "Search fault, processor, date...";
    if (view === "faults") renderFaultTable();
    if (view === "matrix") renderMatrix();
    if (view === "occurrences") renderOccurrences();
    if (view === "depth") renderDepthTable();
    if (view === "depthResults") renderDepthResults();
  }

  function showOccurrences(group) {
    state.selectedGroup = group;
    setView("occurrences");
  }

  function renderRows(body, rows, emptyText = "-") {
    body.textContent = "";
    const frag = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");
      const values = [row.process, row.signal, row.value];
      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = value;
        if (value === "TRUE") td.className = "true-value";
        if (value === "FALSE") td.className = "false-value";
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = emptyText;
      tr.appendChild(td);
      frag.appendChild(tr);
    }
    body.appendChild(frag);
  }

  function showDetail(fault) {
    state.selectedFault = fault;
    const env = VCUDecoder.envRows(fault.record, state.parsed.maps);
    el.detailSubtitle.textContent = `${fault.record.processor} ${fault.codeHex} - ${fault.faultText}`;
    el.detailRef.textContent = fault.record.slNo;
    el.detailDate.textContent = fault.record.dateText;
    el.detailProcessor.textContent = fault.record.processor;
    el.detailPropulsion.textContent = state.propulsion;
    el.detailCount.textContent = fault.record.errorCount.toString(16).padStart(2, "0");
    el.detailFaultText.textContent = fault.faultText;
    el.procDigitalTitle.textContent = `Binary Processor Specific Values - ${fault.record.envProcessor}`;
    el.procAnalogTitle.textContent = `Analog Processor Specific Values - ${fault.record.envProcessor}`;
    renderRows(el.globalDigitalBody, env.globalDigital);
    renderRows(
      el.procDigitalBody,
      env.processorDigital,
      `No processor-specific binary values defined for ${fault.record.envProcessor}`
    );
    renderRows(el.globalAnalogBody, env.globalAnalog);
    renderRows(
      el.procAnalogBody,
      env.processorAnalog,
      `No processor-specific analog values defined for ${fault.record.envProcessor}`
    );
    setEnvironmentScope("all");
    el.detailScreen.hidden = false;
    renderFaultTable();
  }

  function setEnvironmentScope(scope) {
    el.environmentPanel.dataset.scope = scope;
    el.envGrid.dataset.scope = scope;
    el.envScopeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.envScope === scope);
    });
  }

  function faultCsvRows(faults) {
    return [
      ["Propulsion", "SL_No", "Date & Time", "Device_Addr", "Processor", "Env_Processor", "Fault_Index", "Info1", "Code", "Fault_Text"],
      ...faults.map((fault) => [
        state.propulsion,
        fault.record.slNo,
        fault.record.dateText,
        fault.record.devAddr,
        fault.record.processor,
        fault.record.envProcessor,
        fault.faultIndex,
        fault.info1,
        fault.codeHex,
        fault.faultText
      ])
    ];
  }

  function envCsvRows(faults) {
    const header = [
      "Propulsion",
      "SL_No",
      "Date & Time",
      "Device_Addr",
      "Processor",
      "Env_Processor",
      "Fault_Index",
      "Fault_Status_Info1",
      "Fault_Code_Hex",
      "Fault_Text",
      "Scope",
      "Kind",
      "Word",
      "Bit",
      "ProcessValue",
      "SignalName",
      "Raw_Env",
      "Raw_Signed",
      "Decoded_Value"
    ];
    const rows = [header];
    for (const fault of faults) {
      VCUDecoder.longEnvironmentRows(fault, state.parsed.maps).forEach((row) => {
        rows.push(header.map((key) => key === "Propulsion" ? state.propulsion : row[key.replace("Date & Time", "DateTime")] ?? ""));
      });
    }
    return rows;
  }

  function selectedEnvironmentExport() {
    const fault = state.selectedFault;
    if (!fault) return null;
    const env = VCUDecoder.envRows(fault.record, state.parsed.maps);
    const detailRows = [
      ["Field", "Value"],
      ["Reference No.", fault.record.slNo],
      ["Date & Time", fault.record.dateText],
      ["Fault DDS", fault.faultText],
      ["Processor", fault.record.processor],
      ["Environment Processor", fault.record.envProcessor],
      ["Propulsion DDS", state.propulsion],
      ["Info1", fault.info1],
      ["DDS Code", ddsCode(fault)]
    ];
    const envRows = (rows) => [
      ["Process Value", "Signal Name", "Decoded Value", "Raw Word"],
      ...rows.map((row) => [row.process, row.signal, row.value, row.raw])
    ];
    return {
      fault,
      sheets: [
        { name: "Fault Details", rows: detailRows },
        { name: "Global Binary", rows: envRows(env.globalDigital) },
        { name: "Global Analog", rows: envRows(env.globalAnalog) },
        { name: "Processor Binary", rows: envRows(env.processorDigital) },
        { name: "Processor Analog", rows: envRows(env.processorAnalog) }
      ]
    };
  }

  function environmentExportFilename(fault, extension) {
    return `${exportBaseName()}_${state.propulsion}_SL${fault.record.slNo}_${fault.record.processor}_${ddsCode(fault)}_environment.${extension}`;
  }

  function exportDetailExcel() {
    const data = selectedEnvironmentExport();
    if (!data) return;
    writeExcelWorkbook(environmentExportFilename(data.fault, "xlsx"), data.sheets);
  }

  function exportDetailPdf() {
    const data = selectedEnvironmentExport();
    if (!data) return;
    const doc = createPdf({ orientation: "landscape", unit: "pt", format: "a4" });
    addPdfHeading(
      doc,
      "CDAC VCU Environment Data",
      `${data.fault.record.dateText} | ${data.fault.record.processor} | DDS ${ddsCode(data.fault)}`
    );
    const options = pdfTableOptions();
    let y = 56;
    data.sheets.forEach((sheet, index) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (index > 0 && y > pageHeight - 90) {
        doc.addPage();
        y = 36;
      }
      doc.setTextColor(12, 61, 145);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(sheet.name, 32, y);
      doc.autoTable({
        ...options,
        head: [sheet.rows[0]],
        body: sheet.rows.slice(1),
        startY: y + 7,
        styles: { ...options.styles, fontSize: 6.5 }
      });
      y = doc.lastAutoTable.finalY + 18;
    });
    doc.save(environmentExportFilename(data.fault, "pdf"));
  }

  function completeLoad(parsed, statusText) {
    state.parsed = parsed;
    state.faults = state.parsed.faults;
    state.filtered = state.faults;
    state.selectedFault = null;
    state.selectedGroup = null;
    state.depthFaultIds.clear();
    state.availableParameters = [];
    state.selectedParameterKeys.clear();
    state.depthColumnFilters.clear();
    state.depthSort = { key: "", direction: "" };
    if (state.view === "occurrences") state.view = "matrix";
    if (state.view === "depthResults") state.view = "depth";
    el.fileStatus.textContent = statusText;
    setSummary();
    setEnabled(true);
    setView(state.view);
    applyFilters();
  }

  async function loadFile(file) {
    state.buffer = await file.arrayBuffer();
    state.fileName = file.name;
    decodeBuffer();
  }

  function decodeBuffer() {
    const parsed = VCUDecoder.parseLog(state.buffer, window.VCU_DICTIONARIES, state.propulsion);
    completeLoad(parsed, `${state.fileName} loaded with ${state.propulsion} DDS`);
  }

  el.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      await loadFile(file);
    } catch (error) {
      console.error(error);
      el.fileStatus.textContent = `Could not load ${file.name}: ${error.message}`;
      setEnabled(false);
    } finally {
      event.target.value = "";
    }
  });

  el.propulsionInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.propulsion = input.value;
      el.detailScreen.hidden = true;
      if (state.buffer) {
        decodeBuffer();
      } else {
        el.fileStatus.textContent = `${state.propulsion} DDS selected`;
      }
    });
  });

  el.searchBox.addEventListener("input", applyFilters);
  el.statusFilter.addEventListener("change", applyFilters);

  el.faultListTab.addEventListener("click", () => setView("faults"));
  el.faultMatrixTab.addEventListener("click", () => setView("matrix"));
  el.depthAnalysisTab.addEventListener("click", () => setView("depth"));
  el.occurrenceBack.addEventListener("click", () => setView("matrix"));

  el.matrixExcelExport.addEventListener("click", () => runExport(exportMatrixExcel));
  el.matrixPdfExport.addEventListener("click", () => runExport(exportMatrixPdf));
  el.depthExcelExport.addEventListener("click", () => runExport(exportDepthExcel));
  el.depthPdfExport.addEventListener("click", () => runExport(exportDepthPdf));

  el.depthSelectAll.addEventListener("change", () => {
    for (const fault of state.filtered) {
      if (el.depthSelectAll.checked) state.depthFaultIds.add(fault.id);
      else state.depthFaultIds.delete(fault.id);
    }
    renderDepthTable();
  });

  el.depthClearSelection.addEventListener("click", () => {
    state.depthFaultIds.clear();
    renderDepthTable();
  });

  el.depthChooseParameters.addEventListener("click", openParameterDialog);
  el.depthResultsBack.addEventListener("click", () => setView("depth"));
  el.depthChangeParameters.addEventListener("click", openParameterDialog);
  el.depthClearFilters.addEventListener("click", () => {
    state.depthColumnFilters.clear();
    state.depthSort = { key: "", direction: "" };
    renderDepthResults();
  });

  el.parameterDialogClose.addEventListener("click", () => el.parameterDialog.close());
  el.parameterCancel.addEventListener("click", () => el.parameterDialog.close());
  el.parameterSearch.addEventListener("input", renderParameterList);

  el.parameterSelectVisible.addEventListener("click", () => {
    const query = el.parameterSearch.value.trim().toLowerCase();
    state.availableParameters
      .filter((parameter) => parameterMatches(parameter, query))
      .forEach((parameter) => state.selectedParameterKeys.add(parameter.key));
    renderParameterList();
  });

  el.parameterClear.addEventListener("click", () => {
    state.selectedParameterKeys.clear();
    renderParameterList();
  });

  el.runDepthAnalysis.addEventListener("click", () => {
    if (!state.selectedParameterKeys.size) return;
    el.parameterDialog.close();
    state.depthColumnFilters.clear();
    state.depthSort = { key: "", direction: "" };
    setView("depthResults");
  });

  el.envScopeButtons.forEach((button) => {
    button.addEventListener("click", () => setEnvironmentScope(button.dataset.envScope));
  });

  el.backButton.addEventListener("click", () => {
    el.detailScreen.hidden = true;
  });

  el.exportHtml.addEventListener("click", exportHtmlReport);

  el.exportFaults.addEventListener("click", () => {
    downloadCsv(`${state.fileName || "vcu"}_${state.propulsion}_faults.csv`, faultCsvRows(state.filtered));
  });

  el.exportEnv.addEventListener("click", () => {
    downloadCsv(`${state.fileName || "vcu"}_${state.propulsion}_environment.csv`, envCsvRows(state.filtered));
  });

  el.detailExport.addEventListener("click", () => {
    if (!state.selectedFault) return;
    downloadCsv(`${state.propulsion}_${state.selectedFault.record.slNo}_${state.selectedFault.codeHex}_environment.csv`, envCsvRows([state.selectedFault]));
  });

  el.detailExcelExport.addEventListener("click", () => runExport(exportDetailExcel));
  el.detailPdfExport.addEventListener("click", () => runExport(exportDetailPdf));
})();
