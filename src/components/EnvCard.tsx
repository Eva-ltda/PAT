import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export default function EnvCard({
  title,
  value,
  unit,
  icon: Icon,
  accent
}: {
  title: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  accent: "blue" | "cyan" | "violet";
}) {
  const palette =
    accent === "blue"
      ? { ring: "ring-blue-100", icon: "bg-blue-50 text-blue-600" }
      : accent === "cyan"
        ? { ring: "ring-cyan-100", icon: "bg-cyan-50 text-cyan-700" }
        : { ring: "ring-violet-100", icon: "bg-violet-50 text-violet-700" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -3 }}
      className={`rounded-3xl bg-white p-5 shadow-soft ring-1 ${palette.ring} transition-shadow duration-300 hover:shadow-hover`}
    >
      <div className="flex items-center justify-between">
        <div className={`grid h-11 w-11 place-items-center rounded-2xl ${palette.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="rounded-full bg-slate-900/5 px-3 py-1 text-[11px] font-medium text-slate-600">
          {unit}
        </div>
      </div>

      <div className="mt-4 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-500">{unit}</div>
      </div>
    </motion.div>
  );
}

