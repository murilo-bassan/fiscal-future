import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { emitenteDaEmpresa } from "@/lib/emissao/emitente";
import { notasNoMes } from "@/lib/emissao/servico";
import type { RascunhoNota, TipoNota } from "@/lib/emissao/tipos";
import { brl } from "@/components/app/formato";
import { BarraUso } from "@/components/billing/BarraUso";
import { ConviteDadosFiscais, ConviteUpgrade } from "@/components/notas/Convites";
import { SeloStatus } from "@/components/notas/Selos";
import { NOME_TIPO, dataHora } from "@/components/notas/rotulos";
import { empresaDoUsuario } from "../../dados";

export const metadata: Metadata = { title: "Notas fiscais" };

function destinatarioDe(payload: string) {
  try {
    return (JSON.parse(payload) as RascunhoNota).destinatario?.nome ?? "";
  } catch {
    return "";
  }
}

export default async function NotasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const { empresa } = await empresaDoUsuario(id, u.id);
  const base = `/app/empresas/${empresa.id}`;

  const [notas, usadas] = await Promise.all([
    db.notaFiscal.findMany({
      where: { empresaId: empresa.id, userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        tipo: true,
        numero: true,
        serie: true,
        status: true,
        valorTotal: true,
        ibsCbsTotal: true,
        payload: true,
        ambiente: true,
        provedor: true,
        createdAt: true,
      },
    }),
    notasNoMes(u.id),
  ]);

  const limite = plano(u.plano).notasMes;
  const situacao = emitenteDaEmpresa(empresa);
  const podeEmitir = limite > 0 && situacao.ok && usadas < limite;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href={base} className="text-sm text-muted hover:text-ink">
            {empresa.nome}
          </Link>
          <h1 className="display mt-1 text-2xl font-semibold text-ink sm:text-3xl">Notas fiscais</h1>
          {situacao.ok && (
            <p className="mt-1 text-sm text-muted">
              {situacao.emitente.provedor === "simulado"
                ? "Provedor simulado: as notas são de teste."
                : situacao.emitente.ambiente === "producao"
                  ? "Focus NFe, produção: notas com valor fiscal."
                  : "Focus NFe, homologação: notas de teste."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/fiscal`} className="btn-ghost">
            Dados fiscais
          </Link>
          {podeEmitir && (
            <Link href={`${base}/notas/nova`} className="btn-primary">
              Emitir nota
            </Link>
          )}
        </div>
      </header>

      {limite === 0 ? (
        <ConviteUpgrade />
      ) : (
        <div className="max-w-md">
          <BarraUso rotulo="Notas emitidas este mês (todas as empresas)" usados={usadas} limite={limite} />
          {usadas >= limite && (
            <p className="mt-2 text-sm text-ink">
              Limite do mês atingido.{" "}
              <Link href="/app/conta" className="font-semibold text-brand underline">
                Mudar de plano
              </Link>
            </p>
          )}
        </div>
      )}

      {!situacao.ok && <ConviteDadosFiscais empresaId={empresa.id} faltando={situacao.faltando} />}

      <section aria-labelledby="titulo-lista">
        <h2 id="titulo-lista" className="sr-only">
          Notas emitidas
        </h2>
        {notas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            Nenhuma nota emitida por esta empresa ainda.
            {podeEmitir && (
              <>
                {" "}
                <Link href={`${base}/notas/nova`} className="font-semibold text-brand underline">
                  Emitir a primeira
                </Link>
              </>
            )}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="hidden grid-cols-[7rem_1fr_8rem_7rem_8rem_8rem] gap-4 border-b border-line px-4 py-2 text-xs font-medium text-muted md:grid">
              <span>Nota</span>
              <span>Cliente</span>
              <span className="text-right">Valor</span>
              <span className="text-right">IBS/CBS</span>
              <span>Status</span>
              <span>Data</span>
            </div>
            <ul className="divide-y divide-line">
              {notas.map((n) => {
                const teste = n.ambiente !== "producao" || n.provedor === "simulado";
                return (
                  <li key={n.id}>
                    <Link
                      href={`${base}/notas/${n.id}`}
                      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-paper focus-visible:bg-paper focus-visible:outline-none md:grid-cols-[7rem_1fr_8rem_7rem_8rem_8rem] md:items-center"
                    >
                      <span className="font-medium text-ink tabular-nums">
                        {NOME_TIPO[n.tipo as TipoNota]} {n.numero ? `nº ${n.numero}` : ""}
                        {teste && <span className="ml-1 text-xs font-normal text-muted">(teste)</span>}
                      </span>
                      <span className="text-right font-semibold text-ink tabular-nums md:order-3">{brl(n.valorTotal, 2)}</span>
                      <span className="min-w-0 truncate text-muted md:order-2 md:text-ink">
                        {destinatarioDe(n.payload) || "Sem destinatário"}
                      </span>
                      <span className="text-right text-xs text-muted tabular-nums md:order-4 md:text-sm">
                        <span className="md:hidden">IBS/CBS </span>
                        {brl(n.ibsCbsTotal, 2)}
                      </span>
                      <span className="md:order-5">
                        <SeloStatus status={n.status} />
                      </span>
                      <span className="text-right text-xs text-muted tabular-nums md:order-6 md:text-left">
                        {dataHora(n.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
