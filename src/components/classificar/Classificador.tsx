"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ItemClassificado, ResultadoClassificacao } from "@/lib/classificador";
import { gerarCsv, lerDescricoes } from "@/lib/csv";
import { REDUCOES } from "@/lib/tax/params";
import { ROTULO_CONFIANCA, ROTULO_REDUCAO } from "./rotulos";
import { TabelaResultados } from "./TabelaResultados";

type Props = {
  lote: boolean;
  usados: number;
  limite: number;
  iaAtiva: boolean;
};

type Resposta = ResultadoClassificacao & { uso: { usados: number; limite: number } };

const MAX_LOTE = 500;

export function Classificador({ lote, usados: usadosIniciais, limite, iaAtiva }: Props) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [aba, setAba] = useState<"um" | "lote">("um");
  const [um, setUm] = useState("");
  const [varios, setVarios] = useState("");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [resultado, setResultado] = useState<Resposta | null>(null);
  const [usados, setUsados] = useState(usadosIniciais);

  const restantes = Math.max(limite - usados, 0);
  const itensLote = aba === "lote" ? lerDescricoes(varios) : [];

  async function enviar(itens: string[]) {
    setErro(null);
    if (itens.length === 0) return setErro({ msg: "Escreva pelo menos um item." });
    if (itens.some((i) => i.length < 2 || i.length > 300)) {
      return setErro({ msg: "Cada descrição precisa ter de 2 a 300 caracteres." });
    }
    if (itens.length > MAX_LOTE) return setErro({ msg: `Envie no máximo ${MAX_LOTE} itens por vez.` });
    if (itens.length > restantes) {
      return setErro({
        msg:
          restantes === 0
            ? "Você já usou todas as classificações deste mês."
            : `Restam ${restantes} classificações neste mês e a lista tem ${itens.length} itens.`,
        upgrade: true,
      });
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/classificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens }),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) {
        setErro({ msg: dados?.erro ?? "Não foi possível classificar agora.", upgrade: res.status === 402 });
        if (dados?.uso) setUsados(dados.uso.usados);
        return;
      }
      setResultado(dados as Resposta);
      setUsados((dados as Resposta).uso.usados);
      router.refresh(); // atualiza o histórico
    } catch {
      setErro({ msg: "Falha de conexão. Tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) {
      setErro({ msg: "Arquivo grande demais (máx. 2 MB)." });
      return;
    }
    const descricoes = lerDescricoes(await f.text());
    setVarios(descricoes.join("\n"));
    setNomeArquivo(f.name);
    setErro(null);
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ContadorUso usados={usados} limite={limite} />
          {!iaAtiva && (
            <p className="rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-ink">
              IA desligada: classificação só por palavras-chave.
            </p>
          )}
        </div>

        {lote && (
          <div role="tablist" className="inline-flex rounded-lg border border-line p-0.5 text-sm">
            {(
              [
                ["um", "Um item"],
                ["lote", "Vários itens ou CSV"],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className={`rounded-md px-3 py-1.5 font-medium ${aba === id ? "bg-brand-soft text-brand-strong" : "text-muted hover:text-ink"}`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {aba === "um" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar([um.replace(/\s+/g, " ").trim()]);
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="item" className="label">
                Produto ou serviço
              </label>
              <input
                id="item"
                className="input"
                value={um}
                onChange={(e) => setUm(e.target.value)}
                maxLength={300}
                placeholder="Ex.: arroz branco tipo 1, 5 kg"
                autoComplete="off"
              />
              <p className="hint">Descreva como aparece na nota: o que é, para que serve, de que é feito.</p>
            </div>
            <button className="btn-primary" disabled={enviando || um.trim().length < 2}>
              {enviando ? "Classificando…" : "Classificar"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(itensLote);
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="varios" className="label">
                Um item por linha
              </label>
              <textarea
                id="varios"
                className="input min-h-48 font-mono text-xs"
                value={varios}
                onChange={(e) => {
                  setVarios(e.target.value);
                  setNomeArquivo(null);
                }}
                placeholder={"arroz branco tipo 1, 5 kg\nconsultoria contábil mensal\ncamiseta de algodão"}
              />
              <p className="hint">
                Ou envie um CSV com uma descrição por linha, ou com uma coluna chamada “descricao”. Itens repetidos
                são ignorados. Máximo de {MAX_LOTE} por vez.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={arquivoRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={lerArquivo}
                aria-label="Enviar arquivo CSV"
              />
              <button type="button" className="btn-ghost" onClick={() => arquivoRef.current?.click()}>
                Enviar CSV
              </button>
              {nomeArquivo && <span className="text-xs text-muted">{nomeArquivo}</span>}
              <span className="text-xs text-muted">
                {itensLote.length} {itensLote.length === 1 ? "item" : "itens"}
              </span>
              <button className="btn-primary ml-auto" disabled={enviando || itensLote.length === 0}>
                {enviando ? "Classificando…" : `Classificar ${itensLote.length || ""}`.trim()}
              </button>
            </div>
          </form>
        )}

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

        {!lote && (
          <p className="text-xs text-muted">
            Tem uma planilha de produtos?{" "}
            <Link href="/app/conta?assinar=profissional" className="font-medium text-brand underline">
              No plano Profissional
            </Link>{" "}
            você classifica centenas de itens de uma vez.
          </p>
        )}
      </div>

      {resultado && (
        <section aria-live="polite" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              Resultado{" "}
              <span className="font-normal text-muted">
                ({resultado.itens.length} {resultado.itens.length === 1 ? "item" : "itens"},{" "}
                {resultado.modo === "ia" ? "com IA" : "por palavras-chave"})
              </span>
            </h2>
            <button type="button" className="btn-ghost" onClick={() => baixarCsv(resultado.itens)}>
              Baixar CSV
            </button>
          </div>
          {resultado.aviso && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">{resultado.aviso}</p>}
          <TabelaResultados itens={resultado.itens} />
          <p className="text-xs text-muted">
            Este resultado é um ponto de partida, não um parecer. Confira o NCM/NBS e o texto da LC 214/2025 com o seu
            contador antes de emitir nota.
          </p>
        </section>
      )}
    </div>
  );
}

export function ContadorUso({ usados, limite }: { usados: number; limite: number }) {
  const frac = limite > 0 ? Math.min(usados / limite, 1) : 1;
  const cheio = usados >= limite;
  return (
    <div className="min-w-56">
      <p className="text-sm text-ink">
        <span className="font-semibold">{usados.toLocaleString("pt-BR")}</span>
        <span className="text-muted"> de {limite.toLocaleString("pt-BR")} classificações neste mês</span>
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${cheio ? "bg-bad" : "bg-brand"}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

function baixarCsv(itens: ItemClassificado[]) {
  const csv = gerarCsv([
    ["descricao", "tratamento", "reducao", "categoria", "confianca", "regime_especifico", "justificativa", "conferir", "origem"],
    ...itens.map((r) => [
      r.descricao,
      ROTULO_REDUCAO[r.reducao],
      `${Math.round(REDUCOES[r.reducao].reducao * 100)}%`,
      r.categoriaNome,
      ROTULO_CONFIANCA[r.confianca],
      r.regimeEspecifico ?? "",
      r.justificativa,
      r.conferir,
      r.origem === "ia" ? "IA" : "palavras-chave",
    ]),
  ]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `classificacao-zeroabi-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
