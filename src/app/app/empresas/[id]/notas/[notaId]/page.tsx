import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CalculoRascunho } from "@/lib/emissao/calculo";
import { formatarChave } from "@/lib/emissao/chave";
import type { RascunhoNota, TipoNota } from "@/lib/emissao/tipos";
import { brl } from "@/components/app/formato";
import { AcoesNota } from "@/components/notas/AcoesNota";
import { PreviaTributos } from "@/components/notas/PreviaTributos";
import { FaixaSemValor, SeloStatus } from "@/components/notas/Selos";
import { NOME_TIPO, dataHora, formatarDocumento } from "@/components/notas/rotulos";
import { atualizarStatusAction, cancelarNotaAction, retentarNotaAction } from "../actions";

export const metadata: Metadata = { title: "Nota fiscal" };

function ler<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** DANFE só por link https do provedor. */
const linkSeguro = (u: string | null) => (u && /^https:\/\//.test(u) ? u : undefined);

export default async function NotaPage({ params }: { params: Promise<{ id: string; notaId: string }> }) {
  const { id, notaId } = await params;
  const u = await exigirUsuario();
  const nota = await db.notaFiscal.findFirst({
    where: { id: notaId, empresaId: id, userId: u.id },
    include: { empresa: { select: { nome: true } } },
  });
  if (!nota) notFound();

  const rascunho = ler<RascunhoNota>(nota.payload);
  const calculo = ler<CalculoRascunho>(nota.calculo);
  const tipo = nota.tipo as TipoNota;
  const base = `/app/empresas/${id}/notas`;
  const titulo = nota.numero ? `${NOME_TIPO[tipo]} nº ${nota.numero}` : `${NOME_TIPO[tipo]} sem número`;
  const temXml = !!nota.xml || !!linkSeguro(nota.xmlUrl);

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link href={base} className="text-sm text-muted hover:text-ink">
          Notas de {nota.empresa.nome}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="display text-2xl font-semibold text-ink sm:text-3xl">{titulo}</h1>
          <SeloStatus status={nota.status} />
        </div>
        <FaixaSemValor ambiente={nota.ambiente} provedor={nota.provedor} />
        {nota.mensagem && (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              nota.status === "rejeitada" || nota.status === "erro" ? "bg-bad-soft text-bad" : "bg-paper text-ink border border-line"
            }`}
          >
            {nota.mensagem}
          </p>
        )}
        {nota.status === "processando" && (
          <p className="text-sm text-muted">
            A SEFAZ ou a prefeitura ainda está analisando. Costuma levar segundos; use Atualizar status.
          </p>
        )}
        <AcoesNota
          status={nota.status}
          xmlHref={temXml ? `/api/notas/${nota.id}/xml` : undefined}
          danfeHref={linkSeguro(nota.danfeUrl)}
          atualizar={atualizarStatusAction.bind(null, id, nota.id)}
          cancelar={cancelarNotaAction.bind(null, id, nota.id)}
          retentar={retentarNotaAction.bind(null, id, nota.id)}
        />
      </header>

      <section aria-labelledby="titulo-dados" className="rounded-xl border border-line bg-surface p-5">
        <h2 id="titulo-dados" className="sr-only">
          Dados da nota
        </h2>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-muted">Chave de acesso</dt>
            <dd className="mt-0.5 text-base font-medium tracking-wide text-ink tabular-nums break-words">
              {nota.chave ? formatarChave(nota.chave) : "Ainda não gerada"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Protocolo</dt>
            <dd className="font-medium text-ink tabular-nums">{nota.protocolo ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted">Série</dt>
            <dd className="font-medium text-ink tabular-nums">{nota.serie ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted">Emitida em</dt>
            <dd className="font-medium text-ink tabular-nums">{dataHora(nota.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Provedor</dt>
            <dd className="font-medium text-ink">
              {nota.provedor === "simulado" ? "Simulado" : "Focus NFe"}, {nota.ambiente === "producao" ? "produção" : "homologação"}
            </dd>
          </div>
          {rascunho && (
            <>
              <div>
                <dt className="text-muted">Cliente</dt>
                <dd className="font-medium text-ink">
                  {rascunho.destinatario.nome}
                  <span className="block font-normal text-muted tabular-nums">
                    {formatarDocumento(rascunho.destinatario.documento)}
                    {rascunho.destinatario.consumidorFinal ? ", consumidor final" : ""}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Natureza da operação</dt>
                <dd className="font-medium text-ink">{rascunho.naturezaOperacao}</dd>
              </div>
            </>
          )}
          {nota.origemChave && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Criada a partir da nota antiga</dt>
              <dd className="text-ink tabular-nums break-words">{formatarChave(nota.origemChave)}</dd>
            </div>
          )}
        </dl>
      </section>

      {rascunho && calculo ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section aria-labelledby="titulo-itens">
            <h2 id="titulo-itens" className="display text-xl font-semibold text-ink">
              Itens
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Descrição</th>
                    <th className="px-3 py-2 font-medium">{tipo === "nfe" ? "NCM / CFOP" : "Serviço / NBS"}</th>
                    <th className="px-3 py-2 font-medium">CST / cClassTrib</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 text-right font-medium">IBS</th>
                    <th className="px-3 py-2 text-right font-medium">CBS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {rascunho.itens.map((it, i) => {
                    const ci = calculo.itens[i];
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 text-ink">
                          {it.descricao}
                          <span className="block text-xs text-muted">
                            {it.quantidade.toLocaleString("pt-BR")} {it.unidade} × {brl(it.valorUnitario, 2)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {tipo === "nfe" ? `${it.ncm} / ${it.cfop}` : `${it.codigoServico} / ${it.nbs ?? "-"}`}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {ci?.ibsCbs.cst} / {ci?.ibsCbs.cClassTrib}
                        </td>
                        <td className="px-3 py-2 text-right text-ink">{brl(ci?.valor ?? 0, 2)}</td>
                        <td className="px-3 py-2 text-right text-ink">{brl(ci?.ibsCbs.vIBS ?? 0, 2)}</td>
                        <td className="px-3 py-2 text-right text-ink">{brl(ci?.ibsCbs.cbs.valor ?? 0, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <PreviaTributos
            tipo={tipo}
            calculo={calculo}
            descricoes={rascunho.itens.map((i) => i.descricao)}
            titulo="Tributos destacados"
          />
        </div>
      ) : (
        <p className="text-sm text-muted">Não conseguimos ler os itens desta nota.</p>
      )}
    </div>
  );
}
