import { motion } from "framer-motion";
import { Leaf, AlertTriangle } from "lucide-react";
import { calcularQualidadeVOC, calcularVocPpm } from "../lib/voc";

function formatPpm(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "---";
  return v.toFixed(2);
}

const FAIXAS = [
  { nome: "Ruim", inicioPct: 0, fimPct: 25, cor: "from-red-500 to-red-400", texto: "text-red-700", marcadorPct: 25 },
  { nome: "Moderada", inicioPct: 25, fimPct: 50, cor: "from-amber-400 to-amber-500", texto: "text-amber-700", marcadorPct: 50 },
  { nome: "Boa", inicioPct: 50, fimPct: 75, cor: "from-lime-500 to-lime-400", texto: "text-lime-700", marcadorPct: 75 },
  { nome: "Excelente", inicioPct: 75, fimPct: 100, cor: "from-emerald-500 to-emerald-400", texto: "text-emerald-700", marcadorPct: 100 }
];

export default function VocQuality({ voc }: { voc: number | null }) {
  const q = calcularQualidadeVOC(voc);
  const ppm = calcularVocPpm(voc);

  const statusPill =
    q.faixa === "excelente"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : q.faixa === "boa"
        ? "bg-lime-50 text-lime-700 ring-1 ring-lime-200"
        : q.faixa === "moderada"
          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
          : q.faixa === "indisponivel"
            ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
            : "bg-red-50 text-red-700 ring-1 ring-red-200";

  const pointerColor =
    q.faixa === "excelente"
      ? "bg-emerald-600"
      : q.faixa === "boa"
        ? "bg-lime-600"
        : q.faixa === "moderada"
          ? "bg-amber-600"
          : q.faixa === "indisponivel"
            ? "bg-slate-400"
            : "bg-red-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-slate-200/60"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Qualidade do Ar / VOC (BME680)</div>
            <div className="text-xs text-slate-500">Classificação automática</div>
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusPill}`}>{q.texto}</div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3">
        <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200/60">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <AlertTriangle className="h-4 w-4" />
            Concentração
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tracking-tight text-emerald-900">{formatPpm(ppm)}</div>
            <div className="text-sm font-medium text-emerald-700">ppm</div>
          </div>
          <div className="mt-1 text-xs text-emerald-600/80">
            Indicador bruto de ppm
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-600">Escala de Qualidade do Ar</div>
          <div className="text-xs text-slate-500">{q.percentual}% — {q.texto}</div>
        </div>

        <div className="relative mt-3 h-6">
          <div className="absolute inset-x-0 top-0 h-3 overflow-hidden rounded-full bg-slate-100 flex">
            {FAIXAS.map((f) => (
              <div
                key={f.nome}
                className={`h-full bg-gradient-to-r ${f.cor}`}
                style={{ width: `${f.fimPct - f.inicioPct}%` }}
              />
            ))}
          </div>

          {FAIXAS.slice(0, 3).map((f) => (
            <div
              key={`marker-${f.nome}`}
              className="absolute top-0 h-3 w-px bg-white/80 shadow-sm"
              style={{ left: `${f.marcadorPct}%` }}
            />
          ))}

          <div className="absolute inset-x-0 top-3 h-3 flex">
            {FAIXAS.map((f) => (
              <div
                key={`label-${f.nome}`}
                className={`h-full text-[10px] font-semibold flex items-center justify-center ${f.texto}`}
                style={{ width: `${f.fimPct - f.inicioPct}%` }}
              >
                {f.nome}
              </div>
            ))}
          </div>

          {FAIXAS.slice(0, 3).map((f) => (
            <div
              key={`tick-${f.nome}`}
              className="absolute bottom-0 w-px h-2 bg-slate-300"
              style={{ left: `${f.marcadorPct}%` }}
            />
          ))}

          <div
            className="absolute bottom-0 text-[9px] font-medium text-slate-400"
            style={{ left: 0, transform: "translateX(0)" }}
          >0%</div>
          <div
            className="absolute bottom-0 text-[9px] font-medium text-slate-400"
            style={{ left: "50%", transform: "translateX(-50%)" }}
          >50%</div>
          <div
            className="absolute bottom-0 text-[9px] font-medium text-slate-400"
            style={{ left: "100%", transform: "translateX(-100%)" }}
          >100%</div>

          <motion.div
            initial={false}
            animate={{ left: `${q.percentual}%` }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
            className="absolute top-0 -translate-x-1/2 pointer-events-none"
          >
            <div className={`h-4 w-4 rounded-full ring-4 ring-white shadow-soft ${pointerColor}`} />
            <div className={`mt-0.5 mx-auto h-3 w-px ${pointerColor}`} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

