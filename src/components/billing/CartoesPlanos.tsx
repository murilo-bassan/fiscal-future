import { PLANOS_PAGOS, brl, type PlanoId } from "@/lib/planos";

type Props = {
  atual: PlanoId;
  destacar?: PlanoId | null;
  demonstracao: boolean;
  /** Já tem assinatura no Stripe: o botão vira "Trocar". */
  temAssinatura: boolean;
};

export function CartoesPlanos({ atual, destacar, demonstracao, temAssinatura }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLANOS_PAGOS.map((p) => {
        const ehAtual = p.id === atual;
        const emDestaque = destacar ? destacar === p.id : p.destaque;
        const rotulo = ehAtual ? "Plano atual" : atual === "gratis" && !temAssinatura ? "Assinar" : "Trocar para este";
        return (
          <article
            key={p.id}
            id={`plano-${p.id}`}
            className={`card flex flex-col gap-4 ${
              destacar === p.id ? "border-brand ring-2 ring-brand/30" : emDestaque ? "border-brand" : ""
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-ink">{p.nome}</h3>
                {ehAtual ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">
                    Seu plano
                  </span>
                ) : destacar === p.id ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-ink">
                    Escolhido
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{p.publico}</p>
            </div>
            <p className="text-ink">
              <span className="display text-3xl font-semibold">{brl(p.precoMensal)}</span>
              <span className="text-sm text-muted"> /mês</span>
            </p>
            <ul className="flex-1 space-y-1.5 text-sm text-ink">
              {p.recursos.map((r) => (
                <li key={r} className="flex gap-2">
                  <span aria-hidden className="text-brand">
                    ✓
                  </span>
                  {r}
                </li>
              ))}
            </ul>
            <form action="/api/checkout" method="post">
              <input type="hidden" name="plano" value={p.id} />
              <button
                className={`w-full ${destacar === p.id || (!destacar && emDestaque) ? "btn-primary" : "btn-ghost"}`}
                disabled={ehAtual}
              >
                {rotulo}
                {demonstracao && !ehAtual ? " (demonstração)" : ""}
              </button>
            </form>
          </article>
        );
      })}
    </div>
  );
}
