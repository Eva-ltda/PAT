export type VocFaixa = "excelente" | "boa" | "moderada" | "ruim" | "indisponivel";

export function calcularQualidadeVOC(voc: number | null | undefined) {
  if (typeof voc !== "number" || !Number.isFinite(voc)) {
    return { texto: "Sem leitura", percentual: 0, faixa: "indisponivel" as const };
  }
  if (voc > 100) return { texto: "Excelente", percentual: 90, faixa: "excelente" as const };
  if (voc > 60) return { texto: "Boa", percentual: 70, faixa: "boa" as const };
  if (voc > 30) return { texto: "Moderada", percentual: 50, faixa: "moderada" as const };
  return { texto: "Ruim", percentual: 20, faixa: "ruim" as const };
}

export function calcularVocPpm(voc_kohm: number | null | undefined, r0_clean_air: number = 50.0): number | null {
  if (typeof voc_kohm !== "number" || !Number.isFinite(voc_kohm)) return null;
  if (voc_kohm <= 0) return null;
  const r0 = Number(r0_clean_air);
  if (!Number.isFinite(r0) || r0 <= 0) return null;
  const ratio = r0 / voc_kohm;
  const ppm = 0.5 * Math.pow(ratio, 2.0);
  if (!Number.isFinite(ppm)) return null;
  return Math.max(ppm, 0.1);
}

