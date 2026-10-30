"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import {
  PERFIL_EXEMPLO,
  PRESETS,
  REDUCOES,
  type Atividade,
  type PerfilEmpresa,
  type Reducao,
  type Regime,
} from "@/lib/tax";
import type { EstadoEmpresa } from "@/app/app/empresas/actions";
import {
  CAMPOS_NUMERICOS,
  NOMES_ATIVIDADE,
  NOMES_REGIME,
  type CampoNumerico,
} from "./camposPerfil";
import { fracaoParaCampo, lerValor, valorParaCampo } from "./formato";

type Props = {
  acao: (estado: EstadoEmpresa, form: FormData) => Promise<EstadoEmpresa>;
  inicial?: PerfilEmpresa | null;
  cnpj?: string | null;
  cenarioId?: string;
  textoBotao: string;
  cancelarHref: string;
};

type Valores = Record<string, string>;

function paraCampos(p: PerfilEmpresa): Valores {
  const v: Valores = {};
  for (const c of CAMPOS_NUMERICOS) {
    const n = p[c.chave] as number;
    v[c.chave] =
      c.tipo === "valor" ? valorParaCampo(n) : c.tipo === "percentual" ? fracaoParaCampo(n) : String(n);
  }
  return v;
}

const REGIMES = Object.keys(NOMES_REGIME) as Regime[];
const ATIVIDADES = Object.keys(NOMES_ATIVIDADE) as Atividade[];
const DICA_REGIME: Record<Regime, string> = {
  simples: "Paga um único DAS por mês",
  presumido: "PIS/Cofins cumulativo (3,65%)",
  real: "PIS/Cofins não cumulativo (9,25%)",
};

