import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { plano } from "@/lib/planos";
import { analisar, recomendacoes } from "@/components/app/analise";
import { BotaoImprimir } from "@/components/app/BotaoImprimir";
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
import { cenarioPorId, empresaDoUsuario } from "../../dados";

export const metadata: Metadata = { title: "Relatório" };

/*
 * A folha usa sempre as cores do tema claro (é um documento para imprimir) e
 * formato A4. As variáveis são redefinidas só dentro de .folha, sem tocar no tema global.
 */
const CSS = `
.folha {
  --paper: #ffffff; --surface: #ffffff; --ink: #15181c; --muted: #5d6570; --line: #e3e3dc;
  --brand: #0d7a5f; --brand-strong: #075e48; --brand-soft: #e3f2ec; --accent: #f0b23a;
  --accent-soft: #fdf3dd; --bad: #b8431b; --bad-soft: #fbe9e1; --good: #137a3a; --good-soft: #e3f3e8;
  background: var(--paper); color: var(--ink);
}
.folha .quebra { break-before: page; }
@page { size: A4; margin: 14mm 14mm 16mm; }
@media print {
  html, body { background: #fff !important; }
  main { padding: 0 !important; max-width: none !important; }
  .folha { box-shadow: none !important; border: 0 !important; padding: 0 !important; width: auto !important; }
  .folha .capa { min-height: 255mm; }
  .folha table { font-size: 9pt; }
  .folha .overflow-x-auto { overflow: visible !important; }
}
`;

export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cenario?: string | string[] }>;
}) {
  const [{ id }, sp, u] = await Promise.all([params, searchParams, exigirUsuario()]);
  const p = plano(u.plano);
  if (!p.relatorioPdf) redirect("/app/conta");

  const { empresa, perfil } = await empresaDoUsuario(id, u.id);
  if (!perfil) redirect(`/app/empresas/${empresa.id}/editar`);

  const pedido = Array.isArray(sp.cenario) ? sp.cenario[0] : sp.cenario;
  const cenario = cenarioPorId(pedido ?? empresa.cenarioId);
  const a = analisar(perfil, cenario);
  const recs = recomendacoes(a);
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const escritorio = p.marcaPropria && u.escritorio?.trim() ? u.escritorio.trim() : null;
  const cnpj = empresa.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  return (
    <>
      <style>{CSS}</style>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/app/empresas/${empresa.id}`} className="text-sm text-muted hover:text-ink">
          Voltar para o resultado
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">No diálogo de impressão, escolha “Salvar como PDF”.</span>
          <BotaoImprimir />
        </div>
      </div>

      <article className="folha mx-auto max-w-[210mm] rounded-sm border border-line px-5 py-8 shadow-sm sm:px-[14mm] sm:py-[16mm]">
        {/* Capa */}
        <section className="capa flex flex-col">
          {escritorio && (
            <p className="border-b border-line pb-3 text-sm text-muted">
              Preparado por <span className="font-semibold text-ink">{escritorio}</span>
            </p>
          )}
          <div className="flex flex-1 flex-col justify-center py-16">
            <p className="text-sm text-muted">Impacto da Reforma Tributária, 2026 a 2033</p>
            <h1 className="display mt-3 text-4xl font-semibold leading-tight text-ink sm:text-5xl">{empresa.nome}</h1>
            <p className="mt-3 text-base text-muted">
              {NOMES_REGIME[perfil.regime]}, {NOMES_ATIVIDADE[perfil.atividade].toLowerCase()}
              {cnpj ? `, CNPJ ${cnpj}` : ""}
            </p>
          </div>
          <dl className="grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Data</dt>
              <dd className="text-ink">{hoje}</dd>
            </div>
            <div>
              <dt className="text-muted">Cenário de alíquota</dt>
              <dd className="text-ink">{cenario.nome}</dd>
            </div>
            <div>
              <dt className="text-muted">Base legal</dt>
              <dd className="text-ink">EC 132/2023 e LC 214/2025</dd>
            </div>
          </dl>
        </section>

        {/* Sumário executivo */}
        <section className="quebra space-y-8 pt-10 print:pt-0">
          <h2 className="text-sm font-semibold text-muted">Sumário executivo</h2>
          <Resposta a={a} compacto />
          <Kpis a={a} />
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="display text-2xl font-semibold text-ink">Evolução até 2033</h2>
          <BlocoGraficos a={a} impressao />
        </section>

        <div className="quebra mt-10 print:mt-0">
          {a.simples ? <SecaoSimples a={a} /> : <SecaoSplit a={a} />}
        </div>

        <section className="mt-10 break-inside-avoid">
          <h2 className="display text-2xl font-semibold text-ink">Ano a ano</h2>
          <div className="mt-4">
            <TabelaAnos a={a} />
          </div>
        </section>

        <section className="mt-10 break-inside-avoid">
          <h2 className="display text-2xl font-semibold text-ink">Recomendações</h2>
          <ol className="mt-4 space-y-3">
            {recs.map((r, i) => (
              <li key={r} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm text-ink">
                <span className="font-semibold tabular-nums text-brand">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-10">
          <Premissas a={a} />
        </div>

        <footer className="mt-10 border-t border-line pt-3 text-xs text-muted">
          {escritorio ? `Preparado por ${escritorio} com ZeroAbi` : "Gerado com ZeroAbi"} em {hoje}.
        </footer>
      </article>
    </>
  );
}
