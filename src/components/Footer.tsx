import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";

function formatAge(ms: number) {
  if (!Number.isFinite(ms)) return "-";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(s % 60).padStart(2, "0")}s`;
}

function fmtCount(n: number) {
  try {
    return n.toLocaleString("pt-BR");
  } catch {
    return String(n);
  }
}

export default function Footer({
  online,
  connected,
  collecting,
  manualDisconnect,
  lastUpdateTs,
  sessionRows,
  appVersion
}: {
  online: boolean;
  connected?: boolean;
  collecting?: boolean;
  manualDisconnect?: boolean;
  lastUpdateTs?: number;
  sessionRows?: number;
  appVersion?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const age = lastUpdateTs ? Date.now() - lastUpdateTs : Number.NaN;

  let statusText = "Offline";
  let dotClass = "bg-slate-400";
  if (manualDisconnect) {
    statusText = "Desconectado";
    dotClass = "bg-slate-500";
  } else if (connected && collecting === false) {
    statusText = "Pausado";
    dotClass = "bg-amber-500";
  } else if (online) {
    statusText = "Online";
    dotClass = "bg-emerald-500";
  } else if (connected) {
    statusText = "Conectado (sem dados recentes)";
    dotClass = "bg-slate-400";
  }

  const versionLabel = appVersion ? `Patch ${appVersion}` : "Patch —";

  return (
    <div className="mt-6 border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <Wifi className="h-4 w-4" />
            <span className="font-medium">{statusText}</span>
          </span>
          <span className="text-slate-400">•</span>
          <span>
            Última leitura: {lastUpdateTs ? `há ${formatAge(age)}` : "—"}
          </span>
          {typeof sessionRows === "number" && sessionRows >= 0 ? (
            <>
              <span className="text-slate-400">•</span>
              <span>{fmtCount(sessionRows)} registros</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span>{versionLabel}</span>
        </div>
      </div>
    </div>
  );
}
