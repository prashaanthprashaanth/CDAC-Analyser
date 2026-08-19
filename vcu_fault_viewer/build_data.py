import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "data" / "dictionaries.js"
DATA_SOURCES = ROOT / "data_sources"
DDS_SOURCES = ROOT / "dds"


def read_csv(name):
    with (DATA_SOURCES / name).open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def read_dds_set(name):
    rows = []
    for path in sorted((DDS_SOURCES / name).rglob("*.TXT")):
        for raw in path.read_text(errors="ignore").splitlines():
            match = re.match(r"^([A-Za-z0-9_]+):(\d+)-(.*)$", raw.strip())
            if not match:
                continue
            processor, code, description = match.groups()
            rows.append(
                {
                    "Processor": processor,
                    "Error_Info": int(code),
                    "Error_Text": f"{processor}:{int(code):04d}-{description.strip()}",
                }
            )
    return rows


def read_devices():
    devices = {}
    path = DATA_SOURCES / "Device_list.txt"
    for raw in path.read_text(errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith(("/", "*", "$")):
            continue
        parts = line.split()
        if not parts or "-" not in parts[0]:
            continue
        addr, display = parts[0].split("-", 1)
        devices[addr.lower()] = {
            "display": display,
            "envProc": parts[1] if len(parts) > 1 else display,
        }
    return devices


def main():
    payload = {
        "devices": read_devices(),
        "ddsSets": {
            "ABB": read_dds_set("ABB"),
            "CGL": read_dds_set("CGL"),
        },
        "globalBits": read_csv("analysis_GlobalEnvtData.csv"),
        "globalAnalog": read_csv("analysis_GlobalEnvtAnalogData.csv"),
        "procBits": read_csv("analysis_ProcEnvtData.csv"),
        "procAnalog": read_csv("analysis_ProcEnvtAnalogData.csv"),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "window.VCU_DICTIONARIES = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
