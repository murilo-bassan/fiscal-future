"use client";

import { useId, useState } from "react";
import { brl } from "@/components/app/formato";
import {
  TRIBUTOS_NFE,
  TRIBUTOS_NFSE,
  aplicarChave,
  baseDoItem,
  itemVazio,
  valorDaAliquota,
  type CampoTributo,
  type ErrosForm,
  type ItemForm,
  type NotaForm,
  type TipoNota,
} from "./formNota";

const TIPOS: { id: TipoNota; nome: string }[] = [
  { id: "nfe", nome: "NF-e" },
  { id: "nfce", nome: "NFC-e" },
  { id: "nfse", nome: "NFS-e" },
];

const NOME_TRIBUTO: Record<CampoTributo, string> = { icms: "ICMS", pis: "PIS", cofins: "Cofins", ipi: "IPI", iss: "ISS" };

/**
 * Formulário da nota: cabeçalho e itens. Controlado pelo pai, que valida
 * (validarForm) e envia. Usado na aba "Digitar" e em "Corrigir dados".
 */
export function FormNotaManual({
  valor: f,
  onChange,
  erros,
  desabilitado = false,
}: {
  valor: NotaForm;
  onChange: (f: NotaForm) => void;
  erros: ErrosForm;
  desabilitado?: boolean;
}) {
  const id = useId();
  const [avisoChave, setAvisoChave] = useState<{ ok: boolean; msg: string } | null>(null);
  const servico = f.tipo === "nfse";
  const set = <K extends keyof NotaForm>(k: K, v: NotaForm[K]) => onChange({ ...f, [k]: v });
  const setItem = (i: number, mud: Partial<ItemForm>) =>
    onChange({ ...f, itens: f.itens.map((it, k) => (k === i ? { ...it, ...mud } : it)) });

  function mudarChave(v: string) {
    const d = v.replace(/\D/g, "");
    if (d.length !== 44) {
      setAvisoChave(d.length > 44 ? { ok: false, msg: "A chave tem 44 dígitos." } : null);
      return set("chave", v);
    }
    const r = aplicarChave(f, v);
    onChange(r.form);
    setAvisoChave(
      r.valida
        ? { ok: true, msg: "Preenchemos UF, mês, CNPJ do emitente, modelo, série e número a partir da chave." }
        : { ok: false, msg: "Esta chave tem o dígito verificador errado. Confira se colou inteira." },
    );
  }

  return (
    <fieldset disabled={desabilitado} className="space-y-6">
      {/* Tipo */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted" id={`${id}-tipo`}>
          Tipo de nota
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-tipo`} className="inline-flex rounded-lg border border-line bg-surface p-1">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={f.tipo === t.id}
              onClick={() => set("tipo", t.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                f.tipo === t.id ? "bg-ink font-medium text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {t.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="grid gap-4 sm:grid-cols-6">
        {!servico && (
          <Campo id={`${id}-chave`} rotulo="Chave de acesso" opcional erro={erros.chave} className="sm:col-span-6">
            <input
              id={`${id}-chave`}
              className="input font-mono text-sm"
              inputMode="numeric"
              autoComplete="off"
              placeholder="44 dígitos, se tiver"
              value={f.chave}
              onChange={(e) => mudarChave(e.target.value)}
            />
            {avisoChave && <p className={`mt-1 text-xs ${avisoChave.ok ? "text-good" : "text-bad"}`}>{avisoChave.msg}</p>}
            <p className="hint">
              A chave diz quem emitiu, quando, o modelo, a série e o número, mas não traz os itens. Baixar o XML
              completo pela chave exige o certificado digital da empresa; por isso os itens são digitados abaixo.
            </p>
          </Campo>
        )}
        <Campo id={`${id}-numero`} rotulo="Número" erro={erros.numero} className="sm:col-span-2">
          <input id={`${id}-numero`} className="input" inputMode="numeric" value={f.numero} onChange={(e) => set("numero", e.target.value)} />
        </Campo>
        <Campo id={`${id}-serie`} rotulo="Série" opcional erro={erros.serie} className="sm:col-span-1">
          <input id={`${id}-serie`} className="input" value={f.serie} onChange={(e) => set("serie", e.target.value)} />
        </Campo>
        <Campo id={`${id}-emissao`} rotulo="Data de emissão" opcional erro={erros.emissao} className="sm:col-span-3">
          <input id={`${id}-emissao`} type="date" className="input" value={f.emissao} onChange={(e) => set("emissao", e.target.value)} />
        </Campo>

        <Campo id={`${id}-emit-nome`} rotulo="Emitente (quem vendeu)" erro={erros["emitente.nome"]} className="sm:col-span-3">
          <input
            id={`${id}-emit-nome`}
            className="input"
            autoComplete="organization"
            value={f.emitenteNome}
            onChange={(e) => set("emitenteNome", e.target.value)}
          />
        </Campo>
        <Campo id={`${id}-emit-doc`} rotulo="CNPJ ou CPF do emitente" opcional erro={erros["emitente.documento"]} className="sm:col-span-2">
          <input
            id={`${id}-emit-doc`}
            className="input"
            inputMode="numeric"
            value={f.emitenteDocumento}
            onChange={(e) => set("emitenteDocumento", e.target.value)}
          />
        </Campo>
        <Campo id={`${id}-emit-uf`} rotulo="UF" opcional erro={erros["emitente.uf"]} className="sm:col-span-1">
          <input
            id={`${id}-emit-uf`}
            className="input uppercase"
            maxLength={2}
            value={f.emitenteUf}
            onChange={(e) => set("emitenteUf", e.target.value.toUpperCase())}
          />
        </Campo>

        <fieldset className="sm:col-span-6">
          <legend className="label">Regime do emitente</legend>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
            {(
              [
                ["normal", "Lucro Presumido ou Real"],
                ["simples", "Simples Nacional ou MEI"],
              ] as const
            ).map(([v, nome]) => (
              <label key={v} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name={`${id}-regime`}
                  className="accent-brand"
                  checked={f.regimeEmitente === v}
                  onChange={() => set("regimeEmitente", v)}
                />
                {nome}
              </label>
            ))}
          </div>
          <p className="hint">Na nota do Simples aparece “Documento emitido por ME ou EPP optante pelo Simples Nacional”.</p>
        </fieldset>

        <Campo id={`${id}-dest-nome`} rotulo={servico ? "Tomador (cliente)" : "Destinatário (cliente)"} opcional erro={erros["destinatario.nome"]} className="sm:col-span-3">
          <input id={`${id}-dest-nome`} className="input" value={f.destinatarioNome} onChange={(e) => set("destinatarioNome", e.target.value)} />
        </Campo>
        <Campo id={`${id}-dest-doc`} rotulo="CNPJ ou CPF do cliente" opcional erro={erros["destinatario.documento"]} className="sm:col-span-2">
          <input
            id={`${id}-dest-doc`}
            className="input"
            inputMode="numeric"
            value={f.destinatarioDocumento}
            onChange={(e) => set("destinatarioDocumento", e.target.value)}
          />
        </Campo>
        <Campo id={`${id}-dest-uf`} rotulo="UF" opcional erro={erros["destinatario.uf"]} className="sm:col-span-1">
          <input
            id={`${id}-dest-uf`}
            className="input uppercase"
            maxLength={2}
            value={f.destinatarioUf}
            onChange={(e) => set("destinatarioUf", e.target.value.toUpperCase())}
          />
        </Campo>
      </div>

      {/* Itens */}
      <section className="space-y-3" aria-labelledby={`${id}-itens`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${id}-itens`} className="text-base font-semibold text-ink">
            {servico ? "Serviços" : "Itens"}
          </h3>
          <p className="text-xs text-muted">Tributos em reais, como estão na nota. Use “%” para informar a alíquota.</p>
        </div>
        {erros.itens && <p className="text-sm text-bad">{erros.itens}</p>}
        <ol className="space-y-3">
          {f.itens.map((it, i) => (
            <LinhaItem
              key={it.id}
              n={i}
              item={it}
              tipo={f.tipo}
              erros={erros}
              podeRemover={f.itens.length > 1}
              onChange={(m) => setItem(i, m)}
              onRemover={() => onChange({ ...f, itens: f.itens.filter((_, k) => k !== i) })}
            />
          ))}
        </ol>
        <button
          type="button"
          className="btn-ghost w-full sm:w-auto"
          disabled={f.itens.length >= 990}
          onClick={() => onChange({ ...f, itens: [...f.itens, itemVazio()] })}
        >
          {servico ? "Incluir outro serviço" : "Incluir outro item"}
        </button>
      </section>
    </fieldset>
  );
}

