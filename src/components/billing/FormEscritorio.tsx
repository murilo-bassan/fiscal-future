"use client";

import Link from "next/link";
import { useActionState } from "react";
import { salvarEscritorio, type EstadoEscritorio } from "@/app/app/conta/actions";

export function FormEscritorio({ valor, editavel }: { valor: string | null; editavel: boolean }) {
  const [estado, acao, salvando] = useActionState<EstadoEscritorio, FormData>(salvarEscritorio, {});

  return (
    <form action={acao} className="space-y-3">
      <div>
        <label htmlFor="escritorio" className="label">
          Nome do escritório para os relatórios
        </label>
        <input
          id="escritorio"
          name="escritorio"
          className="input disabled:cursor-not-allowed disabled:opacity-60"
          defaultValue={valor ?? ""}
          maxLength={80}
          placeholder="Ex.: Silva & Souza Contabilidade"
          disabled={!editavel}
        />
        <p className="hint">
          {editavel ? (
            "Aparece no topo dos relatórios em PDF que você entrega aos clientes. Deixe em branco para usar Fiscal Future."
          ) : (
            <>
              Disponível no plano Escritório Contábil.{" "}
              <Link href="/app/conta?assinar=contador#planos" className="font-medium text-brand underline">
                Ver plano
              </Link>
            </>
          )}
        </p>
      </div>
      {editavel && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
          {estado.ok && <span className="text-sm text-good">Salvo.</span>}
          {estado.erro && (
            <span role="alert" className="text-sm text-bad">
              {estado.erro}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
