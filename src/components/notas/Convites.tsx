import Link from "next/link";

export function ConviteDadosFiscais({ empresaId, faltando }: { empresaId: string; faltando: string[] }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="display text-xl font-semibold text-ink">Antes da primeira nota, os dados fiscais</h2>
      <p className="mt-1 text-sm text-muted">
        Razão social, endereço e regime vão no cabeçalho de toda nota. Leva uns cinco minutos. Ainda falta:
      </p>
      <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink sm:grid-cols-2">
        {faltando.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-accent" />
            {f}
          </li>
        ))}
      </ul>
      <Link href={`/app/empresas/${empresaId}/fiscal`} className="btn-primary mt-4">
        Preencher dados fiscais
      </Link>
    </section>
  );
}

export function ConviteUpgrade() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="display text-xl font-semibold text-ink">Emissão de notas está nos planos pagos</h2>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Emita NF-e e NFS-e com o IBS e a CBS já calculados, no layout exigido pela reforma. A partir do plano Essencial,
        50 notas por mês.
      </p>
      <Link href="/app/conta" className="btn-primary mt-4">
        Ver planos
      </Link>
    </section>
  );
}
