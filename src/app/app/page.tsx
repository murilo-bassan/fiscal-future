import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { analisar } from "@/components/app/analise";
import { NOMES_ATIVIDADE, NOMES_REGIME } from "@/components/app/camposPerfil";
import { brl, pctSinal } from "@/components/app/formato";
import { cenarioPorId, lerPerfil } from "./empresas/dados";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  const u = await exigirUsuario();
  const p = plano(u.plano);
  const empresas = await db.empresa.findMany({
    where: { userId: u.id },
    orderBy: { updatedAt: "desc" },
  });
  const noLimite = empresas.length >= p.empresas;
  const primeiroNome = u.nome.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">
            {empresas.length ? "Suas empresas" : `Olá, ${primeiroNome}`}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {empresas.length} de {p.empresas} {p.empresas === 1 ? "empresa" : "empresas"} no plano {p.nome}
          </p>
        </div>
        {!noLimite && (
          <Link href="/app/empresas/nova" className="btn-primary self-start sm:self-auto">
            Nova empresa
          </Link>
        )}
      </div>

      {empresas.length === 0 ? (
        <div className="card max-w-2xl">
          <h2 className="display text-2xl font-semibold text-ink">Comece pela sua empresa</h2>
          <p className="mt-2 text-sm text-muted">
            Com o faturamento, as compras e os impostos dos últimos 12 meses, você vê quanto a reforma muda
            os seus impostos e o seu preço de 2026 a 2033. Leva uns 3 minutos.
          </p>
          <Link href="/app/empresas/nova" className="btn-primary mt-5">
            Cadastrar empresa
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {empresas.map((e) => {
            const perfil = lerPerfil(e.perfil, e.nome);
            const a = perfil ? analisar(perfil, cenarioPorId(e.cenarioId)) : null;
            return (
              <li key={e.id}>
                <Link
                  href={`/app/empresas/${e.id}`}
                  className="group grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-ink group-hover:text-brand">{e.nome}</p>
                    <p className="text-sm text-muted">
                      {perfil
                        ? `${NOMES_REGIME[perfil.regime]}, ${NOMES_ATIVIDADE[perfil.atividade].toLowerCase()}, ${brl(perfil.receitaAnual)} por ano`
                        : "Dados incompletos: abra para preencher"}
                    </p>
                  </div>
                  {a && <Resumo a={a} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {noLimite && (
        <div className="flex flex-col gap-3 rounded-xl bg-accent-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            {p.empresas === 1
              ? `O plano ${p.nome} inclui 1 empresa. Para simular outras empresas ou clientes, mude de plano.`
              : `Você usou as ${p.empresas} empresas do plano ${p.nome}. Para cadastrar mais, mude de plano.`}
          </p>
          <Link href="/app/conta" className="btn-primary shrink-0">
            Ver planos
          </Link>
        </div>
      )}
    </div>
  );
}

function Resumo({ a }: { a: ReturnType<typeof analisar> }) {
  const cor = (v: number) => (v > 0.0005 ? "text-bad" : v < -0.0005 ? "text-good" : "text-ink");
  if (a.simples && a.comparacao) {
    const c = a.comparacao;
    return (
      <dl className="grid grid-cols-2 gap-6 text-sm sm:text-right">
        <div>
          <dt className="text-xs text-muted">Melhor em 2027</dt>
          <dd className="font-semibold text-ink">{c.recomendacao2027 === "hibrido" ? "Simples híbrido" : "Simples puro"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Melhor em 2033</dt>
          <dd className="font-semibold text-ink">{c.recomendacao2033 === "hibrido" ? "Simples híbrido" : "Simples puro"}</dd>
        </div>
      </dl>
    );
  }
  const r = a.sim.resumo;
  return (
    <dl className="grid grid-cols-2 gap-6 text-sm sm:text-right">
      <div>
        <dt className="text-xs text-muted">Carga em 2033</dt>
        <dd className={`text-lg font-semibold tabular-nums ${cor(r.variacaoCarga2033)}`}>{pctSinal(r.variacaoCarga2033)}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Reajuste necessário</dt>
        <dd className={`text-lg font-semibold tabular-nums ${cor(r.reajusteNecessario2033)}`}>{pctSinal(r.reajusteNecessario2033)}</dd>
      </div>
    </dl>
  );
}