function formatarCnpj(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function PerfilForm({ acao, inicial, cnpj, cenarioId, textoBotao, cancelarHref }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [doc, setDoc] = useState(cnpj ? formatarCnpj(cnpj) : "");
  const [regime, setRegime] = useState<Regime>(inicial?.regime ?? "simples");
  const [atividade, setAtividade] = useState<Atividade>(inicial?.atividade ?? "comercio");
  const [redVendas, setRedVendas] = useState<Reducao>(inicial?.reducaoVendas ?? "padrao");
  const [redCompras, setRedCompras] = useState<Reducao>(inicial?.reducaoCompras ?? "padrao");
  const [cenario, setCenario] = useState(cenarioId ?? PRESETS[0].id);
  const [valores, setValores] = useState<Valores>(() => (inicial ? paraCampos(inicial) : {}));

  const erros = estado.campos ?? {};

  function exemplo() {
    setNome(PERFIL_EXEMPLO.nome);
    setRegime(PERFIL_EXEMPLO.regime);
    setAtividade(PERFIL_EXEMPLO.atividade);
    setRedVendas(PERFIL_EXEMPLO.reducaoVendas);
    setRedCompras(PERFIL_EXEMPLO.reducaoCompras);
    setValores(paraCampos(PERFIL_EXEMPLO));
  }

  const campos = (grupo: CampoNumerico["grupo"]) =>
    CAMPOS_NUMERICOS.filter((c) => c.grupo === grupo && c.visivel(regime, atividade));

  const renderCampo = (c: CampoNumerico) => {
    const id = `f-${c.chave}`;
    const erro = erros[c.chave];
    return (
      <div key={c.chave}>
        <label htmlFor={id} className="label">
          {c.rotulo}
        </label>
        <div className="relative">
          {c.tipo === "valor" && (
            <span className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-muted">
              R$
            </span>
          )}
          <input
            id={id}
            name={c.chave}
            inputMode="decimal"
            autoComplete="off"
            value={valores[c.chave] ?? ""}
            onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
            onBlur={(e) => {
              if (c.tipo !== "valor") return;
              const n = lerValor(e.target.value);
              if (!Number.isNaN(n)) setValores((v) => ({ ...v, [c.chave]: valorParaCampo(n) }));
            }}
            placeholder="0"
            aria-invalid={!!erro}
            aria-describedby={`${id}-dica`}
            className={`input tabular-nums ${c.tipo === "valor" ? "pl-10" : "pr-14"} ${
              erro ? "border-bad" : ""
            }`}
          />
          {c.tipo !== "valor" && (
            <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-muted">
              {c.tipo === "percentual" ? "%" : "dias"}
            </span>
          )}
        </div>
        <p id={`${id}-dica`} className={erro ? "mt-1 text-xs font-medium text-bad" : "hint"}>
          {erro ?? c.dica}
        </p>
      </div>
    );
  };

  const secao = "border-t border-line pt-6";
  const legenda = "display text-lg font-semibold text-ink";

  return (
    <form
      className="space-y-8"
      noValidate
      // Envio manual: com action={...} o React reinicia o formulário depois do envio
      // e selects controlados voltam visualmente para a primeira opção.
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-ink">
        <span>Só quer ver como funciona? Use os números de uma distribuidora fictícia.</span>
        <button type="button" onClick={exemplo} className="btn-ghost py-1.5">
          Preencher com exemplo
        </button>
      </div>

      {estado.erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {estado.erro}{" "}
          {estado.erro.includes("plano") && (
            <Link href="/app/conta" className="font-semibold underline">
              Ver planos
            </Link>
          )}
        </p>
      )}

      <fieldset className="space-y-5">
        <legend className={legenda}>Sobre a empresa</legend>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <div>
            <label htmlFor="f-nome" className="label">
              Nome da empresa
            </label>
            <input
              id="f-nome"
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={`input ${erros.nome ? "border-bad" : ""}`}
              aria-invalid={!!erros.nome}
            />
            {erros.nome && <p className="mt-1 text-xs font-medium text-bad">{erros.nome}</p>}
          </div>
          <div>
            <label htmlFor="f-cnpj" className="label">
              CNPJ <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="f-cnpj"
              name="cnpj"
              inputMode="numeric"
              value={doc}
              onChange={(e) => setDoc(formatarCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              className={`input tabular-nums ${erros.cnpj ? "border-bad" : ""}`}
            />
            {erros.cnpj && <p className="mt-1 text-xs font-medium text-bad">{erros.cnpj}</p>}
          </div>
        </div>

        <div role="radiogroup" aria-labelledby="rot-regime">
          <p id="rot-regime" className="label">
            Regime tributário
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {REGIMES.map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
                  regime === r ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="regime"
                  value={r}
                  checked={regime === r}
                  onChange={() => setRegime(r)}
                  className="sr-only"
                />
                <span className="block font-medium text-ink">{NOMES_REGIME[r]}</span>
                <span className="block text-xs text-muted">{DICA_REGIME[r]}</span>
              </label>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-labelledby="rot-atividade">
          <p id="rot-atividade" className="label">
            Atividade principal
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {ATIVIDADES.map((a) => (
              <label
                key={a}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
                  atividade === a
                    ? "border-brand bg-brand-soft text-ink"
                    : "border-line bg-surface text-ink hover:border-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="atividade"
                  value={a}
                  checked={atividade === a}
                  onChange={() => setAtividade(a)}
                  className="sr-only"
                />
                {NOMES_ATIVIDADE[a]}
              </label>
            ))}
          </div>
          <p className="hint">Se a empresa faz mais de uma coisa, escolha a que mais fatura.</p>
        </div>
      </fieldset>

      <fieldset className={`space-y-5 ${secao}`}>
        <legend className={`${legenda} float-left w-full`}>Números dos últimos 12 meses</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">{campos("numeros").map(renderCampo)}</div>
      </fieldset>

      <fieldset className={`space-y-5 ${secao}`}>
        <legend className={`${legenda} float-left w-full`}>Impostos de hoje</legend>
        <p className="clear-both text-sm text-muted">
          {regime === "simples"
            ? "No Simples, basta a alíquota efetiva do DAS."
            : "Use percentuais efetivos: o imposto do período dividido pela base. Digite 18 para 18%."}
        </p>
        <div className="grid gap-5 sm:grid-cols-2">{campos("aliquotas").map(renderCampo)}</div>
      </fieldset>

      <fieldset className={`space-y-5 ${secao}`}>
        <legend className={`${legenda} float-left w-full`}>Clientes, fornecedores e prazos</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">{campos("clientes").map(renderCampo)}</div>
      </fieldset>

      <fieldset className={`space-y-5 ${secao}`}>
        <legend className={`${legenda} float-left w-full`}>Como a reforma trata o que você vende e compra</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">
          <div>
            <label htmlFor="f-redv" className="label">
              Alíquota do que você vende
            </label>
            <select
              id="f-redv"
              name="reducaoVendas"
              value={redVendas}
              onChange={(e) => setRedVendas(e.target.value as Reducao)}
              className="input"
            >
              {(Object.keys(REDUCOES) as Reducao[]).map((k) => (
                <option key={k} value={k}>
                  {REDUCOES[k].nome}
                </option>
              ))}
            </select>
            <p className="hint">
              A maioria fica na alíquota padrão. Não sabe? Use Classificar produtos para descobrir.
            </p>
          </div>
          <div>
            <label htmlFor="f-redc" className="label">
              Alíquota do que você compra
            </label>
            <select
              id="f-redc"
              name="reducaoCompras"
              value={redCompras}
              onChange={(e) => setRedCompras(e.target.value as Reducao)}
              className="input"
            >
              {(Object.keys(REDUCOES) as Reducao[]).map((k) => (
                <option key={k} value={k}>
                  {REDUCOES[k].nome}
                </option>
              ))}
            </select>
            <p className="hint">Define quanto crédito de IBS/CBS suas compras vão gerar.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="f-cenario" className="label">
              Cenário de alíquota
            </label>
            <select
              id="f-cenario"
              name="cenarioId"
              value={cenario}
              onChange={(e) => setCenario(e.target.value)}
              className="input"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <p className={erros.cenarioId ? "mt-1 text-xs font-medium text-bad" : "hint"}>
              {erros.cenarioId ??
                `As alíquotas oficiais de IBS e CBS ainda não foram fixadas. Fonte: ${
                  PRESETS.find((p) => p.id === cenario)?.fonte ?? ""
                }. Dá para comparar cenários depois, no resultado.`}
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
        <Link href={cancelarHref} className="btn-ghost">
          Cancelar
        </Link>
        <button type="submit" className="btn-primary" disabled={pendente}>
          {pendente ? "Calculando..." : textoBotao}
        </button>
      </div>
    </form>
  );
}
