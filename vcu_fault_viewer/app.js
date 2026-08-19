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
    const title = `${report.propulsion} VCU Fault and Environment Report`;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlText(title)}</title>
  <style>
    :root { --brand:#0c3d91; --brand-dark:#051c5d; --ink:#101820; --muted:#4b5563; --line:#c9d2dc; --workspace:#eef2f7; --panel:#fff; --selected:#d8eaff; }
    * { box-sizing:border-box; }
    html, body { height:100%; }
    body { margin:0; overflow:hidden; color:var(--ink); background:var(--workspace); font:600 13px/1.4 "Segoe UI",Arial,sans-serif; }
    .report-header { min-height:76px; padding:10px 18px; color:#fff; background:var(--brand-dark); display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .report-header h1 { margin:0; font-size:21px; letter-spacing:0; }
    .report-header p { margin:3px 0 0; font-size:12px; }
    .summary { display:grid; grid-template-columns:repeat(3,auto); gap:8px 20px; text-align:right; font-size:12px; }
    .summary strong { display:block; font-size:15px; }
    .main { height:calc(100% - 76px); display:flex; overflow:hidden; }
    .pane { min-width:0; padding:12px; display:flex; flex-direction:column; overflow:hidden; }
    .fault-pane { width:44%; min-width:320px; max-width:75%; resize:horizontal; background:#fff; border-right:3px solid var(--line); }
    .environment-pane { flex:1; }
    .toolbar { min-height:42px; display:flex; align-items:center; gap:10px; padding-bottom:10px; }
    .toolbar input { min-width:0; flex:1; height:34px; padding:0 10px; border:1px solid #aeb8c4; border-radius:4px; font:inherit; }
    .toolbar input:focus { outline:2px solid #80aaff; border-color:var(--brand); }
    .count { white-space:nowrap; color:var(--muted); }
    .table-scroll { flex:1; overflow:auto; border:1px solid var(--line); background:#fff; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { padding:7px 9px; border:1px solid #dbe1e8; text-align:left; vertical-align:top; }
    th { position:sticky; top:0; z-index:2; color:var(--brand-dark); background:#e8eef7; cursor:pointer; user-select:none; white-space:nowrap; }
    #faultTable td:nth-child(1), #faultTable td:nth-child(2), #faultTable td:nth-child(3), #faultTable td:nth-child(4) { white-space:nowrap; }
    #faultTable td:last-child { min-width:260px; white-space:normal; font-weight:700; }
    tbody tr:hover td { background:#f0f5fb; }
    #faultTable tbody tr { cursor:pointer; }
    #faultTable tr.active td { background:var(--selected); }
    .selected-fault { min-height:42px; padding-bottom:8px; }
    .selected-fault h2 { margin:0; color:var(--brand-dark); font-size:15px; }
    .selected-fault p { margin:2px 0 0; color:var(--muted); font-size:12px; }
    .environment-tools { display:flex; align-items:flex-start; gap:12px; }
    .environment-tools .selected-fault { flex:1; min-width:0; }
    .environment-tools input { width:min(430px,45%); flex:none; }
    .env-grid { min-height:0; flex:1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:10px; }
    .env-section { min-width:0; min-height:0; display:flex; flex-direction:column; border:1px solid #aeb8c4; background:#fff; overflow:hidden; }
    .env-section h3 { margin:0; padding:7px 9px; color:#fff; background:var(--brand-dark); font-size:13px; }
    .env-section .table-scroll { border:0; }
    .env-section table { font-size:12px; }
    .env-section th { background:#edf2f8; color:var(--ink); }
    .value-true { color:#087452; font-weight:800; }
    .value-false { color:#4b5563; font-weight:700; }
    .empty { grid-column:1/-1; display:grid; place-items:center; padding:30px; color:var(--muted); background:#fff; border:1px solid var(--line); text-align:center; }
    .no-rows { color:var(--muted); font-style:italic; }
    @media (max-width:900px) {
      body { overflow:auto; }
      .report-header { align-items:flex-start; flex-direction:column; }
      .summary { grid-template-columns:repeat(2,auto); text-align:left; }
      .main { height:auto; min-height:calc(100% - 76px); flex-direction:column; overflow:visible; }
      .fault-pane { width:100%; max-width:none; min-width:0; height:48vh; resize:none; border-right:0; border-bottom:3px solid var(--line); }
      .environment-pane { min-height:900px; }
      .env-grid { grid-template-columns:1fr; grid-template-rows:repeat(4,280px); }
      .environment-tools { flex-direction:column; }
      .environment-tools input { width:100%; }
    }
  </style>
</head>
<body>
  <header class="report-header">
    <div>
      <h1>CDAC VCU FAULT ANALYSER</h1>
      <p>${htmlText(report.propulsion)} Diagnostic Report | ${htmlText(report.sourceFile)} | Developed by ELS/ED</p>
    </div>
    <div class="summary">
      <span><strong>${report.recordCount.toLocaleString("en-IN")}</strong>log records</span>
      <span><strong>${report.faultCount.toLocaleString("en-IN")}</strong>fault entries</span>
      <span><strong>${report.definedCount.toLocaleString("en-IN")}</strong>faults with DDS text</span>
      <span>${htmlText(report.dateRange)}</span>
    </div>
  </header>
  <main class="main">
    <section class="pane fault-pane">
      <div class="toolbar">
        <input id="faultSearch" type="search" placeholder="Filter faults by Device, Date, Time, or Message">
        <span id="faultCount" class="count"></span>
      </div>
      <div class="table-scroll">
        <table id="faultTable">
          <thead><tr>
            <th data-sort="id">No. &#x21C5;</th>
            <th data-sort="device">Device &#x21C5;</th>
            <th data-sort="date_time">Date Time &#x21C5;</th>
            <th data-sort="msg">Message &#x21C5;</th>
          </tr></thead>
          <tbody id="faultRows"></tbody>
        </table>
      </div>
    </section>
    <section class="pane environment-pane">
      <div class="environment-tools">
        <div id="selectedFault" class="selected-fault">
          <h2>Environment Data</h2>
          <p>Select a fault occurrence from the left.</p>
        </div>
        <input id="environmentSearch" type="search" placeholder="Filter environment parameters" disabled>
      </div>
      <div id="environmentGrid" class="env-grid">
        <div class="empty">Select a fault occurrence to view all global and processor-specific environment data.</div>
      </div>
    </section>
  </main>
  <script>
    const FAULT_DATA = ${serialized};
    const faultRows = document.getElementById("faultRows");
    const environmentGrid = document.getElementById("environmentGrid");
    const selectedFault = document.getElementById("selectedFault");
    const faultSearch = document.getElementById("faultSearch");
    const environmentSearch = document.getElementById("environmentSearch");
    const faultCount = document.getElementById("faultCount");
    let visibleFaults = FAULT_DATA.slice();
    let activeFaultId = null;
    let faultSort = { key:"id", ascending:true };
    const environmentSort = {};

    function escapeText(value) {
      return String(value == null ? "" : value)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }

    function renderFaults() {
      faultRows.innerHTML = visibleFaults.map(function(fault) {
        return '<tr data-fault-id="' + fault.id + '"' + (fault.id === activeFaultId ? ' class="active"' : '') + '>'
          + '<td>' + fault.id + '</td><td>' + escapeText(fault.device) + '</td>'
          + '<td>' + escapeText(fault.date_time) + '</td><td>' + escapeText(fault.msg) + '</td></tr>';
      }).join("");
      faultRows.querySelectorAll("tr").forEach(function(row) {
        row.addEventListener("click", function() { selectFault(Number(row.dataset.faultId)); });
      });
      faultCount.textContent = visibleFaults.length.toLocaleString("en-IN") + " faults";
    }

    function filterFaults() {
      const query = faultSearch.value.trim().toLowerCase();
      visibleFaults = FAULT_DATA.filter(function(fault) {
        return [fault.id, fault.device, fault.date_time, fault.msg]
          .some(function(value) { return String(value).toLowerCase().includes(query); });
      });
      applyFaultSort();
    }

    function applyFaultSort() {
      const key = faultSort.key;
      const direction = faultSort.ascending ? 1 : -1;
      visibleFaults.sort(function(a,b) {
        const left = a[key];
        const right = b[key];
        if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
        return String(left).localeCompare(String(right), undefined, { numeric:true }) * direction;
      });
      renderFaults();
    }

    function valueHtml(value) {
      const text = escapeText(value);
      if (value === "TRUE") return '<span class="value-true">TRUE</span>';
      if (value === "FALSE") return '<span class="value-false">FALSE</span>';
      return text;
    }

    function renderEnvironmentTable(id, title, rows) {
      const body = rows.length
        ? rows.map(function(row) { return '<tr><td>' + escapeText(row[0]) + '</td><td>' + escapeText(row[1]) + '</td><td>' + valueHtml(row[2]) + '</td></tr>'; }).join("")
        : '<tr class="no-rows"><td colspan="3">No values defined for this category</td></tr>';
      return '<section class="env-section"><h3>' + escapeText(title) + '</h3><div class="table-scroll"><table id="' + id + '">'
        + '<thead><tr><th data-column="0">ProcessValue &#x21C5;</th><th data-column="1">SignalName &#x21C5;</th><th data-column="2">SignalValue &#x21C5;</th></tr></thead>'
        + '<tbody>' + body + '</tbody></table></div></section>';
    }

    function selectFault(id) {
      const fault = FAULT_DATA.find(function(item) { return item.id === id; });
      if (!fault) return;
      activeFaultId = id;
      renderFaults();
      selectedFault.innerHTML = '<h2>' + escapeText(fault.msg) + '</h2><p>No. ' + fault.id
        + ' | ' + escapeText(fault.date_time) + ' | Device ' + escapeText(fault.device) + '</p>';
      environmentGrid.innerHTML = renderEnvironmentTable("globalBinary", "Binary Global Process Values", fault.bg_items)
        + renderEnvironmentTable("globalAnalog", "Analog Global Process Values", fault.ag_items)
        + renderEnvironmentTable("processorBinary", "Binary Processor Specific Process Values", fault.bp_items)
        + renderEnvironmentTable("processorAnalog", "Analog Processor Specific Process Values", fault.ap_items);
      environmentSearch.disabled = false;
      environmentSearch.value = "";
      bindEnvironmentSorting();
    }

    function bindEnvironmentSorting() {
      environmentGrid.querySelectorAll("th[data-column]").forEach(function(header) {
        header.addEventListener("click", function() {
          const table = header.closest("table");
          sortEnvironmentTable(table, Number(header.dataset.column));
        });
      });
    }

    function sortEnvironmentTable(table, column) {
      const state = environmentSort[table.id] || { column:-1, ascending:true };
      state.ascending = state.column === column ? !state.ascending : true;
      state.column = column;
      environmentSort[table.id] = state;
      const body = table.tBodies[0];
      const rows = Array.from(body.rows).filter(function(row) { return row.cells.length === 3; });
      rows.sort(function(a,b) {
        const left = a.cells[column].textContent.trim();
        const right = b.cells[column].textContent.trim();
        const leftNumber = Number.parseFloat(left);
        const rightNumber = Number.parseFloat(right);
        const comparison = Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
          ? leftNumber - rightNumber
          : left.localeCompare(right, undefined, { numeric:true });
        return state.ascending ? comparison : -comparison;
      });
      rows.forEach(function(row) { body.appendChild(row); });
    }

    faultSearch.addEventListener("input", filterFaults);
    environmentSearch.addEventListener("input", function() {
      const query = environmentSearch.value.trim().toLowerCase();
      environmentGrid.querySelectorAll("tbody tr").forEach(function(row) {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });
    document.querySelectorAll("#faultTable th[data-sort]").forEach(function(header) {
      header.addEventListener("click", function() {
        const key = header.dataset.sort;
        faultSort.ascending = faultSort.key === key ? !faultSort.ascending : true;
        faultSort.key = key;
        applyFaultSort();
      });
    });
    renderFaults();
    if (FAULT_DATA.length) selectFault(FAULT_DATA[0].id);
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

  function renderDepthResults() {
    const { faults, parameters, comparisons } = buildDepthComparisonData();
    el.depthResultsSubtitle.textContent = `${parameters.length.toLocaleString("en-IN")} parameters compared across ${faults.length.toLocaleString("en-IN")} fault occurrences`;
    el.depthResultsBody.textContent = "";

    const tableWrap = document.createElement("div");
    tableWrap.className = "depth-pivot-wrap depth-combined-table-wrap";
    const table = document.createElement("table");
    table.className = "depth-pivot-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Date & Time", "Fault DDS", "Processor", "SL_No", "Info1"].forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    });
    for (const parameter of parameters) {
      const th = document.createElement("th");
      th.className = "parameter-heading";
      th.title = `${parameter.scope} | ${parameter.kind} | ${parameter.signal || "No signal name"}`;
      const process = document.createElement("strong");
      process.textContent = parameter.process || parameter.signal;
      const signal = document.createElement("small");
      signal.textContent = parameter.signal || "No signal name";
      th.append(process, signal);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    for (const comparison of comparisons) {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      const dateButton = document.createElement("button");
      dateButton.type = "button";
      dateButton.className = "analysis-date";
      dateButton.textContent = comparison.fault.record.dateText;
      dateButton.title = "Open environment data for this fault occurrence";
      dateButton.addEventListener("click", () => showDetail(comparison.fault));
      dateCell.appendChild(dateButton);
      const faultCell = document.createElement("td");
      faultCell.textContent = comparison.fault.faultText;
      const processorCell = document.createElement("td");
      processorCell.textContent = comparison.fault.record.processor;
      const refCell = document.createElement("td");
      refCell.textContent = comparison.fault.record.slNo;
      const infoCell = document.createElement("td");
      infoCell.textContent = comparison.fault.info1;
      row.append(dateCell, faultCell, processorCell, refCell, infoCell);

      for (const parameter of parameters) {
        const valueCell = document.createElement("td");
        valueCell.className = "parameter-value";
        const hasValue = comparison.values.has(parameter.key);
        const value = hasValue ? comparison.values.get(parameter.key) : "Not available";
        valueCell.textContent = value;
        if (!hasValue) valueCell.classList.add("not-available");
        if (value === "TRUE") valueCell.classList.add("true-value");
        if (value === "FALSE") valueCell.classList.add("false-value");
        row.appendChild(valueCell);
      }
      tbody.appendChild(row);
    }
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    el.depthResultsBody.appendChild(tableWrap);
    el.depthResultsBody.scrollTop = 0;
  }

  function depthExportRows(data = buildDepthComparisonData()) {
    const header = [
      "Date & Time",
      "Fault DDS",
      "Processor",
      "SL_No",
      "Info1",
      ...data.parameters.map(parameterExportLabel)
    ];
    const rows = data.comparisons.map((comparison) => [
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

  async function loadFile(file) {
    const buffer = await file.arrayBuffer();
    state.buffer = buffer;
    state.fileName = file.name;
    decodeBuffer();
  }

  function decodeBuffer() {
    state.parsed = VCUDecoder.parseLog(state.buffer, window.VCU_DICTIONARIES, state.propulsion);
    state.faults = state.parsed.faults;
    state.filtered = state.faults;
    state.selectedFault = null;
    state.selectedGroup = null;
    state.depthFaultIds.clear();
    state.availableParameters = [];
    state.selectedParameterKeys.clear();
    if (state.view === "occurrences") state.view = "matrix";
    if (state.view === "depthResults") state.view = "depth";
    el.fileStatus.textContent = `${state.fileName} loaded with ${state.propulsion} DDS`;
    setSummary();
    setEnabled(true);
    setView(state.view);
    applyFilters();
  }

  el.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      await loadFile(file);
    } catch (error) {
      console.error(error);
      el.fileStatus.textContent = `Could not decode ${file.name}`;
      setEnabled(false);
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
