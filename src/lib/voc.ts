export function calcularQualidadeVOC(voc: number) {
  if (voc > 100) return { texto: "Excelente", percentual: 90, faixa: "excelente" as const };
  if (voc > 60) return { texto: "Boa", percentual: 70, faixa: "boa" as const };
  if (voc > 30) return { texto: "Moderada", percentual: 50, faixa: "moderada" as const };
  return { texto: "Ruim", percentual: 20, faixa: "ruim" as const };
}

