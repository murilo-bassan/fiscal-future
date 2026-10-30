"use client";

import Link from "next/link";
import { startTransition, useActionState, useMemo, useState } from "react";
import { calcularRascunho } from "@/lib/emissao/calculo";
import type { EmitenteFiscal, ItemRascunho, RascunhoNota, TipoNota } from "@/lib/emissao/tipos";
import type { CenarioAliquota } from "@/lib/tax/params";
import { CATEGORIAS, categoriaPorId } from "@/lib/tax/categorias";
import type { EstadoEmissao } from "@/app/app/empresas/[id]/notas/actions";
import { fracaoParaCampo, lerPercentual, lerValor, valorParaCampo } from "@/components/app/formato";
import { PreviaTributos } from "./PreviaTributos";
import { DESCRICAO_TIPO, NOME_TIPO, UFS, mascararDocumento } from "./rotulos";

type ItemForm = {
  chave: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  codigoServico: string;
  nbs: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  desconto: string;
  categoriaId: string;
  aliquotaIcms: string;
};

type Props = {
  acao: (estado: EstadoEmissao, dados: RascunhoNota) => Promise<EstadoEmissao>;
  emitente: Pick<EmitenteFiscal, "crt" | "regime" | "aliquotaIssPadrao">;
  ufEmitente: string;
  aliquotaIcmsPadrao: number | null;
  ano: number;
  cenario: CenarioAliquota;
  inicial?: RascunhoNota;
  /** O que falta nos dados fiscais para cada tipo (vazio = pode emitir). */
  faltaPorTipo: Record<TipoNota, string[]>;
  fiscalHref: string;
  cancelarHref: string;
  teste: boolean;
};

const NATUREZA: Record<TipoNota, string> = { nfe: "Venda de mercadoria", nfse: "Prestação de serviço" };

function itemVazio(aliquotaIcms: number | null, chave: number): ItemForm {
  return {
    chave,
    codigo: "",
    descricao: "",
    ncm: "",
    cfop: "",
    codigoServico: "",
    nbs: "",
    unidade: "UN",
    quantidade: "1",
    valorUnitario: "",
    desconto: "",
    categoriaId: "padrao",
    aliquotaIcms: aliquotaIcms != null ? fracaoParaCampo(aliquotaIcms) : "",
  };
}

function itemDoRascunho(it: ItemRascunho, aliquotaPadrao: number | null, chave: number): ItemForm {
  return {
    chave,
    codigo: it.codigo ?? "",
    descricao: it.descricao ?? "",
    ncm: it.ncm ?? "",
    cfop: it.cfop ?? "",
    codigoServico: it.codigoServico ?? "",
    nbs: it.nbs ?? "",
    unidade: it.unidade || "UN",
    quantidade: valorParaCampo(it.quantidade),
    valorUnitario: valorParaCampo(it.valorUnitario),
    desconto: it.desconto ? valorParaCampo(it.desconto) : "",
    categoriaId: it.categoriaId || "padrao",
    aliquotaIcms:
      it.aliquotaIcms != null ? fracaoParaCampo(it.aliquotaIcms) : aliquotaPadrao != null ? fracaoParaCampo(aliquotaPadrao) : "",
  };
}

const num = (s: string) => {
  const n = lerValor(s);
  return Number.isNaN(n) ? 0 : n;
};
const aliquota = (s: string) => {
  const n = lerPercentual(s);
  return Number.isNaN(n) ? undefined : n / 100;
};
const so = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

