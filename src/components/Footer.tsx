import { Wifi } from "lucide-react";

function formatAge(ms: number) {
  if (!Number.isFinite(ms)) return "-";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(s % 60).padStart(2, "0")}s`;
}

export default function Footer({
  online,
  lastUpdateTs
}: {
  online: boolean;
  lastUpdateTs?: number;
}) {
  const age = lastUpdateTs ? Date.now() - lastUpdateTs : Number.NaN;
  return (
    <div className="mt-6 border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          <span className="font-medium">{online ? "Status online" : "Status offline"}</span>
          <span className="text-slate-400">•</span>
          <span>Atualização: {lastUpdateTs ? `há ${formatAge(age)}` : "—"}</span>
        </div>
        <div className="hidden text-slate-500 sm:block">Atualização em tempo real</div>
      </div>
    </div>
  );
}

