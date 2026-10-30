"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANOS, brl, type Plano } from "@/lib/planos";

type Ciclo = "mensal" | "anual";

/** Anual = 10 vezes o mensal (2 meses grátis). */
const precoAnual = (p: Plano) => p.precoMensal * 10;

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function TabelaPrecos() {
  const [ciclo, setCiclo] = useState<Ciclo>("mensal");
  const planos = Object.values(PLANOS);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Forma de cobrança"
        className="inline-flex rounded-lg border border-line bg-surface p-1 text-sm"
      >
        {(["mensal", "anual"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={ciclo === c}
            onClick={() => setCiclo(c)}
            className={`rounded-md px-4 py-2 font-medium transition-colors motion-reduce:transition-none ${foco} ${
              ciclo === c ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {c === "mensal" ? "Mensal" : "Anual, 2 meses grátis"}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {planos.map((p) => {
          const gratis = p.precoMensal === 0;
          const href =
            ciclo === "anual" && !gratis
              ? `/cadastrar?plano=${p.id}&ciclo=anual`
              : `/cadastrar?plano=${p.id}`;
          return (
            <div
              key={p.id}
              className={`flex flex-col p-6 ${p.destaque ? "bg-brand-soft" : "bg-surface"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-ink">{p.nome}</h2>
                {p.destaque && <span className="text-xs font-medium text-brand">Mais escolhido</span>}
              </div>
              <p className="mt-1 min-h-10 text-sm text-muted">{p.publico}</p>

              <div className="mt-6 min-h-[4.5rem]">
                {gratis ? (
                  <p className="display text-4xl text-ink">Grátis</p>
                ) : ciclo === "mensal" ? (
                  <p className="text-ink">
                    <span className="display text-4xl">{brl(p.precoMensal)}</span>
                    <span className="text-sm text-muted">/mês</span>
                  </p>
                ) : (
                  <>
                    <p className="text-ink">
                      <span className="display text-4xl">{brl(precoAnual(p))}</span>
                      <span className="text-sm text-muted">/ano</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      equivale a {brl(precoAnual(p) / 12, 2)} por mês
                    </p>
                  </>
                )}
              </div>

              <Link
                href={href}
                className={`mt-6 ${p.destaque ? "btn-primary" : "btn-ghost"} ${foco}`}
              >
                {gratis ? "Simular grátis" : `Assinar o ${p.nome}`}
              </Link>

              <ul className="mt-6 space-y-2 text-sm text-ink/85">
                {p.recursos.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span aria-hidden className="text-brand">
                      ✓
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
