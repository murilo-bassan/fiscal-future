"use client";

import { startTransition, useActionState, useState } from "react";
import type { EstadoFiscal } from "@/app/app/empresas/[id]/fiscal/actions";
import { CRTS, UFS } from "./rotulos";

export type ValoresFiscais = {
  razaoSocial: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  crt: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cep: string;
  municipio: string;
  codigoMunicipio: string;
  uf: string;
  aliquotaIcmsPadrao: string;
  aliquotaIssPadrao: string;
  serieNfe: string;
  ambiente: string;
  provedor: string;
};

type Props = {
  acao: (estado: EstadoFiscal, form: FormData) => Promise<EstadoFiscal>;
  inicial: ValoresFiscais;
  tokenSalvo: boolean;
  /** CRT sugerido pelo regime do cadastro, quando ainda não foi escolhido. */
  crtSugerido?: string;
};

export function FormFiscal({ acao, inicial, tokenSalvo, crtSugerido }: Props) {
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [v, setV] = useState<ValoresFiscais>({ ...inicial, crt: inicial.crt || crtSugerido || "" });
  const [token, setToken] = useState("");
  const [remover, setRemover] = useState(false);
  const erros = estado.campos ?? {};
  const salvo = estado.tokenSalvo ?? tokenSalvo;
  const ambienteSalvoProducao = inicial.ambiente === "producao";

  const muda = (k: keyof ValoresFiscais) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));

  const campo = (
    k: keyof ValoresFiscais,
    rotulo: string,
    extra: { dica?: string; inputMode?: "numeric" | "decimal" | "text"; placeholder?: string; sufixo?: string; className?: string } = {},
  ) => {
    const id = `ff-${k}`;
    const erro = erros[k];
    return (
      <div className={extra.className}>
        <label htmlFor={id} className="label">
          {rotulo}
        </label>
        <div className="relative">
          <input
            id={id}
            name={k}
            value={v[k]}
            onChange={muda(k)}
            inputMode={extra.inputMode}
            placeholder={extra.placeholder}
            autoComplete="off"
            aria-invalid={!!erro}
            aria-describedby={extra.dica || erro ? `${id}-d` : undefined}
            className={`input ${extra.sufixo ? "pr-9" : ""} ${erro ? "border-bad" : ""}`}
          />
          {extra.sufixo && (
            <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-sm text-muted">
              {extra.sufixo}
            </span>
          )}
        </div>
        {(erro || extra.dica) && (
          <p id={`${id}-d`} className={erro ? "mt-1 text-xs font-medium text-bad" : "hint"}>
            {erro ?? extra.dica}
          </p>
        )}
      </div>
    );
  };

  const secao = "space-y-5 border-t border-line pt-6";
  const legenda = "display float-left w-full text-lg font-semibold text-ink";
  const producaoComSimulado = v.ambiente === "producao" && v.provedor === "simulado";

  return (
    <form
      className="space-y-8"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => {
          enviar(dados);
          setToken("");
          setRemover(false);
        });
      }}
    >
      {estado.erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {estado.erro}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">
          {estado.ok}
        </p>
      )}

      <fieldset className="space-y-5">
        <legend className={legenda}>Identificação</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">
          {campo("razaoSocial", "Razão social", {
            className: "sm:col-span-2",
            dica: "O nome registrado no CNPJ, como aparece no cartão da Receita.",
          })}
          {campo("inscricaoEstadual", "Inscrição estadual", {
            dica: "Obrigatória para NF-e. Escreva ISENTO se for o caso.",
          })}
          {campo("inscricaoMunicipal", "Inscrição municipal", { dica: "Obrigatória para NFS-e." })}
        </div>

        <div role="radiogroup" aria-labelledby="rot-crt">
          <p id="rot-crt" className="label">
            Como a empresa aparece na nota (CRT)
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {CRTS.map((c) => (
              <label
                key={c.valor}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40 ${
                  v.crt === c.valor ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink/40"
                }`}
              >
                <input
                  type="radio"
                  name="crt"
                  value={c.valor}
                  checked={v.crt === c.valor}
                  onChange={() => setV((x) => ({ ...x, crt: c.valor }))}
                  className="sr-only"
                />
                <span className="block font-medium text-ink">{c.nome}</span>
                <span className="block text-xs text-muted">{c.dica}</span>
              </label>
            ))}
          </div>
          <p className={erros.crt ? "mt-1 text-xs font-medium text-bad" : "hint"}>
            {erros.crt ?? "Na dúvida, pergunte ao seu contador. Tem que bater com o regime do cadastro da empresa."}
          </p>
        </div>
      </fieldset>

      <fieldset className={secao}>
        <legend className={legenda}>Endereço do estabelecimento</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-6">
          {campo("logradouro", "Rua", { className: "sm:col-span-4" })}
          {campo("numero", "Número", { className: "sm:col-span-2" })}
          {campo("bairro", "Bairro", { className: "sm:col-span-3" })}
          {campo("cep", "CEP", { className: "sm:col-span-3", inputMode: "numeric", placeholder: "00000-000" })}
          {campo("municipio", "Município", { className: "sm:col-span-3" })}
          <div className="sm:col-span-1">
            <label htmlFor="ff-uf" className="label">
              UF
            </label>
            <select id="ff-uf" name="uf" value={v.uf} onChange={muda("uf")} className={`input ${erros.uf ? "border-bad" : ""}`}>
              <option value="">-</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
          {campo("codigoMunicipio", "Código IBGE", {
            className: "sm:col-span-2",
            inputMode: "numeric",
            placeholder: "3550308",
            dica: "7 dígitos. Busque o nome da cidade no site do IBGE.",
          })}
        </div>
      </fieldset>

      <fieldset className={secao}>
        <legend className={legenda}>Padrões das notas</legend>
        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-3">
          {campo("aliquotaIcmsPadrao", "ICMS padrão", {
            inputMode: "decimal",
            sufixo: "%",
            placeholder: "18",
            dica: "Sugerido em cada item da NF-e. Dá para mudar item a item.",
          })}
          {campo("aliquotaIssPadrao", "ISS", {
            inputMode: "decimal",
            sufixo: "%",
            placeholder: "5",
            dica: "Alíquota do seu município, de 2% a 5%.",
          })}
          {campo("serieNfe", "Série", {
            inputMode: "numeric",
            dica: "Use 1 se nunca emitiu. Se já emite em outro sistema, use outra série para não repetir número.",
          })}
        </div>
      </fieldset>

      <fieldset className={secao}>
        <legend className={legenda}>Onde emitir</legend>

        <div className="clear-both grid gap-5 pt-1 sm:grid-cols-2">
          <div>
            <label htmlFor="ff-provedor" className="label">
              Provedor de emissão
            </label>
            <select
              id="ff-provedor"
              name="provedor"
              value={v.provedor}
              onChange={(e) => {
                const provedor = e.target.value;
                // O simulado não existe em produção: volta para homologação
                setV((x) => ({ ...x, provedor, ambiente: provedor === "simulado" ? "homologacao" : x.ambiente }));
              }}
              className="input"
            >
              <option value="simulado">Simulado (para testar, sem contrato)</option>
              <option value="focus">Focus NFe</option>
            </select>
            <p className={erros.provedor ? "mt-1 text-xs font-medium text-bad" : "hint"}>
              {erros.provedor ??
                (v.provedor === "simulado"
                  ? "Autoriza na hora uma nota de mentira, para você conhecer o fluxo."
                  : "Precisa de contrato com a Focus NFe e do token da empresa no painel deles.")}
            </p>
          </div>

          <div>
            <label htmlFor="ff-ambiente" className="label">
              Ambiente
            </label>
            <select
              id="ff-ambiente"
              name="ambiente"
              value={v.ambiente}
              onChange={muda("ambiente")}
              className={`input ${erros.ambiente ? "border-bad" : ""}`}
            >
              <option value="homologacao">Homologação (teste, sem valor fiscal)</option>
              <option value="producao" disabled={v.provedor === "simulado"}>
                Produção (nota de verdade)
              </option>
            </select>
            <p className={erros.ambiente ? "mt-1 text-xs font-medium text-bad" : "hint"}>
              {erros.ambiente ??
                (v.provedor === "simulado" ? "O simulado só funciona em homologação." : "Comece em homologação e confira as notas.")}
            </p>
          </div>
        </div>

        {v.provedor === "focus" && (
          <div>
            <label htmlFor="ff-token" className="label">
              Token da Focus NFe
            </label>
            <input
              id="ff-token"
              name="provedorToken"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={salvo ? "Deixe em branco para manter o token salvo" : "Cole o token aqui"}
              className={`input font-mono ${erros.provedorToken ? "border-bad" : ""}`}
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className={erros.provedorToken ? "text-xs font-medium text-bad" : "text-xs text-muted"}>
                {erros.provedorToken ??
                  (salvo ? (
                    <span className="font-medium text-good">Token salvo ✓</span>
                  ) : (
                    "Guardamos o token criptografado. Ele nunca volta para esta tela."
                  ))}
              </p>
              {salvo && (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="removerToken" checked={remover} onChange={(e) => setRemover(e.target.checked)} />
                  Apagar o token salvo
                </label>
              )}
            </div>
            <p className="hint">Use o token de homologação no ambiente de homologação e o de produção em produção.</p>
          </div>
        )}

        {v.ambiente === "producao" && !producaoComSimulado && (
          <div role="alert" className="rounded-lg border-2 border-bad bg-bad-soft px-4 py-3 text-sm text-ink">
            <p className="font-semibold text-bad">Produção emite nota de verdade.</p>
            <p className="mt-1">
              Cada nota vai para a SEFAZ ou para a prefeitura, tem valor fiscal e gera imposto a pagar. Errou? Só dá para
              cancelar dentro do prazo (24 horas na NF-e).
            </p>
            {!ambienteSalvoProducao && (
              <label className="mt-3 flex items-start gap-2 font-medium">
                <input type="checkbox" name="confirmaProducao" className="mt-0.5" />
                <span>Entendi. Quero emitir notas com valor fiscal.</span>
              </label>
            )}
            {erros.confirmaProducao && <p className="mt-1 text-xs font-medium text-bad">{erros.confirmaProducao}</p>}
          </div>
        )}
      </fieldset>

      <div className="flex justify-end border-t border-line pt-6">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pendente}>
          {pendente ? "Salvando..." : "Salvar dados fiscais"}
        </button>
      </div>
    </form>
  );
}
