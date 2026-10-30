import type { StatusNota } from "@/lib/emissao/tipos";
import { ROTULO_STATUS } from "./rotulos";

const COR: Record<StatusNota, string> = {
  processando: "bg-accent-soft text-ink",
  autorizada: "bg-good-soft text-good",
  rejeitada: "bg-bad-soft text-bad",
  cancelada: "bg-paper text-muted border border-line",
  erro: "bg-bad-soft text-bad",
};

export function SeloStatus({ status }: { status: string }) {
  const s = (status in COR ? status : "erro") as StatusNota;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${COR[s]}`}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 rounded-full bg-current ${s === "processando" ? "motion-safe:animate-pulse" : ""}`}
      />
      {ROTULO_STATUS[s]}
    </span>
  );
}

/** Legenda legal de documento sem valor fiscal (homologação ou simulado). */
export function FaixaSemValor({ ambiente, provedor }: { ambiente: string; provedor: string }) {
  if (ambiente === "producao" && provedor !== "simulado") return null;
  const onde = provedor === "simulado" ? "SIMULADO" : "AMBIENTE DE HOMOLOGAÇÃO";
  return (
    <div role="note" className="rounded-lg border border-accent bg-accent-soft px-4 py-2.5 text-center text-sm text-ink">
      <strong className="font-semibold tracking-wide">{onde}: SEM VALOR FISCAL</strong>
      <span className="block text-xs text-muted">Nota de teste. Não vale como documento fiscal.</span>
    </div>
  );
}
