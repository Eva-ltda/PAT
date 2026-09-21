import { motion } from "framer-motion";
import { Leaf, AlertTriangle } from "lucide-react";
import {
  CartesianGrid,
  Dot,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { calcularQualidadeVOC, calcularVocPpm } from "../lib/voc";

export type VocHistoryRow = {
  ts: number;
  label: string;
  vocPpm: number | null;
};

function formatPpm(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "---";
  return v.toFixed(2);
}

export default function VocQuality({
  voc,
  history = []
}: {
  voc: number | null;
  history?: VocHistoryRow[];
}) {
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

  const chartRows = (history || []).slice(-180);
  const lastIdx = Math.max(chartRows.length - 1, 0);

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
            <div className="text-sm font-semibold text-slate-900">Qualidade do Ar / PPM</div>
            <div className="text-xs text-slate-500">Histórico em tempo real</div>
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
          <div className="text-xs font-semibold text-slate-600">Histórico (linhas marcadoras)</div>
          <div className="text-xs text-slate-500">
            {chartRows.length > 0
              ? `Últimas ${chartRows.length} amostras`
              : "Aguardando dados"}
          </div>
        </div>

        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="vocPpmStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={42}
                domain={[0, "auto"]}
                allowDecimals={false}
                label={undefined as unknown as Label}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.35)",
                  boxShadow: "0 10px 25px rgba(15,23,42,0.12)",
                  fontSize: 12
                }}
                formatter={(v: unknown) => [
                  typeof v === "number" && Number.isFinite(v)
                    ? `${v.toFixed(2)} ppm`
                    : "---",
                  "Concentração (ppm)"
                ]}
                labelFormatter={(l: string | number) => `Horário ${l}`}
              />

              <Line
                type="monotone"
                dataKey="vocPpm"
                name="Concentração (ppm)"
                stroke="url(#vocPpmStroke)"
                strokeWidth={2.4}
                connectNulls
                isAnimationActive
                animationDuration={450}
                dot={(props: any) => {
                  const { cx, cy, index, payload } = props;
                  const isLast = payload && index === lastIdx && chartRows.length > 0;
                  const periodic = payload && index > 0 && index % 30 === 0;
                  if (isLast) {
                    return (
                      <g key={`voc-last-${index}`}>
                        <circle cx={cx} cy={cy} r={6} fill="rgba(16,185,129,0.18)" />
                        <circle cx={cx} cy={cy} r={3.6} fill="#10b981" stroke="#fff" strokeWidth={2} />
                      </g>
                    );
                  }
                  if (periodic) {
                    return (
                      <Dot
                        key={`voc-marker-${index}`}
                        cx={cx}
                        cy={cy}
                        r={2.2}
                        fill="rgba(99,102,241,0.85)"
                        stroke="#fff"
                        strokeWidth={1.2}
                      />
                    );
                  }
                  return <Dot key={`voc-dot-${index}`} r={0} />;
                }}
                activeDot={{ r: 5, fill: "#0ea5e9", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="inline-block h-2 w-4 rounded bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
            Marcadores periódicos (a cada 30 amostras)
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            Marcador do último valor
          </div>
        </div>
      </div>
    </motion.div>
  );
}
