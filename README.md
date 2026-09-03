# CDAC VCU Fault Analyser

Standalone Windows analyser for locomotive VCU diagnostic logs, developed by ELS/ED.

## Version

Current release: **5.0.0**

## Features

- Decodes 128-byte VCU TXT log records directly without Microsoft ACE/OLEDB.
- Supports ABB and CGL propulsion DDS fault descriptions.
- Displays fault occurrences and complete global/processor-specific environment data.
- Provides a fault count matrix and multi-parameter depth analysis.
- Adds per-column depth-analysis search, TRUE/FALSE selection, numeric comparisons, and ascending/descending sorting; filtered order is preserved in Excel/PDF exports.
- Exports CSV, Excel, PDF, and a standalone interactive HTML fault report.
- Fault CSV downloads use the client-compatible record format: `SL_No`, `Error_count`, `Date & Time`, and `Err1_Info2` through `Err16_Info2`.
- HTML reports mirror the canonical client template line for line and use the client-compatible `FAULT_DATA` schema:
  `id`, `device`, `date_time`, `msg`, `has_env`, `bg_items`, `ag_items`, `bp_items`, `ap_items`.
- HTML reports use compact JSON and Windows CRLF line endings for compatibility with size-limited and line-ending-sensitive client software.
- HTML downloads use only the 5- or 6-digit locomotive number from the source filename (for example, `35017.html`).
- Keeps the familiar v4 interface inside a lightweight Windows application window; it does not open a separate browser.
- Uses the Microsoft Edge WebView2 Runtime already shared by Windows, with no Python runtime or local server.
- Clears the embedded browser cache on every application launch.

## Install

Run:

`release/CDAC-VCU-Fault-Analyser-Setup-5.0.0.exe`

The installer replaces an existing v2, v3, or v4 installation and creates Desktop and Start Menu shortcuts. Windows 10/11 x64 with Microsoft Edge WebView2 Runtime and .NET Framework 4.8 is required. The installer is not code-signed, so Windows may show an Unknown Publisher warning.

## Development

Requirements:

- .NET Framework 4.8 developer tools
- NSIS 3
- Internet access on the first build to download the checksum-pinned WebView2 SDK
- Python 3 only when regenerating `dictionaries.js`

Build the Windows installer:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File vcu_webview2\build.ps1
```

Regenerate ABB/CGL and environment dictionaries from the included sources:

```powershell
python vcu_fault_viewer/build_data.py
```

The application runtime itself does not require Python.

## Project Layout

- `vcu_fault_viewer/`: decoder, interface, export logic, and local vendor libraries.
- `vcu_webview2/`: lightweight Windows application host and installer configuration.
- `vcu_desktop/`: legacy Electron wrapper source retained for reference; it is not used by the v5 release.
- `dds/`: ABB and CGL DDS source text files.
- `data_sources/`: device and environment mapping source data.
- `release/`: verified standalone Windows installer.
