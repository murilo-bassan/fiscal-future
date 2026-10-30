"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { PRESETS } from "@/lib/tax/params";
import {
  ANOS_CONVERSAO,
  EXPLICACAO_ANO,
  MAX_ARQUIVOS,
  validarArquivo,
  type AnoConversao,
  type ConversaoView,
  type ResumoConversao,
} from "./modelo";
import { ResultadoNota, type EmpresaOpcao } from "./ResultadoNota";
import { HistoricoConversoes, Variacao } from "./HistoricoConversoes";

type ResultadoEnvio = { arquivo: string; conversao: ConversaoView } | { arquivo: string; erro: string };

type Props = {
  lote: boolean;
  usados: number;
  limite: number;
  iaAtiva: boolean;
  empresas: EmpresaOpcao[];
  historico: ResumoConversao[];
  cenarioPadrao: string;
};

const paraResumo = (c: ConversaoView): ResumoConversao => ({
  id: c.id,
  numero: c.resultado.nota.numero,
  emitente: c.resultado.nota.emitente.nome || c.resultado.nota.emitente.documento,
  ano: c.resultado.ano,
  createdAt: c.createdAt,
  variacao: c.resultado.totais.variacao,
  exemplo: c.exemplo,
});

export function Conversor(props: Props) {
  const { lote, limite, iaAtiva, empresas } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [ano, setAno] = useState<AnoConversao>(2027);
  const [cenarioId, setCenarioId] = useState(props.cenarioPadrao);
  const [empresaId, setEmpresaId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usados, setUsados] = useState(props.usados);
  const [envio, setEnvio] = useState<ResultadoEnvio[]>([]);
  const [atual, setAtual] = useState<ConversaoView | null>(null);
  const [historico, setHistorico] = useState(props.historico);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const restantes = Math.max(limite - usados, 0);

  function escolher(lista: FileList | File[]) {
    setErro(null);
    let novos = [...lista];
    if (!lote && novos.length > 1) {
      setErro({ msg: "No seu plano a conversão é de 1 nota por vez. Ficamos com o primeiro arquivo.", upgrade: true });
      novos = novos.slice(0, 1);
    }
    const ruins = novos.map((f) => [f.name, validarArquivo(f)] as const).filter(([, e]) => e);
    if (ruins.length) setErro({ msg: `${ruins[0][0]}: ${ruins[0][1]}` });
    novos = novos.filter((f) => !validarArquivo(f));
    const juntos = lote ? [...arquivos, ...novos].filter((f, i, a) => a.findIndex((x) => x.name === f.name && x.size === f.size) === i) : novos;
    if (juntos.length > MAX_ARQUIVOS) setErro({ msg: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.` });
    setArquivos(juntos.slice(0, MAX_ARQUIVOS));
  }

  function lembrar(c: ConversaoView) {
    setHistorico((h) => [paraResumo(c), ...h.filter((x) => x.id !== c.id)].slice(0, 20));
  }

  async function enviar(exemplo = false) {
    setErro(null);
    setAviso(null);
    if (!exemplo && arquivos.length === 0) return setErro({ msg: "Escolha pelo menos um arquivo .xml." });
    if (!exemplo && arquivos.length > restantes) {
      return setErro({
        msg:
          restantes === 0
            ? "Você já usou todas as conversões deste mês."
            : `Restam ${restantes} conversões neste mês e você escolheu ${arquivos.length} arquivos.`,
        upgrade: true,
      });
    }

    const form = new FormData();
    form.set("ano", String(ano));
    form.set("cenarioId", cenarioId);
    if (empresaId) form.set("empresaId", empresaId);
    if (exemplo) form.set("exemplo", "1");
    else for (const f of arquivos) form.append("arquivos", f);

    setEnviando(true);
    try {
      const res = await fetch("/api/converter", { method: "POST", body: form });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        setErro({ msg: dados?.erro ?? "Não foi possível converter agora.", upgrade: res.status === 402 });
        if (dados?.uso) setUsados(dados.uso.usados);
        return;
      }
      const lista = (dados.resultados ?? []) as ResultadoEnvio[];
      setEnvio(lista);
      setUsados(dados.uso.usados);
      setAviso(dados.aviso ?? null);
      const ok = lista.filter((x): x is Extract<ResultadoEnvio, { conversao: ConversaoView }> => "conversao" in x);
      for (const x of [...ok].reverse()) lembrar(x.conversao);
      setAtual(ok[0]?.conversao ?? null);
      if (ok.length) {
        setArquivos([]);
        requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch {
      setErro({ msg: "Falha de conexão. Tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(id: string) {
    setErro(null);
    setAbrindo(id);
    try {
      const res = await fetch(`/api/converter/${id}`);
      const dados = await res.json().catch(() => null);
      if (!res.ok) return setErro({ msg: dados?.erro ?? "Não foi possível abrir esta conversão." });
      setAtual(dados as ConversaoView);
      setEnvio([]);
      requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setErro({ msg: "Falha de conexão. Tente de novo." });
    } finally {
      setAbrindo(null);
    }
  }

  function atualizada(c: ConversaoView) {
    setAtual(c);
    lembrar(c);
    setEnvio((l) => l.map((x) => ("conversao" in x && x.conversao.id === c.id ? { ...x, conversao: c } : x)));
  }

  return (
    <div className="space-y-10">
      <form
        className="card space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Área de envio */}
          <div>
            <label
              htmlFor="xmls"
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                escolher(e.dataTransfer.files);
              }}
              className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-brand ${
                arrastando ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-ink/40"
              }`}
            >
              <span className="text-base font-semibold text-ink">
                {lote ? "Arraste os XMLs das notas aqui" : "Arraste o XML da nota aqui"}
              </span>
              <span className="text-sm text-muted">
                ou <span className="font-medium text-brand underline">escolha no computador</span>
              </span>
              <span className="text-xs text-muted">
                NF-e ou NFC-e, até 2 MB cada{lote ? `, até ${MAX_ARQUIVOS} por vez` : ", 1 por vez"}
              </span>
              <input
                id="xmls"
                ref={inputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple={lote}
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) escolher(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>

            {arquivos.length > 0 && (
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                {arquivos.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-1.5">
                    <span className="truncate text-ink">{f.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs text-muted hover:text-bad"
                      onClick={() => setArquivos((a) => a.filter((x) => x !== f))}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!lote && (
              <p className="mt-3 text-xs text-muted">
                Quer converter um mês inteiro de notas?{" "}
                <Link href="/app/conta?assinar=profissional" className="font-medium text-brand underline">
                  No plano Profissional
                </Link>{" "}
                você envia até {MAX_ARQUIVOS} de uma vez.
              </p>
            )}
          </div>

          {/* Opções */}
          <div className="space-y-5">
            <fieldset>
              <legend className="label">Comparar com o ano</legend>
              <div className="mt-2 grid gap-2">
                {ANOS_CONVERSAO.map((a) => (
                  <label
                    key={a}
                    className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/30 ${
                      ano === a ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ano"
                      value={a}
                      checked={ano === a}
                      onChange={() => setAno(a)}
                      className="mt-1 accent-brand"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        {a} <span className="font-normal text-muted">{EXPLICACAO_ANO[a].titulo}</span>
                      </span>
                      <span className="block text-xs text-muted">{EXPLICACAO_ANO[a].texto}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cenario" className="label">
                  Cenário de alíquota
                </label>
                <select id="cenario" className="input" value={cenarioId} onChange={(e) => setCenarioId(e.target.value)}>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="empresa" className="label">
                  Empresa <span className="font-normal text-muted">(opcional)</span>
                </label>
                <select id="empresa" className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
                <p className="hint">Ligar a uma empresa libera a emissão da próxima nota.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <ContadorConversoes usados={usados} limite={limite} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!iaAtiva && <span className="text-xs text-muted">IA desligada: itens classificados por palavras-chave.</span>}
            <button className="btn-primary" disabled={enviando || arquivos.length === 0}>
              {enviando
                ? "Convertendo…"
                : arquivos.length > 1
                  ? `Converter ${arquivos.length} notas`
                  : "Converter nota"}
            </button>
          </div>
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {erro.msg}{" "}
            {erro.upgrade && (
              <Link href="/app/conta" className="font-semibold underline">
                Ver planos
              </Link>
            )}
          </p>
        )}
      </form>

      <div ref={resultadoRef} className="scroll-mt-6 space-y-6" aria-live="polite">
        {aviso && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">{aviso}</p>}

        {envio.length > 1 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-ink">Notas enviadas</h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {envio.map((x, i) =>
                "conversao" in x ? (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setAtual(x.conversao)}
                      aria-current={atual?.id === x.conversao.id ? "true" : undefined}
                      className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left ${
                        atual?.id === x.conversao.id ? "bg-brand-soft" : "hover:bg-paper"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          Nota {x.conversao.resultado.nota.numero}, {x.conversao.resultado.nota.emitente.nome}
                        </span>
                        <span className="block truncate text-xs text-muted">{x.arquivo}</span>
                      </span>
                      <Variacao v={x.conversao.resultado.totais.variacao} ano={x.conversao.resultado.ano} />
                    </button>
                  </li>
                ) : (
                  <li key={i} className="px-4 py-3">
                    <span className="block truncate text-sm font-medium text-ink">{x.arquivo}</span>
                    <span className="block text-xs text-bad">{x.erro}</span>
                  </li>
                ),
              )}
            </ul>
          </section>
        )}

        {envio.length === 1 && "erro" in envio[0] && (
          <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {envio[0].arquivo}: {envio[0].erro}
          </p>
        )}

        {atual ? (
          <ResultadoNota key={atual.id} conversao={atual} empresas={empresas} onAtualizada={atualizada} />
        ) : (
          <EstadoVazio enviando={enviando} onExemplo={() => enviar(true)} />
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Últimas conversões</h2>
        <HistoricoConversoes itens={historico} atual={atual?.id ?? null} abrindo={abrindo} onAbrir={abrir} />
      </section>
    </div>
  );
}

function EstadoVazio({ enviando, onExemplo }: { enviando: boolean; onExemplo: () => void }) {
  return (
    <section className="rounded-xl border border-dashed border-line px-5 py-8 sm:px-8">
      <h2 className="display text-xl text-ink">Veja como uma nota fica no modelo novo</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Envie o XML de uma nota que você já emitiu. Mostramos o IBS e a CBS de cada item, quanto a mesma venda pagaria
        de tributo no ano escolhido e o XML no layout novo, para você ajustar o cadastro do ERP. Não tem um XML à mão?
        Use a nota de exemplo, que não conta no seu limite.
      </p>
      <button type="button" className="btn-ghost mt-5" disabled={enviando} onClick={onExemplo}>
        {enviando ? "Convertendo…" : "Testar com uma nota de exemplo"}
      </button>
    </section>
  );
}

function ContadorConversoes({ usados, limite }: { usados: number; limite: number }) {
  const frac = limite > 0 ? Math.min(usados / limite, 1) : 1;
  const cheio = usados >= limite;
  return (
    <div className="min-w-56">
      <p className="text-sm text-ink">
        <span className="font-semibold">{usados.toLocaleString("pt-BR")}</span>
        <span className="text-muted"> de {limite.toLocaleString("pt-BR")} notas convertidas neste mês</span>
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${cheio ? "bg-bad" : "bg-brand"}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}
