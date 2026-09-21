"use strict";

const TEMP_TC_MAX = 1350;
const TEMP_TC_MIN = -200;
const TEMP_MAX_SALT_C = 200;
const AMB_TEMP_MIN = -40;
const AMB_TEMP_MAX = 125;
const HUM_MIN = 0;
const HUM_MAX = 100;
const PRES_HPA_MIN = 300;
const PRES_HPA_MAX = 1100;
const VOC_KOHM_MIN = 0.05;
const VOC_KOHM_MAX = 5000;

const _lastT = { t1: null, t2: null, t3: null };

function _clampOrNull(x, min, max) {
  if (!Number.isFinite(x)) return null;
  const n = Number(x);
  if (Number.isNaN(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function _noSpike(x, key) {
  if (x === null) return null;
  const prev = _lastT[key];
  if (prev === null || typeof prev !== "number") {
    _lastT[key] = x;
    return x;
  }
  if (Math.abs(x - prev) > TEMP_MAX_SALT_C) {
    return null;
  }
  _lastT[key] = x;
  return x;
}

function resetThermocoupleMemory() {
  _lastT.t1 = null;
  _lastT.t2 = null;
  _lastT.t3 = null;
}

function toFiniteNumberOrNull(v, { treatZeroAsInvalid = false } = {}) {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (v === "NaN") return null;
  if (typeof v === "string") {
    if (v.trim().length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (treatZeroAsInvalid && n === 0) return null;
    return n;
  }
  if (!Number.isFinite(v)) return null;
  const n = Number(v);
  if (treatZeroAsInvalid && n === 0) return null;
  return n;
}

function thermocoupleOrNull(x, key) {
  const n = toFiniteNumberOrNull(x);
  if (n === null) {
    if (key) _lastT[key] = null;
    return null;
  }
  const faixa = _clampOrNull(n, TEMP_TC_MIN, TEMP_TC_MAX);
  if (faixa === null) {
    if (key) _lastT[key] = null;
    return null;
  }
  if (!key) return faixa;
  return _noSpike(faixa, key);
}

function isThermocoupleValid(x) {
  if (!Number.isFinite(x)) return false;
  if (typeof x !== "number") return false;
  if (Number.isNaN(x)) return false;
  if (x < TEMP_TC_MIN || x > TEMP_TC_MAX) return false;
  return true;
}

function parseCsvLine(line) {
  const raw = String(line ?? "").trim();
  if (!raw.length) return null;
  const tokens = raw.split(",").map((s) => s.trim());
  if (tokens.length === 0) return null;

  const toNum = (tk) => (tk.length === 0 ? null : toFiniteNumberOrNull(tk));
  const nums = tokens.map(toNum);

  if (tokens.length === 7) {
    const [t1, t2, t3, temp, hum, pressure, voc] = nums;
    const t1V = thermocoupleOrNull(t1, "t1");
    const t2V = thermocoupleOrNull(t2, "t2");
    const t3V = thermocoupleOrNull(t3, "t3");
    const tempV = _clampOrNull(toFiniteNumberOrNull(temp), AMB_TEMP_MIN, AMB_TEMP_MAX);
    const humV = _clampOrNull(toFiniteNumberOrNull(hum), HUM_MIN, HUM_MAX);
    const pressureV = _clampOrNull(toFiniteNumberOrNull(pressure), PRES_HPA_MIN, PRES_HPA_MAX);
    const vocV = _clampOrNull(toFiniteNumberOrNull(voc), VOC_KOHM_MIN, VOC_KOHM_MAX);
    const ok =
      typeof t1V === "number" ||
      typeof t2V === "number" ||
      typeof t3V === "number" ||
      typeof tempV === "number" ||
      typeof humV === "number" ||
      typeof pressureV === "number" ||
      typeof vocV === "number";
    if (!ok) return null;
    return {
      format: "official",
      patch: { t1: t1V, t2: t2V, t3: t3V, temp: tempV, hum: humV, pressure: pressureV, voc: vocV },
      raw,
      legacy: false
    };
  }

  if (tokens.length === 5 || tokens.length === 6) {
    const withT3 = tokens.length === 6;
    const t1 = nums[0];
    const t2 = nums[1];
    const t3Maybe = withT3 ? nums[2] : null;
    const temp = withT3 ? nums[3] : nums[2];
    const hum = withT3 ? nums[4] : nums[3];
    const voc = withT3 ? nums[5] : nums[4];
    const t1V = thermocoupleOrNull(t1, "t1");
    const t2V = thermocoupleOrNull(t2, "t2");
    const tempV = _clampOrNull(toFiniteNumberOrNull(temp), AMB_TEMP_MIN, AMB_TEMP_MAX);
    const humV = _clampOrNull(toFiniteNumberOrNull(hum), HUM_MIN, HUM_MAX);
    const vocV = _clampOrNull(toFiniteNumberOrNull(voc), VOC_KOHM_MIN, VOC_KOHM_MAX);
    const patch = { t1: t1V, t2: t2V, temp: tempV, hum: humV, voc: vocV };
    if (withT3) {
      const t3LV = thermocoupleOrNull(t3Maybe, "t3");
      if (typeof t3LV === "number") patch.t3 = t3LV;
    }
    const any = Object.values(patch).some((v) => typeof v === "number");
    if (!any) return null;
    return {
      format: "legacy",
      patch,
      raw,
      legacy: true
    };
  }

  return null;
}

function parseTextLine(line) {
  const raw = String(line ?? "").trim();
  if (!raw.length) return null;
  const numberFrom = (re) => {
    const m = raw.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  const mk = (patch) => ({ kind: "value", patch, raw });

  const toThermo = (re) => {
    const v = numberFrom(re);
    if (!Number.isFinite(v)) return null;
    return isThermocoupleValid(v) ? v : null;
  };

  if (/^T1:/i.test(raw)) return mk({ t1: thermocoupleOrNull(numberFrom(/T1:\s*([-+]?\d+(?:\.\d+)?)/i), "t1") });
  if (/^T2:/i.test(raw)) return mk({ t2: thermocoupleOrNull(numberFrom(/T2:\s*([-+]?\d+(?:\.\d+)?)/i), "t2") });
  if (/^T3:/i.test(raw)) return mk({ t3: thermocoupleOrNull(numberFrom(/T3:\s*([-+]?\d+(?:\.\d+)?)/i), "t3") });

  if (/Temp\s*Ambiente:/i.test(raw))
    return mk({ temp: _clampOrNull(toFiniteNumberOrNull(numberFrom(/Temp\s*Ambiente:\s*([-+]?\d+(?:\.\d+)?)/i)), AMB_TEMP_MIN, AMB_TEMP_MAX) });
  if (/Umidade:/i.test(raw)) return mk({ hum: _clampOrNull(toFiniteNumberOrNull(numberFrom(/Umidade:\s*([-+]?\d+(?:\.\d+)?)/i)), HUM_MIN, HUM_MAX) });
  if (/Press(?:ao|ão):/i.test(raw))
    return mk({ pressure: _clampOrNull(toFiniteNumberOrNull(numberFrom(/Press(?:ao|ão):\s*([-+]?\d+(?:\.\d+)?)/i)), PRES_HPA_MIN, PRES_HPA_MAX) });
  if (/Pressure:/i.test(raw))
    return mk({ pressure: _clampOrNull(toFiniteNumberOrNull(numberFrom(/Pressure:\s*([-+]?\d+(?:\.\d+)?)/i)), PRES_HPA_MIN, PRES_HPA_MAX) });
  if (/VOC\s*\/\s*Gas:/i.test(raw))
    return mk({ voc: _clampOrNull(toFiniteNumberOrNull(numberFrom(/VOC\s*\/\s*Gas:\s*([-+]?\d+(?:\.\d+)?)/i)), VOC_KOHM_MIN, VOC_KOHM_MAX) });
  if (/VOC\s*:/i.test(raw)) return mk({ voc: _clampOrNull(toFiniteNumberOrNull(numberFrom(/VOC\s*:\s*([-+]?\d+(?:\.\d+)?)/i)), VOC_KOHM_MIN, VOC_KOHM_MAX) });

  if (/^=+\s*BME680\s*=+/i.test(raw)) return { kind: "startFrame", raw };
  if (/^-{10,}/.test(raw)) return { kind: "endFrame", raw };

  return null;
}

function calcularQualidadeVOC(voc) {
  if (typeof voc !== "number" || !Number.isFinite(voc)) {
    return { texto: "Sem leitura", percentual: 0, faixa: "indisponivel" };
  }
  if (voc > 100) return { texto: "Excelente", percentual: 90, faixa: "excelente" };
  if (voc > 60) return { texto: "Boa", percentual: 70, faixa: "boa" };
  if (voc > 30) return { texto: "Moderada", percentual: 50, faixa: "moderada" };
  return { texto: "Ruim", percentual: 20, faixa: "ruim" };
}

function calcularVocPpm(voc_kohm, r0_clean_air = 50.0) {
  if (typeof voc_kohm !== "number" || !Number.isFinite(voc_kohm)) return null;
  if (voc_kohm <= 0) return null;
  const r0 = Number(r0_clean_air);
  if (!Number.isFinite(r0) || r0 <= 0) return null;
  const ratio = r0 / voc_kohm;
  const ppm = 0.5 * Math.pow(ratio, 2.0);
  if (!Number.isFinite(ppm)) return null;
  return Math.max(ppm, 0.1);
}

module.exports = {
  parseCsvLine,
  parseTextLine,
  toFiniteNumberOrNull,
  isThermocoupleValid,
  calcularQualidadeVOC,
  calcularVocPpm,
  resetThermocoupleMemory,
  thermocoupleOrNull
};
