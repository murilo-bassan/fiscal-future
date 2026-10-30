import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { plano } from "@/lib/planos";
import { emitenteDaEmpresa } from "@/lib/emissao/emitente";
import { notasNoMes as notasUsadasNoMes } from "@/lib/emissao/servico";
import { agruparPorMes, listarNotas, notasDoMes, notasDosUltimosMeses, rankingDestinatarios, variacao } from "@/lib/painel";
import { brl, brlCompacto } from "@/components/app/formato";
import { BarraUso } from "@/components/billing/BarraUso";
import { ConviteDadosFiscais, ConviteUpgrade } from "@/components/notas/Convites";
import { GraficoFaturamento } from "@/components/notas/GraficoFaturamento";
import { SeloStatus } from "@/components/notas/Selos";
import { NOME_TIPO, dataHora, ROTULO_STATUS } from "@/components/notas/rotulos";
import type { TipoNota } from "@/lib/emissao/tipos";
import { empresaDoUsuario } from "../../dados";

export const metadata: Metadata = { title: "Notas fiscais" };
type Params = Record<string, string | string[] | undefined>;
const primeiro = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
const brlInteiro = (v: number) => brlCompacto(v);
function dataMes(valor?: string, fim = false) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return undefined;
  const [ano, mes] = valor.split("-").map(Number);
  if (mes < 1 || mes > 12) return undefined;
  return new Date(ano, mes - 1 + (fim ? 1 : 0), 1);
}
function formatarVariacao(atual: number, anterior: number) {
  const v = variacao(atual, anterior);
  if (v === null) return atual > 0 ? "sem base anterior" : "sem variação";
  return `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior`;
}
function card(tema: string, valor: string, variacaoTexto: string) {
  return <div className="card min-w-0 p-4 sm:p-5"><p className="text-xs font-medium text-muted">{tema}</p><p className="mt-2 break-words text-xl font-semibold tracking-tight text-ink tabular-nums sm:text-2xl">{valor}</p><p className="mt-1 text-xs text-muted">{variacaoTexto}</p></div>;
}

