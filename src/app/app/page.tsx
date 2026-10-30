import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { analisar } from "@/components/app/analise";
import { NOMES_ATIVIDADE, NOMES_REGIME } from "@/components/app/camposPerfil";
import { brl, pctSinal } from "@/components/app/formato";
import { cenarioPorId, lerPerfil } from "./empresas/dados";
import { agruparPorMes, conversoesDoMes, notasDoMes } from "@/lib/painel";

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
  const [notasMes, conversoes] = await Promise.all([notasDoMes(u.id), conversoesDoMes(u.id)]);
  const resumoMes = agruparPorMes(notasMes, 1)[0];
  const porEmpresa = new Map<string, { notas: number; faturamento: number }>();
  for (const n of notasMes) {
    if (n.status !== "autorizada") continue;
    const atual = porEmpresa.get(n.empresaId ?? "") ?? { notas: 0, faturamento: 0 };
    atual.notas += 1;
    atual.faturamento += n.valorTotal;
    porEmpresa.set(n.empresaId ?? "", atual);
  }

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

      <section aria-labelledby="resumo-escritorio" className="space-y-4">
        <div><h2 id="resumo-escritorio" className="text-lg font-semibold text-ink">Escritório · resumo do mês</h2><p className="text-sm text-muted">Notas de produção autorizadas e conversões em todas as empresas.</p></div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ResumoMes rotulo="Notas autorizadas" valor={String(resumoMes.notas)} />
          <ResumoMes rotulo="Faturamento autorizado" valor={brl(resumoMes.faturamento)} />
          <ResumoMes rotulo="IBS/CBS destacado" valor={brl(resumoMes.ibsCbs)} />
          <ResumoMes rotulo="Conversões no mês" valor={String(conversoes)} />
        </div>
        {empresas.length > 0 && <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{empresas.map((e) => {
          const resumo = porEmpresa.get(e.id) ?? { notas: 0, faturamento: 0 };
          return <li key={e.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm"><Link href={`/app/empresas/${e.id}/notas`} className="min-w-0 truncate font-medium text-ink hover:text-brand">{e.nome}</Link><span className="shrink-0 text-right text-xs tabular-nums text-muted">{resumo.notas} notas · {brl(resumo.faturamento)}</span></li>;
        })}</ul>}
      </section>

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

function ResumoMes({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="card min-w-0 p-4"><p className="text-xs font-medium text-muted">{rotulo}</p><p className="mt-2 break-words text-xl font-semibold text-ink tabular-nums">{valor}</p></div>;
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
