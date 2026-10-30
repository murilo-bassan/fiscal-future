import type { ReactNode } from "react";

export type Pergunta = { p: string; r: ReactNode };

/** Lista de perguntas com <details> nativo: abre e fecha sem JavaScript. */
export function Faq({ itens }: { itens: Pergunta[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {itens.map((item) => (
        <details key={item.p} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
            <span>{item.p}</span>
            <span
              aria-hidden
              className="mt-0.5 shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div className="max-w-2xl pb-6 leading-relaxed text-muted">{item.r}</div>
        </details>
      ))}
    </div>
  );
}