export function FormNota(p: Props) {
  const [estado, enviar, pendente] = useActionState(p.acao, {});
  const ini = p.inicial;
  const [tipo, setTipo] = useState<TipoNota>(ini?.tipo ?? "nfe");
  const [natureza, setNatureza] = useState(ini?.naturezaOperacao ?? NATUREZA[ini?.tipo ?? "nfe"]);
  const [doc, setDoc] = useState(mascararDocumento(ini?.destinatario.documento ?? ""));
  const [nome, setNome] = useState(ini?.destinatario.nome ?? "");
  const [email, setEmail] = useState(ini?.destinatario.email ?? "");
  const [ie, setIe] = useState(ini?.destinatario.inscricaoEstadual ?? "");
  const [end, setEnd] = useState({
    logradouro: ini?.destinatario.endereco?.logradouro ?? "",
    numero: ini?.destinatario.endereco?.numero ?? "",
    bairro: ini?.destinatario.endereco?.bairro ?? "",
    cep: ini?.destinatario.endereco?.cep ?? "",
    municipio: ini?.destinatario.endereco?.municipio ?? "",
    codigoMunicipio: ini?.destinatario.endereco?.codigoMunicipio ?? "",
    uf: ini?.destinatario.endereco?.uf ?? "",
  });
  const [consumidorFinal, setConsumidorFinal] = useState(ini?.destinatario.consumidorFinal ?? false);
  const [itens, setItens] = useState<ItemForm[]>(() =>
    ini?.itens.length ? ini.itens.map((it, i) => itemDoRascunho(it, p.aliquotaIcmsPadrao, i)) : [itemVazio(p.aliquotaIcmsPadrao, 0)],
  );
  const [info, setInfo] = useState(ini?.informacoesAdicionais ?? "");

  const erros = estado.erros ?? {};
  const falta = p.faltaPorTipo[tipo];
  const docDigitos = doc.replace(/\D/g, "");
  const interestadual = !!end.uf && end.uf !== p.ufEmitente;

  const rascunho = useMemo<RascunhoNota>(
    () => ({
      tipo,
      naturezaOperacao: natureza,
      destinatario: {
        documento: docDigitos,
        nome,
        email: email || undefined,
        inscricaoEstadual: tipo === "nfe" ? ie || undefined : undefined,
        endereco: Object.values(end).some(Boolean) ? end : undefined,
        consumidorFinal,
      },
      itens: itens.map((it) => ({
        codigo: it.codigo,
        descricao: it.descricao,
        ncm: tipo === "nfe" ? it.ncm : undefined,
        cfop: tipo === "nfe" ? it.cfop : undefined,
        codigoServico: tipo === "nfse" ? it.codigoServico : undefined,
        nbs: tipo === "nfse" ? it.nbs || undefined : undefined,
        unidade: it.unidade,
        quantidade: num(it.quantidade),
        valorUnitario: num(it.valorUnitario),
        desconto: num(it.desconto),
        categoriaId: it.categoriaId,
        aliquotaIcms: tipo === "nfe" ? aliquota(it.aliquotaIcms) : undefined,
      })),
      informacoesAdicionais: info || undefined,
      origemChave: ini?.origemChave,
    }),
    [tipo, natureza, docDigitos, nome, email, ie, end, consumidorFinal, itens, info, ini?.origemChave],
  );

  const calculo = useMemo(
    () => calcularRascunho(p.emitente, rascunho, { ano: p.ano, cenario: p.cenario }),
    [p.emitente, p.ano, p.cenario, rascunho],
  );

  function trocarTipo(t: TipoNota) {
    setTipo(t);
    if (natureza === NATUREZA[tipo] || !natureza) setNatureza(NATUREZA[t]);
    // A NFS-e nacional tem um serviço por nota
    if (t === "nfse") setItens((xs) => xs.slice(0, 1));
  }

  const mudaItem = (i: number, k: keyof ItemForm, v: string) =>
    setItens((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const erroDe = (k: string) => erros[k];
  const msgErro = (k: string, dica?: string) =>
    erroDe(k) ? (
      <p className="mt-1 text-xs font-medium text-bad">{erroDe(k)}</p>
    ) : dica ? (
      <p className="hint">{dica}</p>
    ) : null;
  const borda = (k: string) => (erroDe(k) ? "border-bad" : "");

  const legenda = "display text-lg font-semibold text-ink";

  return (
    <form
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => enviar(rascunho));
      }}
    >
      <div className="min-w-0 space-y-8">
        {(estado.erro || estado.mensagens?.length) && (
          <div role="alert" className="rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">
            <p className="font-semibold">{estado.erro}</p>
            {estado.mensagens && estado.mensagens.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {estado.mensagens.slice(0, 8).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {estado.faltando && estado.faltando.length > 0 && (
              <p className="mt-1">
                Falta: {estado.faltando.join("; ")}.{" "}
                <Link href={p.fiscalHref} className="font-semibold underline">
                  Completar dados fiscais
                </Link>
              </p>
            )}
            {estado.upgrade && (
              <Link href="/app/conta" className="mt-1 inline-block font-semibold underline">
                Ver planos
              </Link>
            )}
          </div>
        )}

        <fieldset>
          <legend className={legenda}>Tipo de nota</legend>
          <div role="radiogroup" className="mt-3 grid grid-cols-2 gap-2">
            {(["nfe", "nfse"] as TipoNota[]).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
                  tipo === t ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink/40"
                }`}
              >
                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => trocarTipo(t)} className="sr-only" />
                <span className="block font-semibold text-ink">{NOME_TIPO[t]}</span>
                <span className="block text-xs text-muted">{DESCRICAO_TIPO[t]}</span>
              </label>
            ))}
          </div>
          {falta.length > 0 && (
            <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
              Para emitir {NOME_TIPO[tipo]}, falta: {falta.join("; ")}.{" "}
              <Link href={p.fiscalHref} className="font-semibold underline">
                Completar
              </Link>
            </p>
          )}
          <div className="mt-4">
            <label htmlFor="fn-natureza" className="label">
              Natureza da operação
            </label>
            <input
              id="fn-natureza"
              value={natureza}
              onChange={(e) => setNatureza(e.target.value)}
              maxLength={60}
              className={`input ${borda("naturezaOperacao")}`}
            />
            {msgErro("naturezaOperacao")}
          </div>
        </fieldset>

        <fieldset className="space-y-5 border-t border-line pt-6">
          <legend className={`${legenda} float-left w-full`}>Cliente</legend>
          <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">
            <div>
              <label htmlFor="fn-doc" className="label">
                CPF ou CNPJ
              </label>
              <input
                id="fn-doc"
                inputMode="numeric"
                value={doc}
                onChange={(e) => {
                  const m = mascararDocumento(e.target.value);
                  setDoc(m);
                  if (m.replace(/\D/g, "").length === 11) setConsumidorFinal(true);
                }}
                placeholder="000.000.000-00"
                className={`input tabular-nums ${borda("destinatario.documento")}`}
              />
              {msgErro("destinatario.documento")}
            </div>
            <div>
              <label htmlFor="fn-nome" className="label">
                Nome ou razão social
              </label>
              <input
                id="fn-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={`input ${borda("destinatario.nome")}`}
              />
              {msgErro("destinatario.nome")}
            </div>
            <div>
              <label htmlFor="fn-email" className="label">
                E-mail <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="fn-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`input ${borda("destinatario.email")}`}
              />
              {msgErro("destinatario.email", "Para o cliente receber a nota.")}
            </div>
            {tipo === "nfe" && (
              <div>
                <label htmlFor="fn-ie" className="label">
                  Inscrição estadual <span className="font-normal text-muted">(se tiver)</span>
                </label>
                <input
                  id="fn-ie"
                  value={ie}
                  onChange={(e) => setIe(e.target.value.replace(/\D/g, "").slice(0, 14))}
                  inputMode="numeric"
                  className={`input tabular-nums ${borda("destinatario.inscricaoEstadual")}`}
                />
                {msgErro("destinatario.inscricaoEstadual")}
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={consumidorFinal}
              onChange={(e) => setConsumidorFinal(e.target.checked)}
              disabled={docDigitos.length === 11}
              className="mt-0.5"
            />
            <span>
              Consumidor final
              <span className="block text-xs text-muted">
                Pessoa física, ou empresa que vai usar e não revender. CPF é sempre consumidor final.
              </span>
            </span>
          </label>

          <details className="group rounded-lg border border-line bg-surface" open={!!ini?.destinatario.endereco}>
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-ink">
              Endereço do cliente <span className="font-normal text-muted">(recomendado)</span>
            </summary>
            <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-6">
              {(
                [
                  ["logradouro", "Rua", "sm:col-span-4"],
                  ["numero", "Número", "sm:col-span-2"],
                  ["bairro", "Bairro", "sm:col-span-3"],
                  ["cep", "CEP", "sm:col-span-3"],
                  ["municipio", "Município", "sm:col-span-3"],
                  ["codigoMunicipio", "Código IBGE", "sm:col-span-2"],
                ] as const
              ).map(([k, rotulo, col]) => (
                <div key={k} className={col}>
                  <label htmlFor={`fn-end-${k}`} className="label">
                    {rotulo}
                  </label>
                  <input
                    id={`fn-end-${k}`}
                    value={end[k]}
                    inputMode={k === "cep" || k === "codigoMunicipio" ? "numeric" : undefined}
                    onChange={(e) => setEnd((x) => ({ ...x, [k]: e.target.value }))}
                    className={`input ${borda(`destinatario.endereco.${k}`)}`}
                  />
                  {msgErro(`destinatario.endereco.${k}`)}
                </div>
              ))}
              <div className="sm:col-span-1">
                <label htmlFor="fn-end-uf" className="label">
                  UF
                </label>
                <select
                  id="fn-end-uf"
                  value={end.uf}
                  onChange={(e) => setEnd((x) => ({ ...x, uf: e.target.value }))}
                  className="input"
                >
                  <option value="">-</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </details>
        </fieldset>

        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className={`${legenda} float-left w-full`}>{tipo === "nfe" ? "Produtos" : "Serviço"}</legend>
          <div className="clear-both" />
          {erroDe("itens") && <p className="text-sm font-medium text-bad">{erroDe("itens")}</p>}

          {itens.map((it, i) => {
            const k = (campo: string) => `itens.${i}.${campo}`;
            const cat = categoriaPorId(it.categoriaId);
            const id = (campo: string) => `fn-${it.chave}-${campo}`;
            const input = (
              campo: keyof ItemForm,
              rotulo: string,
              extra: { col?: string; inputMode?: "numeric" | "decimal"; dica?: string; max?: number; sufixo?: string } = {},
            ) => (
              <div className={extra.col}>
                <label htmlFor={id(campo)} className="label">
                  {rotulo}
                </label>
                <div className="relative">
                  <input
                    id={id(campo)}
                    value={it[campo] as string}
                    inputMode={extra.inputMode}
                    maxLength={extra.max}
                    onChange={(e) =>
                      mudaItem(i, campo, extra.inputMode === "numeric" ? so(e.target.value, extra.max ?? 20) : e.target.value)
                    }
                    className={`input tabular-nums ${extra.sufixo ? "pr-8" : ""} ${borda(k(campo))}`}
                  />
                  {extra.sufixo && (
                    <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-muted">
                      {extra.sufixo}
                    </span>
                  )}
                </div>
                {msgErro(k(campo), extra.dica)}
              </div>
            );
            return (
              <div key={it.chave} className="rounded-xl border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-ink">{tipo === "nfe" ? `Item ${i + 1}` : "Serviço prestado"}</h3>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItens((xs) => xs.filter((_, j) => j !== i))}
                      className="text-xs font-medium text-muted underline hover:text-bad"
                    >
                      Remover item
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                  <div className="col-span-2 sm:col-span-6">
                    <label htmlFor={id("descricao")} className="label">
                      {tipo === "nfe" ? "Descrição do produto" : "Descrição do serviço"}
                    </label>
                    <input
                      id={id("descricao")}
                      value={it.descricao}
                      onChange={(e) => mudaItem(i, "descricao", e.target.value)}
                      maxLength={120}
                      className={`input ${borda(k("descricao"))}`}
                    />
                    {msgErro(k("descricao"))}
                  </div>

                  {tipo === "nfe" ? (
                    <>
                      {input("ncm", "NCM", { col: "col-span-1 sm:col-span-2", inputMode: "numeric", max: 8, dica: "8 dígitos" })}
                      {input("cfop", "CFOP", {
                        col: "col-span-1 sm:col-span-2",
                        inputMode: "numeric",
                        max: 4,
                        dica: interestadual ? "Outro estado: 6102" : "Mesmo estado: 5102",
                      })}
                      {input("codigo", "Código", { col: "col-span-1 sm:col-span-1", max: 60 })}
                      {input("unidade", "Unidade", { col: "col-span-1 sm:col-span-1", max: 6 })}
                    </>
                  ) : (
                    <>
                      {input("codigoServico", "Código do serviço", {
                        col: "col-span-1 sm:col-span-3",
                        inputMode: "numeric",
                        max: 6,
                        dica: "Tributação nacional, 6 dígitos",
                      })}
                      {input("nbs", "NBS", { col: "col-span-1 sm:col-span-3", inputMode: "numeric", max: 9, dica: "9 dígitos" })}
                    </>
                  )}

                  {input("quantidade", "Quantidade", { col: "col-span-1 sm:col-span-2", inputMode: "decimal" })}
                  {input("valorUnitario", "Valor unitário (R$)", { col: "col-span-1 sm:col-span-2", inputMode: "decimal" })}
                  {input("desconto", "Desconto (R$)", { col: "col-span-1 sm:col-span-2", inputMode: "decimal" })}
                  {tipo === "nfe" &&
                    p.emitente.crt === "3" &&
                    input("aliquotaIcms", "ICMS", { col: "col-span-1 sm:col-span-2", inputMode: "decimal", sufixo: "%" })}

                  <div className="col-span-2 sm:col-span-6">
                    <label htmlFor={id("categoria")} className="label">
                      Como a reforma trata este item
                    </label>
                    <select
                      id={id("categoria")}
                      value={it.categoriaId}
                      onChange={(e) => mudaItem(i, "categoriaId", e.target.value)}
                      className={`input ${borda(k("categoriaId"))}`}
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <p className="hint tabular-nums">
                      CST {cat.cst}, cClassTrib {cat.cClassTrib}. Não sabe? Use Classificar produtos.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {tipo === "nfe" && itens.length < 100 && (
            <button
              type="button"
              onClick={() =>
                setItens((xs) => [...xs, itemVazio(p.aliquotaIcmsPadrao, Math.max(...xs.map((x) => x.chave)) + 1)])
              }
              className="btn-ghost w-full sm:w-auto"
            >
              Adicionar item
            </button>
          )}
        </fieldset>

        <div className="border-t border-line pt-6">
          <label htmlFor="fn-info" className="label">
            Informações adicionais <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="fn-info"
            rows={3}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            maxLength={2000}
            className="input"
          />
          {msgErro("informacoesAdicionais", "Aparece no rodapé da nota. Ex.: número do pedido.")}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <PreviaTributos
          tipo={tipo}
          calculo={calculo}
          descricoes={itens.map((i) => i.descricao)}
          titulo="Prévia dos tributos"
        />
        <div className="flex flex-col gap-2">
          <button type="submit" className="btn-primary w-full" disabled={pendente || falta.length > 0}>
            {pendente ? "Emitindo..." : p.teste ? `Emitir ${NOME_TIPO[tipo]} de teste` : `Emitir ${NOME_TIPO[tipo]}`}
          </button>
          <Link href={p.cancelarHref} className="btn-ghost w-full">
            Cancelar
          </Link>
          <p className="text-center text-xs text-muted">
            {p.teste
              ? "Ambiente de teste: a nota não tem valor fiscal."
              : "Produção: a nota vai para a SEFAZ ou a prefeitura e tem valor fiscal."}
          </p>
        </div>
      </aside>
    </form>
  );
}
