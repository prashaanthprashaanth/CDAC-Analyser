(function (root) {
  const RECORD_SIZE = 128;
  const IST_OFFSET_SECONDS = 19800;
  const SLG_BUR_PROCESSORS = new Set(["SLG1", "SLG2", "BUR1", "BUR2", "BUR3"]);

  function toHex(value, width = 2) {
    if (value === " " || value === null || value === undefined) return " ";
    return Number(value).toString(16).padStart(width, "0");
  }

  function wordHex(bytes, offset) {
    return toHex(bytes[offset], 2) + toHex(bytes[offset + 1], 2);
  }

  function signed16(hexWord) {
    if (!hexWord || String(hexWord).trim() === "") return null;
    const value = parseInt(hexWord, 16);
    return value >= 0x8000 ? value - 0x10000 : value;
  }

  function binaryFlags(hexWord) {
    const value = parseInt(hexWord && String(hexWord).trim() ? hexWord : "0000", 16);
    const flags = [];
    for (let bit = 0; bit < 16; bit += 1) {
      flags.push((value & (1 << bit)) ? "TRUE" : "FALSE");
    }
    return flags;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(date) {
    return `${pad2(date.getUTCDate())} . ${pad2(date.getUTCMonth() + 1)} . ${date.getUTCFullYear()}  ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
  }

  function decodeTimestamp(bytes, offset) {
    const a = bytes[offset];
    const b = bytes[offset + 1];
    const c = bytes[offset + 2];
    const d = bytes[offset + 3];
    const unix = ((c << 24) >>> 0) + (d << 16) + (a << 8) + b + IST_OFFSET_SECONDS;
    return new Date(unix * 1000);
  }

  function parseScale(scaleText) {
    const text = String(scaleText || "").trim();
    if (!text) return { scale: null, unit: "" };
    const parts = text.split(/\s+/);
    const scale = Number(parts[0]);
    return { scale: Number.isFinite(scale) ? scale : null, unit: parts.slice(1).join(" ") };
  }

  function formatNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
    if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value));
    return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function buildMaps(dictionary, propulsion) {
    const errors = new Map();
    const errorRows = (dictionary.ddsSets && dictionary.ddsSets[propulsion]) || dictionary.errors || [];
    for (const row of errorRows) {
      const code = Number(row.Error_Info);
      if (!Number.isFinite(code)) continue;
      errors.set(`${row.Processor}|${code}`, row.Error_Text);
      if (row.Processor_hex) {
        errors.set(`${String(row.Processor_hex).toLowerCase()}|${code}`, row.Error_Text);
      }
    }

    const byProcessor = (rows) => {
      const map = new Map();
      for (const row of rows || []) {
        const key = String(row.Processor || "").trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
      }
      return map;
    };

    const globalBits = [...(dictionary.globalBits || [])].sort((a, b) => Number(a.Ref_bit) - Number(b.Ref_bit));
    return {
      errors,
      devices: dictionary.devices || {},
      globalBits,
      globalAnalog: byProcessor(dictionary.globalAnalog),
      procBits: byProcessor(dictionary.procBits),
      procAnalog: byProcessor(dictionary.procAnalog)
    };
  }

  function parseRecord(bytes, index, maps) {
    const base = index * RECORD_SIZE;
    const devAddr = toHex(bytes[base], 2);
    const deviceInfo = maps.devices[devAddr] || {};
    const processor = deviceInfo.display || "";
    const envProcessor = deviceInfo.envProc || processor;
    const envCount = bytes[base + 2];
    const errorCount = bytes[base + 3];
    const date = decodeTimestamp(bytes, base + 8);
    const ticks = wordHex(bytes, base + 12);

    const envWords = [];
    for (let i = 0; i < 24; i += 1) {
      const offset = base + 14 + i * 2;
      envWords.push(i < envCount && offset + 1 < base + RECORD_SIZE ? wordHex(bytes, offset) : " ");
    }

    const errorOffset = base + 14 + 2 * envCount;
    const errors = [];
    for (let i = 0; i < 16; i += 1) {
      const offset = errorOffset + i * 4;
      if (i < errorCount && offset + 3 < base + RECORD_SIZE) {
        const info1 = bytes[offset];
        const info2 = bytes[offset + 1];
        const info3 = bytes[offset + 2];
        const info4 = bytes[offset + 3];
        const text = maps.errors.get(`${processor}|${info2}`) || maps.errors.get(`${devAddr}|${info2}`) || `DDS Undefined - ${String(info2).padStart(4, "0")}`;
        errors.push({ index: i + 1, info1, info2, info3, info4, text, defined: !text.startsWith("DDS Undefined") });
      } else {
        errors.push({ index: i + 1, info1: " ", info2: " ", info3: " ", info4: " ", text: " ", defined: false });
      }
    }

    return {
      slNo: index,
      devAddr,
      processor,
      envProcessor,
      envCount,
      errorCount,
      date,
      dateText: formatDate(date),
      ticks,
      envWords,
      errors
    };
  }

  function parseLog(arrayBuffer, dictionary, propulsion = "CGL") {
    const bytes = new Uint8Array(arrayBuffer);
    const maps = buildMaps(dictionary, propulsion);
    const count = Math.floor(bytes.byteLength / RECORD_SIZE);
    const records = [];
    const faults = [];

    for (let i = 0; i < count; i += 1) {
      const record = parseRecord(bytes, i, maps);
      records.push(record);
      for (const err of record.errors) {
        if (err.text === " ") continue;
        faults.push({
          id: `${record.slNo}:${err.index}`,
          record,
          faultIndex: err.index,
          info1: toHex(err.info1),
          codeHex: toHex(err.info2),
          info3: toHex(err.info3),
          info4: toHex(err.info4),
          faultText: err.text,
          defined: err.defined
        });
      }
    }

    faults.sort((a, b) => b.record.date - a.record.date || b.record.slNo - a.record.slNo || a.faultIndex - b.faultIndex);
    return { records, faults, maps, propulsion };
  }

  function decodeAnalogValue(raw, meta, processor) {
    if (raw === null || raw === undefined) return " ";
    const type = String(meta.Data_Type || "").trim();
    if (type === "Analog") {
      const { scale, unit } = parseScale(meta.Percentage_value);
      let value = raw;
      if (scale !== null && SLG_BUR_PROCESSORS.has(processor)) {
        value = Math.round((raw * scale / 4096) * 100) / 100;
      } else if (meta.ProcessValue === "Primary Voltage" || meta.ProcessValue === "Braking Pressure") {
        value = raw / 10;
      }
      return `${formatNumber(value)}${unit ? ` ${unit}` : ""}`.trim();
    }
    if (type === "Integer") return String(raw);
    if (type === "Hex") return toHex(raw & 0xffff, 4);
    return String(raw);
  }

  function envRows(record, maps) {
    const env = record.envWords;
    const flags = [
      ...binaryFlags(env[0]),
      ...binaryFlags(env[1]),
      ...binaryFlags(env[2])
    ];
    const analogRaw = env.slice(3, 24).map(signed16);
    const proc = record.envProcessor;
    const rows = {
      globalDigital: [],
      processorDigital: [],
      globalAnalog: [],
      processorAnalog: []
    };

    maps.globalBits.forEach((meta, i) => {
      rows.globalDigital.push({
        process: meta.ProcessValue || "",
        signal: meta.SignalName || "",
        raw: i < 16 ? env[0] : env[1],
        value: flags[i],
        word: i < 16 ? 1 : 2,
        bit: meta.Bit || ""
      });
    });

    const procBits = [...(maps.procBits.get(proc) || [])].sort((a, b) => Number(a.Bit) - Number(b.Bit));
    procBits.forEach((meta) => {
      const bitIndex = Number(meta.Bit) - 1;
      rows.processorDigital.push({
        process: meta.ProcessValue || "",
        signal: meta.SignalName || "",
        raw: env[2],
        value: bitIndex >= 0 && bitIndex < 16 ? flags[32 + bitIndex] : "",
        word: 3,
        bit: meta.Bit || ""
      });
    });

    const addAnalogRows = (target, sourceRows) => {
      [...sourceRows]
        .filter((meta) => String(meta.Word || "").trim() !== "")
        .sort((a, b) => Number(a.Word) - Number(b.Word))
        .forEach((meta) => {
          const word = Number(meta.Word);
          const raw = word >= 4 && word <= 24 ? analogRaw[word - 4] : null;
          target.push({
            process: meta.ProcessValue || "",
            signal: meta.SignalName || "",
            raw: word >= 1 && word <= 24 ? env[word - 1] : "",
            rawSigned: raw,
            value: decodeAnalogValue(raw, meta, proc),
            word,
            bit: "",
            kind: meta.Data_Type || ""
          });
        });
    };

    addAnalogRows(rows.globalAnalog, maps.globalAnalog.get(proc) || []);
    addAnalogRows(rows.processorAnalog, maps.procAnalog.get(proc) || []);
    return rows;
  }

  function longEnvironmentRows(fault, maps) {
    const groups = envRows(fault.record, maps);
    const base = {
      SL_No: fault.record.slNo,
      DateTime: fault.record.dateText,
      Device_Addr: fault.record.devAddr,
      Processor: fault.record.processor,
      Env_Processor: fault.record.envProcessor,
      Fault_Index: fault.faultIndex,
      Fault_Status_Info1: fault.info1,
      Fault_Code_Hex: fault.codeHex,
      Fault_Text: fault.faultText
    };

    const rows = [];
    const push = (scope, kind, row) => rows.push({
      ...base,
      Scope: scope,
      Kind: kind || row.kind || "Digital",
      Word: row.word,
      Bit: row.bit,
      ProcessValue: row.process,
      SignalName: row.signal,
      Raw_Env: row.raw,
      Raw_Signed: row.rawSigned ?? "",
      Decoded_Value: row.value
    });
    groups.globalDigital.forEach((row) => push("Global", "Digital", row));
    groups.processorDigital.forEach((row) => push("Processor", "Digital", row));
    groups.globalAnalog.forEach((row) => push("Global", row.kind, row));
    groups.processorAnalog.forEach((row) => push("Processor", row.kind, row));
    return rows;
  }

  root.VCUDecoder = {
    parseLog,
    envRows,
    longEnvironmentRows,
    formatDate
  };

  if (typeof module !== "undefined") {
    module.exports = root.VCUDecoder;
  }
})(typeof window !== "undefined" ? window : globalThis);
