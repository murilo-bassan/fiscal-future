import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { plano } from "@/lib/planos";
import { analisar } from "@/components/app/analise";
import { NOMES_ATIVIDADE, NOMES_REGIME } from "@/components/app/camposPerfil";
import {
  BlocoGraficos,
  Kpis,
  Premissas,
  Resposta,
  SecaoSimples,
  SecaoSplit,
  TabelaAnos,
} from "@/components/app/Painel";
import { SeletorCenario } from "@/components/app/SeletorCenario";
import { cenarioPorId, empresaDoUsuario } from "../dados";

export const metadata: Metadata = { title: "Resultado" };

export default async function EmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cenario?: string | string[] }>;
}) {
  const [{ id }, sp, u] = await Promise.all([params, searchParams, exigirUsuario()]);
  const { empresa, perfil } = await empresaDoUsuario(id, u.id);
  const base = `/app/empresas/${empresa.id}`;

  if (!perfil) {
    return (
      <div className="card mx-auto max-w-xl">
        <h1 className="display text-2xl font-semibold text-ink">{empresa.nome}</h1>
        <p className="mt-2 text-sm text-muted">
          Não conseguimos ler os dados salvos desta empresa. Preencha o formulário de novo para ver o resultado.
        </p>
        <Link href={`${base}/editar`} className="btn-primary mt-4">
          Preencher dados
        </Link>
      </div>
    );
  }

  const pedido = Array.isArray(sp.cenario) ? sp.cenario[0] : sp.cenario;
  const cenario = cenarioPorId(pedido ?? empresa.cenarioId);
  const a = analisar(perfil, cenario);
  const pdf = plano(u.plano).relatorioPdf;
  const qsCenario = cenario.id !== empresa.cenarioId ? `?cenario=${cenario.id}` : "";

  return (
    <div className="space-y-12">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link href="/app" className="text-sm text-muted hover:text-ink">
              Empresas
            </Link>
            <h1 className="mt-1 truncate text-2xl font-semibold text-ink sm:text-3xl">{empresa.nome}</h1>
            <p className="mt-1 text-sm text-muted">
              {NOMES_REGIME[perfil.regime]}, {NOMES_ATIVIDADE[perfil.atividade].toLowerCase()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/editar`} className="btn-ghost">
              Editar dados
            </Link>
            <Link href={`${base}/notas`} className="btn-ghost">
              Notas fiscais
            </Link>
            {pdf ? (
              <Link href={`${base}/relatorio${qsCenario}`} className="btn-primary">
                Relatório PDF
              </Link>
            ) : (
              <Link
                href="/app/conta"
                className="btn-ghost text-muted"
                title="O relatório em PDF está nos planos pagos"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Relatório PDF: ver planos
              </Link>
            )}
          </div>
        </div>
        <SeletorCenario base={base} atual={cenario.id} salvo={empresa.cenarioId} />
      </header>

      <Resposta a={a} />

      <Kpis a={a} />

      <BlocoGraficos a={a} />

      {a.simples ? <SecaoSimples a={a} /> : <SecaoSplit a={a} />}

      <section aria-labelledby="titulo-tabela">
        <h2 id="titulo-tabela" className="display text-2xl font-semibold text-ink">
          Ano a ano
        </h2>
        <div className="card mt-4 p-0 sm:p-2">
          <TabelaAnos a={a} />
        </div>
      </section>

      <Premissas a={a} />
    </div>
  );
}
