"use client";

import { useRef, useState, useTransition } from "react";
import type { EstadoAcaoNota } from "@/app/app/empresas/[id]/notas/actions";

type Acao = () => Promise<EstadoAcaoNota>;

type Props = {
  status: string;
  xmlHref?: string;
  danfeHref?: string;
  atualizar: Acao;
  cancelar: (justificativa: string) => Promise<EstadoAcaoNota>;
  retentar: Acao;
};

export function AcoesNota({ status, xmlHref, danfeHref, atualizar, cancelar, retentar }: Props) {
  const [pendente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<EstadoAcaoNota>({});
  const [justificativa, setJustificativa] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);

  const rodar = (f: Acao) =>
    iniciar(async () => {
      setResultado(await f());
    });

  const tamanho = justificativa.trim().length;

  return (
    <div className="space-y-3 no-print">
      <div className="flex flex-wrap gap-2">
        {(status === "processando" || status === "autorizada" || status === "rejeitada") && (
          <button type="button" className="btn-ghost" disabled={pendente} onClick={() => rodar(atualizar)}>
            {pendente ? "Consultando..." : "Atualizar status"}
          </button>
        )}
        {status === "erro" && (
          <button type="button" className="btn-primary" disabled={pendente} onClick={() => rodar(retentar)}>
            {pendente ? "Enviando..." : "Tentar de novo"}
          </button>
        )}
        {xmlHref && (
          <a href={xmlHref} className="btn-ghost" download>
            Baixar XML
          </a>
        )}
        {danfeHref && (
          <a href={danfeHref} className="btn-ghost" target="_blank" rel="noopener noreferrer">
            Abrir DANFE
          </a>
        )}
        {status === "autorizada" && (
          <button
            type="button"
            className="btn-ghost text-bad"
            disabled={pendente}
            onClick={() => {
              setResultado({});
              dialogo.current?.showModal();
            }}
          >
            Cancelar nota
          </button>
        )}
      </div>

      {resultado.erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {resultado.erro}
        </p>
      )}
      {resultado.ok && (
        <p role="status" className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">
          {resultado.ok}
        </p>
      )}

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-cancelar"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            iniciar(async () => {
              const r = await cancelar(justificativa);
              setResultado(r);
              if (!r.erro) {
                setJustificativa("");
                dialogo.current?.close();
              }
            });
          }}
        >
          <h2 id="titulo-cancelar" className="display text-xl font-semibold">
            Cancelar esta nota?
          </h2>
          <p className="text-sm text-muted">
            O cancelamento é definitivo e só é aceito dentro do prazo (24 horas na NF-e). Depois disso, emita uma nota
            de devolução ou estorno.
          </p>
          <div>
            <label htmlFor="justificativa" className="label">
              Motivo do cancelamento
            </label>
            <textarea
              id="justificativa"
              rows={3}
              maxLength={255}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="input"
              aria-describedby="justificativa-dica"
              required
            />
            <p id="justificativa-dica" className={`hint tabular-nums ${tamanho > 0 && tamanho < 15 ? "text-bad" : ""}`}>
              De 15 a 255 caracteres. {tamanho}/255
            </p>
          </div>
          {resultado.erro && (
            <p role="alert" className="text-sm font-medium text-bad">
              {resultado.erro}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-ghost" onClick={() => dialogo.current?.close()}>
              Voltar
            </button>
            <button type="submit" className="btn-primary bg-bad hover:bg-bad" disabled={pendente || tamanho < 15}>
              {pendente ? "Cancelando..." : "Cancelar nota"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
