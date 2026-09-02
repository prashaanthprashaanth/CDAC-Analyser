# CDAC VCU Fault Analyser

Standalone Windows analyser for locomotive VCU diagnostic logs, developed by ELS/ED.

## Version

Current release: **3.0.0**

## Features

- Decodes 128-byte VCU TXT log records directly without Microsoft ACE/OLEDB.
- Supports ABB and CGL propulsion DDS fault descriptions.
- Displays fault occurrences and complete global/processor-specific environment data.
- Provides a fault count matrix and multi-parameter depth analysis.
- Adds per-column depth-analysis search, TRUE/FALSE selection, numeric comparisons, and ascending/descending sorting; filtered order is preserved in Excel/PDF exports.
- Exports CSV, Excel, PDF, and a standalone interactive HTML fault report.
- HTML reports mirror the canonical client template line for line and use the client-compatible `FAULT_DATA` schema:
  `id`, `device`, `date_time`, `msg`, `has_env`, `bg_items`, `ag_items`, `bp_items`, `ap_items`.
- HTML reports use compact JSON and Windows CRLF line endings for compatibility with size-limited and line-ending-sensitive client software.
- HTML downloads use only the 5- or 6-digit locomotive number from the source filename (for example, `35017.html`).
- Runs as a self-contained Electron desktop application with no Python runtime or local server.
- Clears the embedded browser cache on every application launch.

## Install

Run:

`release/CDAC-VCU-Fault-Analyser-Setup-3.0.0.exe`

The installer creates Desktop and Start Menu shortcuts. Windows x64 is required. The installer is not code-signed, so Windows may show an Unknown Publisher warning.

## Development

Requirements:

- Node.js and npm
- Python 3 only when regenerating `dictionaries.js`

Build the Windows installer:

```powershell
cd vcu_desktop
npm ci
npm run dist
```

Regenerate ABB/CGL and environment dictionaries from the included sources:

```powershell
python vcu_fault_viewer/build_data.py
```

The application runtime itself does not require Python.

## Project Layout

- `vcu_fault_viewer/`: decoder, interface, export logic, and local vendor libraries.
- `vcu_desktop/`: Electron desktop wrapper and installer configuration.
- `dds/`: ABB and CGL DDS source text files.
- `data_sources/`: device and environment mapping source data.
- `release/`: verified standalone Windows installer.
