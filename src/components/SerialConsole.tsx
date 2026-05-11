import { motion } from "framer-motion";
import { Terminal } from "lucide-react";

export default function SerialConsole({
  lines,
  connected
}: {
  lines: { ts: number; raw: string }[];
  connected: boolean;
}) {
  const headerPill = connected
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl bg-slate-950 p-5 shadow-soft ring-1 ring-slate-900/10"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-white">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Integração Arduino</div>
            <div className="text-xs text-white/60">Linhas recebidas em tempo real</div>
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${headerPill}`}>
          {connected ? "Online" : "Offline"}
        </div>
      </div>

      <div className="mt-4 h-44 overflow-hidden rounded-2xl bg-black/35 ring-1 ring-white/10">
        <div className="h-full overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-emerald-200">
          {lines.length === 0 ? (
            <div className="text-white/50">Aguardando dados...</div>
          ) : (
            lines.map((l) => (
              <div key={l.ts} className="whitespace-pre-wrap">
                {l.raw}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
