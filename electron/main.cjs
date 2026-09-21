const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fsSync = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs/promises");
const { parseCsvLine, parseTextLine, calcularQualidadeVOC, calcularVocPpm, resetThermocoupleMemory } = require("./lib/parsers.cjs");
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  autoUpdater = null;
}

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let autoUpdateCheckTimer = null;

function formatBytes(bytes) {
  try {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = n;
    let unitIdx = 0;
    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx += 1;
    }
    return `${size.toFixed(size < 10 && unitIdx > 0 ? 2 : 1)} ${units[unitIdx]}`;
  } catch {
    return "0 B";
  }
}

if (isDev || process.env.ELECTRON_LOCAL_DATA) {
  const localDataRoot = path.join(__dirname, "..", ".electron-temp");
  const userDataDir = path.join(localDataRoot, "userData");
  const cacheDir = path.join(localDataRoot, "cache");
  fsSync.mkdirSync(userDataDir, { recursive: true });
  fsSync.mkdirSync(cacheDir, { recursive: true });
  app.setPath("userData", userDataDir);
  app.setPath("cache", cacheDir);
}

function readArgValue(name) {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => typeof a === "string" && a.startsWith(pref));
  if (!hit) return null;
  const val = hit.slice(pref.length).trim();
  return val ? val : null;
}

function getPreferredSerialPath() {
  const fromEnv = String(process.env.ARDUINO_PORT || "").trim();
  if (fromEnv) return fromEnv;
  return readArgValue("serialPort") || readArgValue("com") || readArgValue("port");
}

function getPreferredBaudRate() {
  const fromEnv = String(process.env.ARDUINO_BAUD || "").trim();
  const fromArg = readArgValue("baud") || readArgValue("baudRate");
  const raw = fromEnv || fromArg || "";
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 300 && n <= 2000000) return n;
  return 9600;
}

let serialDepsPromise = null;
async function loadSerialDeps() {
  if (!serialDepsPromise) {
    serialDepsPromise = Promise.all([import("serialport"), import("@serialport/parser-readline")]).then(
      ([sp, pr]) => {
        const SerialPort = sp.SerialPort || (sp.default && sp.default.SerialPort);
        const ReadlineParser = pr.ReadlineParser || (pr.default && pr.default.ReadlineParser);
        if (!SerialPort || !ReadlineParser) throw new Error("Falha ao carregar dependências de serial");
        return { SerialPort, ReadlineParser };
      }
    );
  }
  return serialDepsPromise;
}

function createIoServer() {
  const httpServer = http.createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  return new Promise((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 4317;
      const socketUrl = `http://127.0.0.1:${port}`;
      resolve({ io, httpServer, socketUrl });
    });
  });
}