export default async function NotasPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const u = await exigirUsuario();
  const { empresa } = await empresaDoUsuario(id, u.id);
  const base = `/app/empresas/${empresa.id}/notas`;
  const incluirTeste = primeiro(sp.incluirTeste) === "1";
  const status = primeiro(sp.status) ?? "";
  const tipo = primeiro(sp.tipo) ?? "";
  const busca = (primeiro(sp.busca) ?? "").trim();
  const periodo = primeiro(sp.periodo) ?? "";
  const pagina = Math.max(1, Number.parseInt(primeiro(sp.pagina) ?? "1", 10) || 1);
  const filtroPeriodo = dataMes(periodo);
  const filtroFim = dataMes(periodo, true);
  const [mesAtual, mesAnterior, serieBruta, listagem, usadas] = await Promise.all([
    notasDoMes(u.id, empresa.id, incluirTeste),
    notasDoMes(u.id, empresa.id, incluirTeste, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15)),
    notasDosUltimosMeses(u.id, empresa.id, incluirTeste),
    listarNotas(u.id, empresa.id, { status, tipo, busca, inicio: filtroPeriodo, fim: filtroFim, incluirTeste, pagina }),
    notasUsadasNoMes(u.id),
  ]);
  const resumoAtual = agruparPorMes(mesAtual, 1)[0];
  const resumoAnterior = agruparPorMes(mesAnterior, 1, new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15))[0];
  const rejeitadasErro = mesAtual.filter((n) => n.status === "rejeitada" || n.status === "erro").length;
  const rejeitadasErroAnt = mesAnterior.filter((n) => n.status === "rejeitada" || n.status === "erro").length;
  const serie = agruparPorMes(serieBruta);
  const ranking = rankingDestinatarios(mesAtual);
  const distribuicao = ["autorizada", "processando", "rejeitada", "erro", "cancelada"].map((s) => ({ status: s, total: mesAtual.filter((n) => n.status === s).length }));
  const limite = plano(u.plano).notasMes;
  const situacao = emitenteDaEmpresa(empresa);
  const podeEmitir = limite > 0 && situacao.ok && usadas < limite;
  const totalPaginas = Math.max(1, Math.ceil(listagem.total / 25));
  const urlPagina = (p: number) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (tipo) q.set("tipo", tipo);
    if (busca) q.set("busca", busca);
    if (periodo) q.set("periodo", periodo);
    if (incluirTeste) q.set("incluirTeste", "1");
    q.set("pagina", String(p));
    return `${base}?${q.toString()}`;
  };

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><Link href={`/app/empresas/${empresa.id}`} className="text-sm text-muted hover:text-ink">{empresa.nome}</Link><h1 className="display mt-1 text-2xl font-semibold text-ink sm:text-3xl">Notas fiscais</h1><p className="mt-1 text-sm text-muted">Visão mensal, faturamento autorizado e documentos emitidos.</p></div>
      <div className="flex flex-wrap gap-2"><Link href={`/app/empresas/${empresa.id}/fiscal`} className="btn-ghost">Dados fiscais</Link>{podeEmitir && <Link href={`${base}/nova`} className="btn-primary">Emitir nota</Link>}</div>
    </header>
    {limite === 0 ? <ConviteUpgrade /> : <div className="max-w-md"><BarraUso rotulo="Notas emitidas este mês (todas as empresas)" usados={usadas} limite={limite} />{usadas >= limite && <p className="mt-2 text-sm text-ink">Limite do mês atingido. <Link href="/app/conta" className="font-semibold text-brand underline">Mudar de plano</Link></p>}</div>}
    {!situacao.ok && <ConviteDadosFiscais empresaId={empresa.id} faltando={situacao.faltando} />}
    <section aria-label="Indicadores do mês" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-base font-semibold text-ink">Este mês</h2><p className="text-xs text-muted">Comparação com o mês anterior{incluirTeste ? " · incluindo notas de teste" : " · notas de teste excluídas"}</p></div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {card("Notas autorizadas", String(resumoAtual.notas), formatarVariacao(resumoAtual.notas, resumoAnterior.notas))}
        {card("Faturamento autorizado", brl(resumoAtual.faturamento), formatarVariacao(resumoAtual.faturamento, resumoAnterior.faturamento))}
        {card("IBS/CBS destacado", brl(resumoAtual.ibsCbs), formatarVariacao(resumoAtual.ibsCbs, resumoAnterior.ibsCbs))}
        {card("Rejeitadas + erro", String(rejeitadasErro), formatarVariacao(rejeitadasErro, rejeitadasErroAnt))}
      </div>
    </section>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
      <section className="card min-w-0 p-4 sm:p-5"><GraficoFaturamento dados={serie} /></section>
      <section className="card min-w-0 p-4 sm:p-5"><h2 className="text-sm font-semibold text-ink">Notas por status · mês atual</h2><ul className="mt-4 space-y-3">{distribuicao.map((d) => <li key={d.status} className="flex items-center justify-between gap-3 text-sm"><span className="text-muted">{ROTULO_STATUS[d.status as keyof typeof ROTULO_STATUS]}</span><span className="font-semibold tabular-nums text-ink">{d.total}</span></li>)}</ul><div className="mt-6 border-t border-line pt-4"><h3 className="text-sm font-semibold text-ink">5 principais destinatários</h3>{ranking.length ? <ol className="mt-3 space-y-3">{ranking.map((r, i) => <li key={r.destinatario} className="flex min-w-0 items-start gap-3 text-sm"><span className="text-xs text-muted tabular-nums">{i + 1}.</span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-ink">{r.destinatario}</span><span className="text-xs text-muted">{r.notas} {r.notas === 1 ? "nota" : "notas"}</span></span><span className="shrink-0 text-right text-xs font-semibold tabular-nums text-ink">{brlInteiro(r.faturamento)}</span></li>)}</ol> : <p className="mt-3 text-sm text-muted">Nenhum destinatário autorizado neste mês.</p>}</div></section>
    </div>
    <section aria-labelledby="titulo-lista" className="space-y-3">
      <div><h2 id="titulo-lista" className="text-lg font-semibold text-ink">Notas emitidas</h2><p className="text-xs text-muted">{listagem.total} documento{listagem.total === 1 ? "" : "s"} · página {pagina} de {totalPaginas}</p></div>
      <form action={base} method="get" className="card grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs font-medium text-muted">Status<select className="input" name="status" defaultValue={status}><option value="">Todos</option>{Object.entries(ROTULO_STATUS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label className="text-xs font-medium text-muted">Tipo<select className="input" name="tipo" defaultValue={tipo}><option value="">Todos</option><option value="nfe">NF-e</option><option value="nfse">NFS-e</option></select></label>
        <label className="text-xs font-medium text-muted">Mês<input className="input" type="month" name="periodo" defaultValue={periodo} /></label>
        <label className="col-span-2 text-xs font-medium text-muted sm:col-span-1">Número ou destinatário<input className="input" name="busca" defaultValue={busca} placeholder="Buscar nota ou cliente" /></label>
        <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm text-ink sm:col-span-1"><input type="checkbox" name="incluirTeste" value="1" defaultChecked={incluirTeste} className="size-4 accent-brand" />Incluir notas de teste</label>
        <button className="btn-primary self-end lg:col-span-1" type="submit">Filtrar</button>
      </form>
      {listagem.notas.length === 0 ? <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">Nenhuma nota encontrada com esses filtros.</p> : <div className="overflow-hidden rounded-xl border border-line bg-surface"><div className="hidden grid-cols-[7rem_minmax(0,1fr)_8rem_7rem_8rem_8rem] gap-4 border-b border-line px-4 py-2 text-xs font-medium text-muted md:grid"><span>Nota</span><span>Destinatário</span><span className="text-right">Valor</span><span className="text-right">IBS/CBS</span><span>Status</span><span>Data</span></div><ul className="divide-y divide-line">{listagem.notas.map((n) => <li key={n.id}><Link href={`${base}/${n.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm hover:bg-paper focus-visible:bg-paper focus-visible:outline-none md:grid-cols-[7rem_minmax(0,1fr)_8rem_7rem_8rem_8rem] md:items-center"><span className="min-w-0 truncate font-medium text-ink tabular-nums">{NOME_TIPO[n.tipo as TipoNota]} {n.numero ? `nº ${n.numero}` : ""}{(n.ambiente !== "producao" || n.provedor === "simulado") && <span className="ml-1 text-xs font-normal text-muted">(teste)</span>}</span><span className="text-right font-semibold text-ink tabular-nums md:order-3">{brl(n.valorTotal, 2)}</span><span className="min-w-0 truncate text-muted md:order-2 md:text-ink">{n.destinatario || "Sem destinatário"}</span><span className="text-right text-xs text-muted tabular-nums md:order-4 md:text-sm"><span className="md:hidden">IBS/CBS </span>{brl(n.ibsCbsTotal, 2)}</span><span className="md:order-5"><SeloStatus status={n.status} /></span><span className="text-right text-xs text-muted tabular-nums md:order-6 md:text-left">{dataHora(n.createdAt)}</span></Link></li>)}</ul></div>}
      {totalPaginas > 1 && <nav aria-label="Paginação das notas" className="flex items-center justify-between gap-3"><Link aria-disabled={pagina <= 1} className={`btn-ghost ${pagina <= 1 ? "pointer-events-none opacity-50" : ""}`} href={urlPagina(Math.max(1, pagina - 1))}>Anterior</Link><span className="text-xs text-muted">{pagina} / {totalPaginas}</span><Link aria-disabled={pagina >= totalPaginas} className={`btn-ghost ${pagina >= totalPaginas ? "pointer-events-none opacity-50" : ""}`} href={urlPagina(Math.min(totalPaginas, pagina + 1))}>Próxima</Link></nav>}
    </section>
  </div>;
}
