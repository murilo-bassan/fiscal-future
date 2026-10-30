import type { Reducao } from "@/lib/tax/params";
import type { Confianca } from "@/lib/classificador";
import { ROTULO_CONFIANCA, ROTULO_REDUCAO } from "./rotulos";

const COR_REDUCAO: Record<Reducao, string> = {
  padrao: "border-line bg-paper text-ink",
  reducao30: "border-transparent bg-accent-soft text-ink",
  reducao60: "border-transparent bg-brand-soft text-brand-strong",
  zero: "border-transparent bg-good-soft text-good",
};

export function SeloReducao({ reducao }: { reducao: Reducao }) {
  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${COR_REDUCAO[reducao]}`}
    >
      {ROTULO_REDUCAO[reducao]}
    </span>
  );
}

const COR_CONFIANCA: Record<Confianca, string> = {
  alta: "text-good",
  media: "text-ink",
  baixa: "text-bad",
};

export function SeloConfianca({ confianca }: { confianca: Confianca }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${COR_CONFIANCA[confianca]}`}>
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {ROTULO_CONFIANCA[confianca]}
    </span>
  );
}