async function pickArduinoPort(preferredPath) {
  const { SerialPort } = await loadSerialDeps();
  const ports = await SerialPort.list();
  if (!ports.length) return null;

  if (preferredPath) {
    const wanted = preferredPath.toLowerCase();
    const direct = ports.find((p) => String(p.path || "").toLowerCase() === wanted);
    if (direct) return direct;
    const byCom = ports.find((p) => {
      const pp = String(p.path || "").toLowerCase();
      return pp.endsWith(wanted) || pp.includes(wanted);
    });
    if (byCom) return byCom;
    return null;
  }

  const scored = ports
    .map((p) => {
      const man = (p.manufacturer || "").toLowerCase();
      const vid = (p.vendorId || "").toLowerCase();
      const pid = (p.productId || "").toLowerCase();
      let score = 0;
      if (man.includes("arduino")) score += 100;
      if (man.includes("wch") || man.includes("ch340")) score += 40;
      if (man.includes("silicon labs") || man.includes("cp210")) score += 35;
      if (vid === "2341" || vid === "2a03") score += 90;
      if (vid === "1a86") score += 45;
      if (vid === "10c4") score += 40;
      if (p.path && (p.path.toLowerCase().includes("usb") || p.path.toLowerCase().includes("com")))
        score += 10;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.p ?? null;
}

function getSessionBaseDir() {
  try {
    const dir = path.join(app.getPath("userData"), "Sessions");
    fsSync.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    try {
      const dir = path.join(__dirname, "..", ".electron-temp", "Sessions");
      fsSync.mkdirSync(dir, { recursive: true });
      return dir;
    } catch {
      return null;
    }
  }
}

function yyyymmddCompact(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function getCsvHeaders(semicolon = true) {
  const sep = semicolon ? ";" : ",";
  return [
    "Data",
    "Hora",
    "Termopar 1",
    "Termopar 2",
    "Termopar 3",
    "Temperatura Ambiente",
    "Umidade",
    "Pressão",
    "PPM"
  ].join(sep);
}

function formatCsvRow(r, semicolon = true) {
  const sep = semicolon ? ";" : ",";
  const fmtNum = (x) => {
    if (x === null || x === undefined || typeof x !== "number" || !Number.isFinite(x)) return "";
    return String(x);
  };
  const dt = new Date(r.ts);
  const ppm = (typeof r.vocPpm === "number" && Number.isFinite(r.vocPpm)) ? r.vocPpm : calcularVocPpm(r.voc);
  return [
    dt.toLocaleDateString("pt-BR"),
    dt.toLocaleTimeString("pt-BR"),
    fmtNum(r.t1),
    fmtNum(r.t2),
    fmtNum(r.t3),
    fmtNum(r.temp),
    fmtNum(r.hum),
    fmtNum(r.pressure),
    fmtNum(ppm)
  ].join(sep);
}

function getBackupCsvHeaders(semicolon = true) {
  const sep = semicolon ? ";" : ",";
  return [
    "Data",
    "Hora",
    "Termopar 1",
    "Termopar 2",
    "Termopar 3",
    "Temperatura Ambiente",
    "Umidade",
    "Pressão",
    "VOC (kΩ)",
    "PPM"
  ].join(sep);
}

function formatBackupCsvRow(r, semicolon = true) {
  const sep = semicolon ? ";" : ",";
  const fmtNum = (x) => {
    if (x === null || x === undefined || typeof x !== "number" || !Number.isFinite(x)) return "";
    return String(x);
  };
  const dt = new Date(r.ts);
  const ppm = (typeof r.vocPpm === "number" && Number.isFinite(r.vocPpm)) ? r.vocPpm : calcularVocPpm(r.voc);
  return [
    dt.toLocaleDateString("pt-BR"),
    dt.toLocaleTimeString("pt-BR"),
    fmtNum(r.t1),
    fmtNum(r.t2),
    fmtNum(r.t3),
    fmtNum(r.temp),
    fmtNum(r.hum),
    fmtNum(r.pressure),
    fmtNum(r.voc),
    fmtNum(ppm)
  ].join(sep);
}

function buildSessionCsv(rows, options = {}) {
  const { includeHeader = true, semicolon = true } = options;
  const lines = [];
  if (includeHeader) lines.push(getCsvHeaders(semicolon));
  for (const r of rows) {
    lines.push(formatCsvRow(r, semicolon));
  }
  return lines.join("\r\n");
}

function awaitStreamFinish(stream) {
  return new Promise((resolve, reject) => {
    stream.once("error", reject);
    stream.once("finish", () => resolve());
  });
}

function awaitDrain(stream) {
  return new Promise((resolve) => {
    if (stream.writableNeedDrain === false || !stream.writableNeedDrain) {
      resolve();
      return;
    }
    stream.once("drain", () => resolve());
  });
}

async function writeCsvStream(filePath, rows, options = {}) {
  const {
    includeHeader = true,
    semicolon = true,
    bom = true,
    chunkSize = 2000,
    format = "export"
  } = options;
  if (!filePath || !rows || !Array.isArray(rows)) throw new Error("Parâmetros inválidos para writeCsvStream");
  const total = rows.length;
  const writeStream = fsSync.createWriteStream(filePath, { encoding: "utf8" });
  const headerFn = format === "backup" ? getBackupCsvHeaders : getCsvHeaders;
  const rowFn = format === "backup" ? formatBackupCsvRow : formatCsvRow;
  try {
    if (bom) {
      const wroteBom = writeStream.write("\uFEFF");
      if (!wroteBom) await awaitDrain(writeStream);
    }
    const header = (includeHeader ? headerFn(semicolon) : "") + "\r\n";
    if (includeHeader) {
      const ok = writeStream.write(header);
      if (!ok) await awaitDrain(writeStream);
    }
    for (let i = 0; i < total; i += chunkSize) {
      const end = Math.min(i + chunkSize, total);
      let block = "";
      for (let j = i; j < end; j++) {
        const r = rows[j];
        block += rowFn(r, semicolon);
        block += "\r\n";
      }
      const ok = writeStream.write(block);
      block = "";
      if (!ok) await awaitDrain(writeStream);
      if ((i & 16383) === 0) {
        await new Promise((res) => setImmediate(res));
      }
    }
    writeStream.end();
    await awaitStreamFinish(writeStream);
  } catch (e) {
    try { writeStream.destroy(); } catch {}
    throw e;
  }
  return total;
}

function sanitizeError(e) {
  const err = e instanceof Error ? e : new Error(String(e == null ? "erro desconhecido" : e));
  let code = "";
  try {
    if (err && typeof (err).code === "string") code = (err).code;
  } catch {}
  const msg = String(err.message || String(e || "erro desconhecido"));
  if (code === "EPERM" || code === "EACCES" || /OneDrive|perm/i.test(msg)) {
    return new Error(`Permissão negada ao salvar (${code || "EPERM"}). Verifique se a pasta (OneDrive/Documentos) não está sincronizando bloqueada ou protegida, e escolha outro local como Área de Trabalho.`);
  }
  if (code === "EBUSY" || code === "ETXTBSY" || /está sendo usado|being used/i.test(msg)) {
    return new Error(`O arquivo está aberto em outro programa (${code || "EBUSY"}). Feche o arquivo no Excel/Editor e tente novamente.`);
  }
  if (code === "ENOSPC") {
    return new Error(`Espaço insuficiente em disco (${code}).`);
  }
  if (code === "EISDIR") {
    return new Error(`Caminho inválido (${code}) — não é possível gravar em uma pasta sem nome de arquivo.`);
  }
  return new Error(`${msg}${code ? ` (código ${code})` : ""}`);
}


function createSerialBridge(io) {
  let currentPort = null;
  let lastStatus = { connected: false, collecting: true, manualDisconnect: false, sessionRows: 0 };
  let scanning = false;
  let scanTimer = null;
  let preferredPath = getPreferredSerialPath();
  const baudRate = getPreferredBaudRate();
  let lastInvalidNotifyTs = 0;
  let textFrame = null;
  let textFrameTouched = false;

  let manualDisconnect = false;
  let collecting = true;

  const sessionDir = getSessionBaseDir();
  const sessionJsonlPath = sessionDir ? path.join(sessionDir, `sess_${yyyymmddCompact()}.jsonl`) : null;
  let jsonlFd = null;
  try {
    if (sessionJsonlPath) {
      jsonlFd = fsSync.openSync(sessionJsonlPath, "a");
    }
  } catch {
    jsonlFd = null;
  }
  let lastFinalBackupPath = null;

  const lastGood = {
    t1: null,
    t2: null,
    t3: null,
    temp: null,
    hum: null,
    pressure: null,
    voc: null,
    vocPpm: null
  };
  let sessionHistory = [];

  function appendJsonl(row) {
    if (!jsonlFd || !row) return;
    try {
      fsSync.writeSync(jsonlFd, JSON.stringify(row) + "\n");
    } catch {
    }
  }

  function emitStatus(next) {
    lastStatus = { ...lastStatus, ...next, sessionRows: sessionHistory.length, collecting, manualDisconnect };
    io.emit("status", lastStatus);
  }

  function sessionHistoryPush(row) {
    if (!collecting) return;
    sessionHistory.push(row);
    appendJsonl(row);
    if (sessionHistory.length % 25 === 0) {
      io.emit("status", { ...lastStatus, sessionRows: sessionHistory.length, collecting, manualDisconnect });
    }
  }

  function getSessionHistory() {
    return sessionHistory.slice();
  }

  function emitSensorSnapshot({ ts, raw, patch, legacy }) {
    const allowed = new Set(["t1", "t2", "t3", "temp", "hum", "pressure", "voc"]);
    if (patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (!allowed.has(k)) continue;
        if (typeof v === "number" && Number.isFinite(v)) {
          lastGood[k] = v;
        } else if (v === null) {
        }
      }
    }
    lastGood.vocPpm = calcularVocPpm(lastGood.voc);
    const payload = {
      t1: lastGood.t1,
      t2: lastGood.t2,
      t3: lastGood.t3,
      temp: lastGood.temp,
      hum: lastGood.hum,
      pressure: lastGood.pressure,
      voc: lastGood.voc,
      vocPpm: lastGood.vocPpm,
      raw:
        raw ||
        [lastGood.t1, lastGood.t2, lastGood.t3, lastGood.temp, lastGood.hum, lastGood.pressure, lastGood.voc]
          .map((x) => (typeof x === "number" ? String(x) : ""))
          .join(","),
      ts,
      legacy: Boolean(legacy || false)
    };
    sessionHistoryPush(payload);
    io.emit("sensor", payload);
  }

  function resetTextFrame() {
    textFrame = {};
    textFrameTouched = false;
  }

  function finalizeTextFrame(ts) {
    if (!textFrame || !textFrameTouched) return false;
    emitSensorSnapshot({ ts, patch: textFrame });
    resetTextFrame();
    return true;
  }

  async function closeCurrent() {
    if (!currentPort) return;
    try {
      currentPort.removeAllListeners();
      if (currentPort.isOpen) {
        await new Promise((res) => currentPort.close(() => res()));
      }
    } catch {
    } finally {
      currentPort = null;
      resetThermocoupleMemory();
    }
  }

  async function connectOnce() {
    const { SerialPort, ReadlineParser } = await loadSerialDeps();
    if (!preferredPath) {
      emitStatus({
        connected: false,
        portPath: undefined,
        manufacturer: undefined,
        error: "Selecione uma porta serial (COM) na lista",
        lastSeenTs: Date.now()
      });
      return false;
    }

    const picked = await pickArduinoPort(preferredPath) || { path: preferredPath, manufacturer: "manual" };
    if (!picked || !picked.path) {
      const msg = preferredPath
        ? `Porta serial não encontrada: ${preferredPath}`
        : "Arduino não encontrado";
      emitStatus({ connected: false, portPath: preferredPath || undefined, manufacturer: undefined, error: msg });
      return false;
    }

    const port = new SerialPort({
      path: picked.path,
      baudRate,
      autoOpen: false
    });

    await new Promise((resolve, reject) => {
      port.open((err) => (err ? reject(err) : resolve()));
    });

    currentPort = port;
    manualDisconnect = false;
    emitStatus({
      connected: true,
      portPath: picked.path,
      manufacturer: picked.manufacturer,
      baudRate,
      error: undefined,
      lastSeenTs: Date.now()
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: "\n", encoding: "utf8" }));

    parser.on("data", (line) => {
      const ts = Date.now();
      const raw = String(line ?? "").trim();
      let didParse = false;

      const parsedCsv = parseCsvLine(line);
      if (parsedCsv) {
        didParse = true;
        emitStatus({ connected: true, error: undefined, lastSeenTs: ts });
        io.emit("serialLine", { ts, raw, parsed: true });
        emitSensorSnapshot({ ts, raw: parsedCsv.raw, patch: parsedCsv.patch, legacy: parsedCsv.legacy });
        return;
      }

      const parsedText = parseTextLine(raw);
      const recognizedText = Boolean(parsedText);
      if (parsedText?.kind === "startFrame") {
        resetTextFrame();
      } else if (parsedText?.kind === "endFrame") {
        didParse = finalizeTextFrame(ts);
      } else if (parsedText?.kind === "value") {
        if (!textFrame) resetTextFrame();
        const patch = parsedText.patch || {};
        for (const v of Object.values(patch)) {
          if (Number.isFinite(v)) {
            textFrameTouched = true;
            break;
          }
        }
        Object.assign(textFrame, patch);
      }

      io.emit("serialLine", { ts, raw, parsed: didParse });
      if (recognizedText) {
        emitStatus({ connected: true, error: didParse ? undefined : lastStatus.error, lastSeenTs: ts });
        return;
      }
      if (!didParse) {
        if (ts - lastInvalidNotifyTs > 2000) {
          lastInvalidNotifyTs = ts;
          emitStatus({ connected: true, error: "Dados recebidos, mas o formato está inválido", lastSeenTs: ts });
        } else {
          emitStatus({ connected: true, lastSeenTs: ts });
        }
        return;
      }

      emitStatus({ connected: true, error: undefined, lastSeenTs: ts });
    });

    port.on("error", (err) => {
      emitStatus({ connected: false, error: err?.message || "Erro serial" });
    });

    port.on("close", () => {
      const wasManual = manualDisconnect;
      emitStatus({ connected: false, error: wasManual ? "Desconectado pelo usuário" : "Conexão serial encerrada" });
      resetThermocoupleMemory();
      if (!wasManual) {
        scheduleScan(800);
      }
    });

    return true;
  }

  async function scanLoop() {
    if (manualDisconnect) return;
    if (scanning) return;
    scanning = true;
    try {
      await closeCurrent();
      await connectOnce();
    } catch (e) {
      emitStatus({ connected: false, error: e?.message || String(e) });
      if (!manualDisconnect) scheduleScan(1200);
    } finally {
      scanning = false;
    }
  }

  function scheduleScan(delayMs) {
    if (manualDisconnect) return;
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanLoop();
    }, delayMs);
  }

  function setPreferredPath(nextPath) {
    preferredPath = String(nextPath || "").trim() || null;
    manualDisconnect = false;
    emitStatus({ connected: false, portPath: preferredPath || undefined });
    scheduleScan(0);
  }

  function setCollecting(next) {
    const wasCollecting = collecting;
    collecting = Boolean(next);
    emitStatus({});
    if (wasCollecting && !collecting) {
      runFinalBackupIfNeeded("pausa").catch(() => {});
    }
  }

  async function manualDisconnectNow() {
    manualDisconnect = true;
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    await closeCurrent();
    emitStatus({});
  }

  function manualConnectNow() {
    manualDisconnect = false;
    emitStatus({});
    scheduleScan(0);
  }

  async function runFinalBackupIfNeeded(reason) {
    try {
      const baseDir = getBackupBaseDir();
      if (!baseDir || sessionHistory.length === 0) return null;
      const prefix = reason === "pausa" ? "pausa" : "fim";
      let target = null;
      if (reason !== "pausa" && lastFinalBackupPath) {
        target = lastFinalBackupPath;
      }
      const written = await writeBackupFile(baseDir, prefix, sessionHistory, {
        allowOverwriteOld: reason !== "pausa",
        overwriteTargetPath: target
      });
      if (written && reason !== "pausa") {
        lastFinalBackupPath = written;
      }
      return written;
    } catch {
      return null;
    }
  }

  function start() {
    scanLoop();
    const periodic = setInterval(() => {
      if (manualDisconnect) return;
      if (currentPort && currentPort.isOpen) return;
      scheduleScan(0);
    }, 2500);

    return async () => {
      clearInterval(periodic);
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = null;
      try {
        await runFinalBackupIfNeeded("fim");
      } catch {}
      try {
        if (jsonlFd !== null) {
          fsSync.closeSync(jsonlFd);
          jsonlFd = null;
        }
      } catch {}
      await closeCurrent();
    };
  }

  return {
    start,
    getStatus: () => ({ ...lastStatus, sessionRows: sessionHistory.length, collecting, manualDisconnect }),
    setPreferredPath,
    getSessionHistory,
    clearSessionHistory: () => {
      sessionHistory = [];
      emitStatus({});
    },
    manualDisconnectNow,
    manualConnectNow,
    setCollecting,
    runFinalBackupIfNeeded,
    getSessionJsonlPath: () => sessionJsonlPath,
    getSessionInfo: () => ({
      rows: sessionHistory.length,
      collecting,
      manualDisconnect,
      sessionJsonlPath,
      startedAt: sessionHistory[0]?.ts ?? null
    })
  };
}

