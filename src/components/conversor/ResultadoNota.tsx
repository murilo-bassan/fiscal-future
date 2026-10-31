"use client";

import Link from "next/link";
import { useState } from "react";
import { ANOS_CONVERSAO, conferirConversao, type Ajuste, type ConversaoView } from "./modelo";
import { Comparacao } from "./Comparacao";
import { ItensNota } from "./ItensNota";

export type EmpresaOpcao = { id: string; nome: string };

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function documento(d: string) {
  if (/^\d{14}$/.test(d)) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (/^\d{11}$/.test(d)) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d;
}

export function ResultadoNota({
  conversao,
  empresas,
  onAtualizada,
}: {
  conversao: ConversaoView;
  empresas: EmpresaOpcao[];
  onAtualizada: (c: ConversaoView) => void;
}) {
  const r = conversao.resultado;
  const n = r.nota;
  const [salvando, setSalvando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [empresaEscolhida, setEmpresaEscolhida] = useState(empresas[0]?.id ?? "");

  async function ajustar(corpo: Ajuste, item: number | null = null) {
    setErro(null);
    setOcupado(true);
    setSalvando(item ?? -1);
    try {
      const res = await fetch(`/api/converter/${conversao.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const dados = await res.json().catch(() => null);
      if (!res.ok) return setErro(dados?.erro ?? "Não foi possível recalcular agora.");
      onAtualizada(dados as ConversaoView);
    } catch {
      setErro("Falha de conexão. Tente de novo.");
    } finally {
      setOcupado(false);
      setSalvando(null);
    }
  }

  const conferencia = conferirConversao(r);
  const base = `/api/converter/${conversao.id}`;
  const empresaVinculada = empresas.find((e) => e.id === conversao.empresaId);

  return (
    <article className="space-y-5" aria-labelledby={`nota-${conversao.id}`}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id={`nota-${conversao.id}`} className="display text-2xl text-ink">
            {n.modelo === "65" ? "NFC-e" : n.modelo === "nfse" ? "NFS-e" : "NF-e"} {n.numero}
            <span className="ml-2 text-base text-muted">série {n.serie}</span>
          </h2>
          {n.emissao && <p className="text-sm text-muted">Emitida em {data.format(new Date(n.emissao))}</p>}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Emitente</dt>
            <dd className="text-ink">{n.emitente.nome || "Sem nome"}</dd>
            <dd className="text-xs text-muted">{documento(n.emitente.documento)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Destinatário</dt>
            <dd className="text-ink">{n.destinatario?.nome || "Consumidor não identificado"}</dd>
            {n.destinatario?.documento && <dd className="text-xs text-muted">{documento(n.destinatario.documento)}</dd>}
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Chave de acesso</dt>
            <dd className="font-mono text-xs break-all text-ink">{n.chave}</dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Ver no ano</span>
        <div role="group" aria-label="Ano de comparação" className="inline-flex rounded-lg border border-line bg-surface p-1">
          {ANOS_CONVERSAO.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={r.ano === a}
              disabled={ocupado}
              onClick={() => r.ano !== a && ajustar({ ano: a })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                r.ano === a ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        {salvando === -1 && <span className="text-xs text-muted">Recalculando…</span>}
      </div>

      <Comparacao r={r} />
      <p className="sr-only">
        Tributos na nota original: {r.totais.tributosOriginais.toFixed(2)} reais. No modelo de {r.ano}:{" "}
        {r.totais.totalNoAno.toFixed(2)} reais.
      </p>

      {erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {erro}
        </p>
      )}

      <ul className="space-y-2 text-sm">
        {r.avisos.map((a, i) => (
          <li key={i} className={`rounded-lg px-3 py-2 ${i === 0 ? "border border-line bg-surface text-ink" : "bg-accent-soft text-ink"}`}>
            {a}
          </li>
        ))}
      </ul>

      <section
        aria-label="Conferência"
        className={`rounded-lg px-4 py-3 text-sm text-ink ${conferencia.ok ? "bg-good-soft" : "bg-accent-soft"}`}
      >
        <p className="font-semibold">
          {conferencia.ok
            ? "Conferência ok: códigos do IBS/CBS no formato, NCM válido e totais batendo com os itens."
            : `${conferencia.pendencias.length} ${conferencia.pendencias.length === 1 ? "pendência" : "pendências"} antes de usar estes valores`}
        </p>
        {!conferencia.ok && (
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {conferencia.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-muted">
          A conferência evita erros de cálculo e de código. Quem autoriza uma nota é a SEFAZ ou a prefeitura, na emissão.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <a href={`${base}/pdf`} className="btn-ghost" download>
          Baixar PDF
        </a>
        <a href={`${base}/xml`} className="btn-ghost" download>
          Baixar XML no modelo novo
        </a>
        <a href={`${base}/csv`} className="btn-ghost" download>
          Baixar CSV
        </a>
        {conversao.exemplo ? (
          <p className="text-xs text-muted sm:ml-auto">Na nota de exemplo a emissão fica desligada.</p>
        ) : conversao.empresaId ? (
          <Link
            href={`/app/empresas/${conversao.empresaId}/notas/nova?conversao=${conversao.id}`}
            className="btn-primary sm:ml-auto"
          >
            Emitir a próxima nota já no modelo novo
          </Link>
        ) : empresas.length > 0 ? (
          <form
            className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (empresaEscolhida) ajustar({ empresaId: empresaEscolhida });
            }}
          >
            <label htmlFor={`emp-${conversao.id}`} className="text-sm text-muted">
              Para emitir, ligue a uma empresa
            </label>
            <select
              id={`emp-${conversao.id}`}
              className="input sm:w-48"
              value={empresaEscolhida}
              onChange={(e) => setEmpresaEscolhida(e.target.value)}
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={ocupado || !empresaEscolhida}>
              Ligar à empresa
            </button>
          </form>
        ) : (
          <Link href="/app/empresas/nova" className="btn-ghost sm:ml-auto">
            Cadastrar empresa para emitir
          </Link>
        )}
      </div>
      {empresaVinculada && <p className="text-xs text-muted">Ligada à empresa {empresaVinculada.nome}.</p>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink">Itens da nota</h3>
          <p className="text-xs text-muted">Troque a categoria para recalcular. A escolha fica salva nesta conversão.</p>
        </div>
        <ItensNota
          itens={r.itens}
          ano={r.ano}
          salvando={salvando}
          onTrocar={(nItem, categoriaId) => ajustar({ classificacoes: { [String(nItem)]: categoriaId } }, nItem)}
        />
      </section>
    </article>
  );
}