function LinhaItem({
  n,
  item: it,
  tipo,
  erros,
  podeRemover,
  onChange,
  onRemover,
}: {
  n: number;
  item: ItemForm;
  tipo: TipoNota;
  erros: ErrosForm;
  podeRemover: boolean;
  onChange: (m: Partial<ItemForm>) => void;
  onRemover: () => void;
}) {
  const servico = tipo === "nfse";
  const p = `itens.${n}`;
  const id = `item-${it.id}`;
  const base = baseDoItem(it, tipo);
  const tributos = servico ? TRIBUTOS_NFSE : TRIBUTOS_NFE;

  return (
    <li className="rounded-xl border border-line bg-paper p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink">
          {servico ? "Serviço" : "Item"} {n + 1}
          {base > 0 && <span className="ml-2 font-normal text-muted">{brl(base, 2)}</span>}
        </span>
        {podeRemover && (
          <button type="button" className="text-xs text-muted hover:text-bad" onClick={onRemover}>
            Remover
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Campo id={`${id}-desc`} rotulo="Descrição" erro={erros[`${p}.descricao`]} className="col-span-2 sm:col-span-6">
          <input id={`${id}-desc`} className="input" value={it.descricao} onChange={(e) => onChange({ descricao: e.target.value })} />
        </Campo>
        {servico ? (
          <>
            <Campo id={`${id}-cs`} rotulo="Código do serviço" opcional erro={erros[`${p}.codigoServico`]} className="col-span-1 sm:col-span-3">
              <input
                id={`${id}-cs`}
                className="input"
                placeholder="ex.: 17.14"
                value={it.codigoServico}
                onChange={(e) => onChange({ codigoServico: e.target.value })}
              />
            </Campo>
            <Campo id={`${id}-vu`} rotulo="Valor (R$)" erro={erros[`${p}.valorUnitario`]} className="col-span-1 sm:col-span-3">
              <input id={`${id}-vu`} className="input" inputMode="decimal" value={it.valorUnitario} onChange={(e) => onChange({ valorUnitario: e.target.value })} />
            </Campo>
          </>
        ) : (
          <>
            <Campo id={`${id}-ncm`} rotulo="NCM" opcional erro={erros[`${p}.ncm`]} className="col-span-1 sm:col-span-2">
              <input id={`${id}-ncm`} className="input" inputMode="numeric" value={it.ncm} onChange={(e) => onChange({ ncm: e.target.value })} />
            </Campo>
            <Campo id={`${id}-cfop`} rotulo="CFOP" opcional erro={erros[`${p}.cfop`]} className="col-span-1 sm:col-span-1">
              <input id={`${id}-cfop`} className="input" inputMode="numeric" value={it.cfop} onChange={(e) => onChange({ cfop: e.target.value })} />
            </Campo>
            <Campo id={`${id}-qtd`} rotulo="Quantidade" erro={erros[`${p}.quantidade`]} className="col-span-1 sm:col-span-1">
              <input id={`${id}-qtd`} className="input" inputMode="decimal" value={it.quantidade} onChange={(e) => onChange({ quantidade: e.target.value })} />
            </Campo>
            <Campo id={`${id}-vu`} rotulo="Valor unit. (R$)" erro={erros[`${p}.valorUnitario`]} className="col-span-1 sm:col-span-1">
              <input id={`${id}-vu`} className="input" inputMode="decimal" value={it.valorUnitario} onChange={(e) => onChange({ valorUnitario: e.target.value })} />
            </Campo>
            <Campo id={`${id}-desc-v`} rotulo="Desconto (R$)" opcional erro={erros[`${p}.desconto`]} className="col-span-2 sm:col-span-1">
              <input id={`${id}-desc-v`} className="input" inputMode="decimal" value={it.desconto} onChange={(e) => onChange({ desconto: e.target.value })} />
            </Campo>
          </>
        )}
        {tributos.map((t) => (
          <CampoTributoItem
            key={t}
            id={`${id}-${t}`}
            rotulo={NOME_TRIBUTO[t]}
            valor={it[t]}
            base={base}
            erro={erros[`${p}.${t}`]}
            onChange={(v) => onChange({ [t]: v } as Partial<ItemForm>)}
          />
        ))}
      </div>
    </li>
  );
}

/** Campo de tributo em R$, com atalho para informar a alíquota (%) sobre o valor do item. */
function CampoTributoItem({
  id,
  rotulo,
  valor,
  base,
  erro,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  base: number;
  erro?: string;
  onChange: (v: string) => void;
}) {
  const [emPct, setEmPct] = useState(false);
  const [aliq, setAliq] = useState("");
  const [nota, setNota] = useState<string | null>(null);

  function aplicar() {
    const v = valorDaAliquota(base, aliq);
    if (v !== null && aliq.trim()) {
      onChange(v.toFixed(2).replace(".", ","));
      setNota(`${aliq.replace("%", "").trim()}% de ${brl(base, 2)}`);
    }
    setEmPct(false);
    setAliq("");
  }

  return (
    <div className="col-span-1 sm:col-span-1">
      <label htmlFor={id} className="label">
        {rotulo} {emPct ? "(%)" : "(R$)"}
      </label>
      <div className="flex gap-1">
        {emPct ? (
          <input
            id={id}
            autoFocus
            className="input min-w-0"
            inputMode="decimal"
            placeholder="ex.: 18"
            value={aliq}
            onChange={(e) => setAliq(e.target.value)}
            onBlur={aplicar}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicar();
              }
              if (e.key === "Escape") setEmPct(false);
            }}
          />
        ) : (
          <input
            id={id}
            className="input min-w-0"
            inputMode="decimal"
            aria-invalid={erro ? true : undefined}
            value={valor}
            onChange={(e) => {
              setNota(null);
              onChange(e.target.value);
            }}
          />
        )}
        <button
          type="button"
          aria-pressed={emPct}
          aria-label={`Informar ${rotulo} pela alíquota`}
          title={base > 0 ? "Informar pela alíquota" : "Preencha o valor do item para usar a alíquota"}
          disabled={base <= 0}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (emPct ? aplicar() : setEmPct(true))}
          className={`mt-1 shrink-0 rounded-md border px-2.5 text-sm transition-colors disabled:opacity-40 ${
            emPct ? "border-brand bg-brand-soft text-ink" : "border-line text-muted hover:text-ink"
          }`}
        >
          %
        </button>
      </div>
      {erro ? <p className="mt-1 text-xs text-bad">{erro}</p> : nota && <p className="mt-1 text-xs text-muted">{nota}</p>}
    </div>
  );
}

function Campo({
  id,
  rotulo,
  opcional,
  erro,
  className = "",
  children,
}: {
  id: string;
  rotulo: string;
  opcional?: boolean;
  erro?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="label">
        {rotulo} {opcional && <span className="font-normal text-muted">(opcional)</span>}
      </label>
      {children}
      {erro && <p className="mt-1 text-xs text-bad">{erro}</p>}
    </div>
  );
}