function yyyymmdd(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hhmmss(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function getBackupBaseDir() {
  const fallbacks = [];
  try {
    fallbacks.push(path.join(app.getPath("userData"), "Backups"));
  } catch {}
  try {
    fallbacks.push(path.join(app.getPath("documents"), "Dashboard Arduino", "Backups"));
  } catch {}
  for (const p of fallbacks) {
    try {
      fsSync.mkdirSync(path.dirname(p), { recursive: true });
      fsSync.mkdirSync(p, { recursive: true });
      if (fsSync.existsSync(p)) return p;
    } catch {}
  }
  return null;
}

async function writeBackupFile(baseDir, prefix, rows, { allowOverwriteOld = true, overwriteTargetPath = null } = {}) {
  if (!baseDir || !rows || !rows.length) return null;
  const dayDir = path.join(baseDir, yyyymmdd());
  await fs.mkdir(dayDir, { recursive: true });
  let targetPath = overwriteTargetPath;
  if (!targetPath) targetPath = path.join(dayDir, `${prefix}_${yyyymmdd()}_${hhmmss()}.csv`);
  let finalPath = targetPath;
  let tries = 0;
  do {
    const tmp = path.join(dayDir, `.tmp_${prefix}_${process.pid}_${Date.now()}_${tries}.csv`);
    try {
      const written = await writeCsvStream(tmp, rows, { includeHeader: true, semicolon: true, bom: true, chunkSize: 2000, format: "backup" });
      if (written !== rows.length) throw new Error(`writeBackupFile wrote ${written}, expected ${rows.length}`);
      try {
        await fs.rename(tmp, finalPath);
        return finalPath;
      } catch {
        try {
          await fs.copyFile(tmp, finalPath);
          try { await fs.rm(tmp, { force: true, maxRetries: 1 }); } catch {}
          return finalPath;
        } catch {
        }
      }
    } catch (e) {
      try { await fs.rm(tmp, { force: true, maxRetries: 2 }); } catch {}
      if (tries >= 4) {
        throw e;
      }
    }
    tries++;
    if (!allowOverwriteOld) {
      finalPath = path.join(
        dayDir,
        `${prefix}_${yyyymmdd()}_${hhmmss()}_${process.pid}_${tries}_${Date.now()}.csv`
      );
    }
  } while (tries < 5);
  return null;
}

async function createMainWindow({ socketUrl }) {
  try {
    if (Menu && typeof Menu.setApplicationMenu === "function") {
      Menu.setApplicationMenu(null);
    }
  } catch {}
  const win = new BrowserWindow({
    icon: getWindowIconPath(),
    title: "Eva - Dashboard",
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#ffffff",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    menuBarVisible: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--socketUrl=${socketUrl}`, `--appVersion=${app.getVersion()}`],
      devTools: !app.isPackaged
    }
  });
  try {
    win.removeMenu();
  } catch {}

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (app.isPackaged) {
    try {
      win.webContents.on("devtools-opened", () => {
        try { win.webContents.closeDevTools(); } catch {}
      });
      win.webContents.on("before-input-event", (_e, input) => {
        const key = (input.key || "").toLowerCase();
        const f12 = input.key === "F12";
        const ctrlShiftI = (input.control || input.meta) && input.shift && key === "i";
        const ctrlShiftJ = (input.control || input.meta) && input.shift && key === "j";
        const ctrlShiftC = (input.control || input.meta) && input.shift && key === "c";
        if (f12 || ctrlShiftI || ctrlShiftJ || ctrlShiftC) {
          try { win.webContents.closeDevTools(); } catch {}
        }
      });
    } catch {}
  }

  return win;
}

let disposeSerial = null;
let serialBridgeRef = null;

function getWindowIconPath() {
  const candidates = [
    path.join(__dirname, "..", "build", "Logo_web-site.png"),
    path.join(__dirname, "..", "build", "icon.png")
  ];
  for (const p of candidates) {
    if (fsSync.existsSync(p)) return p;
  }
  return undefined;
}

function configureAutoUpdater() {
  if (!autoUpdater) {
    console.log("[Auto-Update] Desativado: módulo electron-updater indisponível (falha no require).");
    return;
  }
  if (!app.isPackaged) {
    console.log("[Auto-Update] Desativado: MODO DESENVOLVIMENTO (app.isPackaged=false). Para testar atualizações, build e execute o .exe final (build:win).");
    return;
  }
  if (process.platform !== "win32") {
    console.log(`[Auto-Update] Desativado: plataforma não suportada (${process.platform}). Apenas Windows x64.`);
    return;
  }

  try {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
  } catch {
    return;
  }

  const getMainWindow = () => {
    try {
      const list = BrowserWindow ? BrowserWindow.getAllWindows() : [];
      if (!list || list.length === 0) return null;
      return list[0];
    } catch {
      return null;
    }
  };

  autoUpdater.on("error", (error) => {
    const errMsg =
      error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : String(error || "Erro desconhecido");
    console.error("[Auto-Update] Falha:", errMsg);
  });

  autoUpdater.on("checking-for-update", () => {
    console.log(`[Auto-Update] Verificando atualizações no GitHub Eva-ltda/PAT (versão atual: ${app.getVersion()})…`);
  });

  autoUpdater.on("update-not-available", () => {
    console.log(`[Auto-Update] Sem atualizações. Versão atual ${app.getVersion()} já é a mais recente.`);
  });

  autoUpdater.on("update-available", (info) => {
    const current = app.getVersion();
    let next = "";
    if (info) {
      if (typeof info.version === "string") next = info.version;
      else if (info.updateInfo && typeof info.updateInfo.version === "string")
        next = info.updateInfo.version;
    }
    const nextOrDash = next || "—";
    const win = getMainWindow();
    const opts = {
      type: "question",
      title: "Atualização disponível",
      message: "Há uma nova versão do Dashboard Arduino.",
      detail: `Versão atual: ${current}\nNova versão: ${nextOrDash}\n\nDeseja baixar e instalar agora?`,
      buttons: ["Sim", "Não"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    };
    const onAnswer = ({ response }) => {
      if (response === 0) {
        try {
          autoUpdater.downloadUpdate().catch((err) => {
            const msg = err && err.message ? err.message : String(err || "erro");
            console.error("Falha ao baixar atualização:", msg);
          });
        } catch (e) {
          const msg = e && e.message ? e.message : String(e || "erro");
          console.error("Falha ao disparar download de atualização:", msg);
        }
      }
    };
    if (win) {
      dialog.showMessageBox(win, opts).then(onAnswer).catch(() => {});
    } else {
      dialog.showMessageBox(opts).then(onAnswer).catch(() => {});
    }
  });

  autoUpdater.on("download-progress", (progress) => {
    try {
      const pct = progress && typeof progress.percent === "number" ? progress.percent : NaN;
      const total = progress && typeof progress.total === "number" ? progress.total : 0;
      const transferred =
        progress && typeof progress.transferred === "number" ? progress.transferred : 0;
      if (!Number.isNaN(pct)) {
        console.log(
          `[Auto-Update] Progresso: ${pct.toFixed(1)}%  (${formatBytes(transferred)} / ${formatBytes(total)})`
        );
      } else if (total > 0) {
        console.log(
          `[Auto-Update] Baixando: ${formatBytes(transferred)} / ${formatBytes(total)}`
        );
      }
    } catch {}
  });

  autoUpdater.on("update-downloaded", (info) => {
    try {
      const next =
        (info && typeof info.version === "string")
          ? info.version
          : (info && info.updateInfo && typeof info.updateInfo.version === "string")
            ? info.updateInfo.version
            : "—";
      console.log(`[Auto-Update] Nova versão ${next} baixada. Aguardando reinício.`);
    } catch {}
    const win = getMainWindow();
    let next = "";
    if (info) {
      if (typeof info.version === "string") next = info.version;
      else if (info.updateInfo && typeof info.updateInfo.version === "string")
        next = info.updateInfo.version;
    }
    const nextOrDash = next || "—";
    const opts = {
      type: "question",
      title: "Atualização pronta",
      message: "A nova versão do Dashboard Arduino já foi baixada.",
      detail: `Nova versão: ${nextOrDash}\n\nClique em Reiniciar agora para aplicar. A instalação é automática após o fechamento.`,
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    };
    const onAnswer = ({ response }) => {
      if (response === 0) {
        try {
          autoUpdater.quitAndInstall();
        } catch {}
      }
    };
    if (win) {
      dialog.showMessageBox(win, opts).then(onAnswer).catch(() => {});
    } else {
      dialog.showMessageBox(opts).then(onAnswer).catch(() => {});
    }
  });

  const checkForUpdates = () => {
    try {
      console.log(`[Auto-Update] checkForUpdates() disparado (v${app.getVersion()}).`);
      autoUpdater.checkForUpdates()
        .then((result) => {
          try {
            const has =
              !!(
                result &&
                typeof result.updateInfo === "object" &&
                result.updateInfo.version
              );
            const nextV = has ? result.updateInfo.version : "-";
            console.log(`[Auto-Update] checkForUpdates() OK. Próxima versão detectada: ${nextV}.`);
          } catch {}
        })
        .catch((error) => {
          const msg = error && error.message ? error.message : String(error || "erro");
          console.error("[Auto-Update] Falha ao verificar atualizações:", msg);
        });
    } catch {}
  };

  checkForUpdates();
  if (!autoUpdateCheckTimer) {
    autoUpdateCheckTimer = setInterval(checkForUpdates, 10 * 60 * 1000);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.whenReady().then(async () => {
  const { io, socketUrl } = await createIoServer();
  const serial = createSerialBridge(io);
  serialBridgeRef = serial;
  disposeSerial = await serial.start();

  try {
    const baseDir = getBackupBaseDir();
    if (baseDir) {
      try {
        const rowsAtStart = serial.getSessionHistory ? serial.getSessionHistory() : [];
        if (rowsAtStart && rowsAtStart.length > 0) {
          try {
            await writeBackupFile(baseDir, "inicio", rowsAtStart, { allowOverwriteOld: false });
          } catch (e) {
            console.warn("backup inicio não gravado:", e?.message || String(e));
          }
        }
      } catch {}
    }
  } catch {}

  ipcMain.handle("dashboard:getStatus", () => serial.getStatus());
  ipcMain.handle("dashboard:getSessionInfo", () => serial.getSessionInfo());
  ipcMain.handle("dashboard:checkAutoUpdateNow", async () => {
    try {
      if (!autoUpdater) return { ok: false, error: "Auto-update indisponível" };
      if (!app.isPackaged) return { ok: false, error: "Modo desenvolvimento (rode o .exe instalado/portable)" };
      console.log(`[Auto-Update] IPC: checkAutoUpdateNow solicitado pela UI (v${app.getVersion()}).`);
      checkForUpdates();
      return { ok: true, startedAt: Date.now(), currentVersion: app.getVersion(), intervalMinutes: 10 };
    } catch (e) {
      const msg = e && typeof e.message === "string" ? e.message : String(e || "erro");
      console.error("[Auto-Update] IPC checkAutoUpdateNow falhou:", msg);
      return { ok: false, error: msg };
    }
  });
  ipcMain.handle("dashboard:listSerialPorts", async () => {
    const { SerialPort } = await loadSerialDeps();
    const ports = await SerialPort.list();
    return ports
      .map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        vendorId: p.vendorId,
        productId: p.productId
      }))
      .sort((a, b) => String(a.path).localeCompare(String(b.path), "pt-BR"));
  });
  ipcMain.handle("dashboard:setSerialPort", async (_event, args) => {
    const portPath = String(args?.portPath || "").trim();
    serial.setPreferredPath(portPath);
    return { ok: true };
  });
  ipcMain.handle("dashboard:serialDisconnectManual", async () => {
    await serial.manualDisconnectNow();
    return { ok: true };
  });
  ipcMain.handle("dashboard:serialConnectManual", async () => {
    serial.manualConnectNow();
    return { ok: true };
  });
  ipcMain.handle("dashboard:setCollecting", async (_event, args) => {
    const collecting = Boolean(args?.collecting);
    serial.setCollecting(collecting);
    return { ok: true, collecting };
  });
  ipcMain.handle("dashboard:exportCsv", async (event, args) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const sessionRows = serial.getSessionHistory ? serial.getSessionHistory() : [];
      const providedRows = Array.isArray(args?.rows) ? args.rows : [];
      const rows = providedRows.length > sessionRows.length ? providedRows : sessionRows;
      if (!rows || rows.length === 0) {
        return { canceled: false, filePath: undefined, rows: 0 };
      }
      const defaultFileName = String(args?.defaultFileName || "").trim() || `Dashboard_Arduino_${yyyymmdd()}_${hhmmss()}.csv`;
      let defaultDir;
      try {
        defaultDir = app.getPath("documents");
      } catch {
        try { defaultDir = app.getPath("desktop"); } catch { defaultDir = app.getPath("userData"); }
      }
      let dialogChoice = null;
      const runDialog = async (initialDirOverride) => {
        const initialDir = initialDirOverride || defaultDir;
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
          title: "Exportar dados para Excel/CSV",
          defaultPath: path.join(initialDir, defaultFileName),
          filters: [{ name: "CSV (Excel)", extensions: ["csv"] }],
          showsTagField: false
        });
        dialogChoice = { canceled, filePath };
      };
      try {
        await runDialog(undefined);
      } catch (e) {
        throw new Error(`Falha ao abrir diálogo de salvar arquivo: ${e?.message || String(e)}`);
      }
      if (dialogChoice?.canceled || !dialogChoice?.filePath) {
        return { canceled: true };
      }
      const filePath = dialogChoice.filePath;
      const targetDir = path.dirname(filePath);
      try { await fs.mkdir(targetDir, { recursive: true }); } catch {}
      const tmp = `${filePath}.tmp.${Date.now()}.csv`;
      try {
        await writeCsvStream(tmp, rows, { includeHeader: true, semicolon: true, bom: true, chunkSize: 2000 });
        try {
          await fs.rename(tmp, filePath);
        } catch (renameErr) {
          try {
            await fs.copyFile(tmp, filePath);
            try { await fs.rm(tmp, { force: true, maxRetries: 2 }); } catch {}
          } catch {
            throw renameErr || new Error("Não foi possível finalizar a gravação do arquivo");
          }
        }
        return { canceled: false, filePath, rows: rows.length };
      } catch (writeErr) {
        try { await fs.rm(tmp, { force: true, maxRetries: 2 }); } catch {}
        const friendly = sanitizeError(writeErr);
        const looksPermission = /EPERM|EACCES|OneDrive|perm/i.test(String(friendly.message) + String(writeErr?.code || ""));
        if (looksPermission) {
          let fallbackDir;
          try { fallbackDir = app.getPath("desktop"); } catch {
            try { fallbackDir = app.getPath("downloads"); } catch {
              try { fallbackDir = app.getPath("temp"); } catch { fallbackDir = undefined; }
            }
          }
          if (fallbackDir && fallbackDir !== defaultDir) {
            try {
              const choice = await dialog.showMessageBox(win, {
                type: "warning",
                title: "Falha ao salvar no local escolhido",
                message: friendly.message,
                detail: `Tentar salvar automaticamente na sua Área de Trabalho?\n\nLocal sugerido: ${fallbackDir}`,
                buttons: ["Salvar na Área de Trabalho", "Cancelar exportação"],
                defaultId: 0,
                cancelId: 1
              });
              if (choice.response === 0) {
                await runDialog(fallbackDir);
                if (dialogChoice?.canceled || !dialogChoice?.filePath) {
                  return { canceled: true };
                }
                const fallbackPath = dialogChoice.filePath;
                const fallbackTmp = `${fallbackPath}.tmp.${Date.now()}.csv`;
                const fallbackDirP = path.dirname(fallbackPath);
                try { await fs.mkdir(fallbackDirP, { recursive: true }); } catch {}
                await writeCsvStream(fallbackTmp, rows, { includeHeader: true, semicolon: true, bom: true, chunkSize: 2000 });
                try {
                  await fs.rename(fallbackTmp, fallbackPath);
                } catch {
                  await fs.copyFile(fallbackTmp, fallbackPath);
                  try { await fs.rm(fallbackTmp, { force: true, maxRetries: 2 }); } catch {}
                }
                return { canceled: false, filePath: fallbackPath, rows: rows.length, note: "saved-to-desktop-fallback" };
              }
            } catch (innerFallbackErr) {
              throw sanitizeError(innerFallbackErr);
            }
          }
        }
        throw friendly;
      }
    } catch (topLevelErr) {
      const friendly = sanitizeError(topLevelErr);
      return { canceled: false, error: friendly.message, rows: 0 };
    }
  });
  ipcMain.handle("dashboard:runBackupManual", async () => {
    try {
      const baseDir = getBackupBaseDir();
      const rows = serial.getSessionHistory ? serial.getSessionHistory() : [];
      const written = await writeBackupFile(baseDir, "manual", rows, { allowOverwriteOld: false });
      return { ok: Boolean(written), path: written || undefined, rows: rows.length, baseDir: baseDir || undefined };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  });
  ipcMain.handle("dashboard:getBackupInfo", async () => {
    const baseDir = getBackupBaseDir();
    const rows = serial.getSessionHistory ? serial.getSessionHistory() : [];
    return { baseDir: baseDir || undefined, rows: rows.length };
  });

  io.on("connection", (socket) => {
    socket.emit("status", serial.getStatus());
  });

  await createMainWindow({ socketUrl });
  configureAutoUpdater();
});

let disposeSerialRan = false;
app.on("before-quit", async () => {
  if (autoUpdateCheckTimer) {
    clearInterval(autoUpdateCheckTimer);
    autoUpdateCheckTimer = null;
  }
  if (disposeSerialRan) return;
  disposeSerialRan = true;

  if (typeof disposeSerial === "function") {
    try { await disposeSerial(); } catch {}
  }
});
