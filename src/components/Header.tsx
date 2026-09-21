import { useEffect, useMemo, useState } from "react";
import { Download, HardDrive, Pause, Play, PlugZap, Timer, Unplug } from "lucide-react";
import type { ConnectionStatus } from "../lib/types";
import internalLogo from "../assets/EVA LTDA Embedde.png";

function formatNow(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatRel(ts?: number) {
  if (!ts) return "Sem leitura";
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "Agora";
  if (diff < 60) return `${diff}s atrás`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  return `${h}h atrás`;
}

export default function Header({
  status,
  onExport,
  onBackup,
  onDisconnect,
  onConnect,
  onToggleCollecting,
  exportDisabled,
  backupDisabled,
  lastReadTs,
  backupInfo
}: {
  status: ConnectionStatus;
  onExport?: () => void;
  onBackup?: () => void;
  onDisconnect?: () => void;
  onConnect?: () => void;
  onToggleCollecting?: () => void;
  exportDisabled?: boolean;
  backupDisabled?: boolean;
  lastReadTs?: number;
  backupInfo?: { baseDir?: string; rows?: number } | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const [ports, setPorts] = useState<{ path: string; manufacturer?: string }[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setBackupTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
      setBackupTick((x) => x + 1);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const list = await window.DashboardArduino?.listSerialPorts?.();
        if (!mounted) return;
        setPorts((list || []).map((p) => ({ path: p.path, manufacturer: p.manufacturer })));
      } catch {
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  const setPort = async (portPath: string) => {
    try {
      await window.DashboardArduino?.setSerialPort?.(portPath);
      setMenuOpen(false);
    } catch {
    }
  };

  const collecting = Boolean(status.collecting ?? true);
  const sessionRows = status.sessionRows ?? 0;

  const statusUi = useMemo(() => {
    if (status.connected) {
      return {
        label: collecting ? "Conectado" : "Conectado (pausado)",
        dot: collecting ? "bg-emerald-500" : "bg-amber-500",
        pill: collecting ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
      };
    }
    if (status.manualDisconnect) {
      return {
        label: "Desconectado",
        dot: "bg-slate-400",
        pill: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
      };
    }
    return {
      label: "Desconectado",
      dot: "bg-slate-300",
      pill: "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
    };
  }, [status.connected, status.manualDisconnect, collecting]);

  return (
    <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-28 place-items-center sm:h-14 sm:w-36">
            <img src={internalLogo} alt="EVA LTDA" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">Dashboard Arduino</div>
            <div className="text-xs text-slate-500">Monitoramento industrial em tempo real</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              disabled={Boolean(exportDisabled)}
              className="hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-soft ring-1 ring-slate-200/60 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
              title={`Exportar para Excel/CSV (${sessionRows.toLocaleString("pt-BR")} registros)`}
            >
              <Download className="h-4 w-4 opacity-80" />
              <span>Exportar</span>
            </button>
          ) : null}

          {onBackup ? (
            <button
              type="button"
              onClick={onBackup}
              disabled={Boolean(backupDisabled)}
              className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-soft ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
              title={
                backupInfo && backupInfo.baseDir
                  ? `Pasta: ${backupInfo.baseDir} • Amostras: ${(backupInfo.rows ?? 0).toLocaleString("pt-BR")}`
                  : "Fazer backup agora"
              }
            >
              <HardDrive className="h-4 w-4 opacity-80" />
              <span>Backup agora</span>
            </button>
          ) : null}

          {onToggleCollecting ? (
            <button
              type="button"
              onClick={onToggleCollecting}
              disabled={!status.connected}
              className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-soft ring-1 transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex ${
                collecting
                  ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100"
                  : "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
              }`}
              title={
                collecting
                  ? `Pausar coleta (Serial continua conectada) • ${sessionRows.toLocaleString("pt-BR")} registros`
                  : `Retomar coleta • ${sessionRows.toLocaleString("pt-BR")} registros já salvos`
              }
            >
              {collecting ? (
                <>
                  <Pause className="h-4 w-4 opacity-80" />
                  <span>Parar coleta</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 opacity-80" />
                  <span>Iniciar coleta</span>
                </>
              )}
              {sessionRows > 0 ? (
                <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                  {sessionRows.toLocaleString("pt-BR")}
                </span>
              ) : null}
            </button>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => window.setTimeout(() => setMenuOpen(false), 120)}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${statusUi.pill}`}
              title={
                status.error
                  ? status.error
                  : collecting
                    ? `Última leitura: ${formatRel(lastReadTs ?? status.lastSeenTs)}`
                    : `Coleta pausada • última leitura: ${formatRel(lastReadTs ?? status.lastSeenTs)}`
              }
            >
              <span className={`h-2 w-2 rounded-full ${statusUi.dot}`} />
              <PlugZap className="h-4 w-4 opacity-80" />
              <span>{statusUi.label}</span>
              <span className="hidden text-slate-500 sm:inline">
                {status.portPath ? `• ${status.portPath}` : ""}
              </span>
              {status.baudRate ? (
                <span className="ml-1 hidden rounded-full bg-white/60 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200/80 sm:inline">
                  {formatRel(lastReadTs ?? status.lastSeenTs)}
                </span>
              ) : null}
              {status.connected && !status.manualDisconnect && onDisconnect ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDisconnect();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDisconnect();
                    }
                  }}
                  className="ml-1 hidden items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white sm:inline-flex"
                  title="Fechar porta serial"
                >
                  <Unplug className="h-3 w-3" />
                  <span>Desconectar</span>
                </span>
              ) : null}
              {!status.connected && status.manualDisconnect && onConnect ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onConnect();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onConnect();
                    }
                  }}
                  className="ml-1 hidden items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-200 sm:inline-flex"
                  title="Conectar ao Arduino"
                >
                  <PlugZap className="h-3 w-3" />
                  <span>Conectar</span>
                </span>
              ) : null}
              {status.error ? (
                <span className="ml-1 hidden rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 sm:inline">
                  Erro
                </span>
              ) : null}
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-[46px] z-20 w-64 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200/70">
                {status.connected ? (
                  <div className="space-y-1">
                    <div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Conexão ativa
                    </div>
                    <div className="grid grid-cols-1 gap-1 px-3 pb-3 text-xs text-slate-700">
                      <div>
                        <span className="font-semibold">Porta:</span> {status.portPath ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold">Baud:</span> {status.baudRate ?? 9600}
                      </div>
                      <div>
                        <span className="font-semibold">Fabricante:</span> {status.manufacturer ?? "—"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="px-3 py-2 text-[11px] font-semibold text-slate-500">
                      Portas disponíveis
                      {status.manualDisconnect ? " (modo manual)" : ""}
                    </div>
                    <div className="max-h-48 overflow-auto">
                      {ports.length === 0 ? (
                        <div className="px-3 pb-3 text-xs text-slate-600">Nenhuma porta encontrada</div>
                      ) : (
                        ports.map((p) => (
                          <button
                            key={p.path}
                            type="button"
                            onClick={() => setPort(p.path)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <span className="font-semibold">{p.path}</span>
                            <span className="max-w-[120px] truncate text-[11px] text-slate-500">
                              {p.manufacturer || ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {status.manualDisconnect && onConnect ? (
                      <button
                        type="button"
                        onClick={() => {
                          onConnect();
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        <PlugZap className="h-4 w-4" />
                        <span>Conectar usando última porta</span>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-soft sm:flex">
            <Timer className="h-4 w-4 opacity-90" />
            <span>{formatNow(now)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
