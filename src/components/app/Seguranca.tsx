"use client";

import { useActionState, useState, useTransition } from "react";
import {
  confirmar2fa,
  desativar2fa,
  excluirConta,
  iniciar2fa,
  sairDeTodos,
  trocarSenha,
  type Configuracao2fa,
  type EstadoSeguranca,
} from "@/app/app/conta/seguranca";

function Retorno({ estado }: { estado: EstadoSeguranca }) {
  if (estado.erro) {
    return (
      <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
        {estado.erro}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p role="status" className="rounded-lg bg-good-soft px-3 py-2 text-sm text-good">
        {estado.ok}
      </p>
    );
  }
  return null;
}

function Campo({ id, rotulo, ...rest }: { id: string; rotulo: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {rotulo}
      </label>
      <input id={id} name={id} className="input" required {...rest} />
    </div>
  );
}

export function FormTrocarSenha() {
  const [estado, acao, pendente] = useActionState<EstadoSeguranca, FormData>(trocarSenha, {});
  return (
    <form action={acao} className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Trocar a senha</h3>
      <Retorno estado={estado} />
      <Campo id="atual" rotulo="Senha atual" type="password" autoComplete="current-password" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="nova" rotulo="Senha nova" type="password" autoComplete="new-password" minLength={8} />
        <Campo id="confirmacao" rotulo="Repita a senha nova" type="password" autoComplete="new-password" />
      </div>
      <button className="btn-primary" disabled={pendente}>
        {pendente ? "Salvando..." : "Trocar senha"}
      </button>
    </form>
  );
}

export function DuasEtapas({ ativo }: { ativo: boolean }) {
  const [config, setConfig] = useState<Configuracao2fa | null>(null);
  const [gerando, iniciar] = useTransition();
  const [estadoConf, confirmar, confirmando] = useActionState<EstadoSeguranca, FormData>(confirmar2fa, {});
  const [estadoDes, desativar, desativando] = useActionState<EstadoSeguranca, FormData>(desativar2fa, {});

  if (ativo) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Verificação em duas etapas</h3>
        <p className="text-sm text-good">Ativa. Pedimos um código do aplicativo autenticador em cada login.</p>
        <Retorno estado={estadoConf.ok ? estadoConf : {}} />
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted hover:text-ink">Desativar</summary>
          <form action={desativar} className="mt-3 space-y-3">
            <Retorno estado={estadoDes} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="senha" rotulo="Senha atual" type="password" autoComplete="current-password" />
              <Campo id="codigo" rotulo="Código do aplicativo" inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
            </div>
            <button className="btn-ghost" disabled={desativando}>
              {desativando ? "Desativando..." : "Desativar verificação em duas etapas"}
            </button>
          </form>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Verificação em duas etapas</h3>
      <p className="text-sm text-muted">
        Recomendada: quem descobrir a sua senha ainda vai precisar do código do seu celular para emitir notas em nome
        das suas empresas.
      </p>
      <Retorno estado={estadoDes.ok ? estadoDes : {}} />
      {config && "erro" in config && <Retorno estado={{ erro: config.erro }} />}
      {config && "qr" in config ? (
        <form action={confirmar} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
            <li>Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password...).</li>
            <li>Leia o QR code abaixo ou digite a chave manualmente.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerado no servidor */}
          <img src={config.qr} alt="QR code para o aplicativo autenticador" width={180} height={180} className="rounded-lg bg-white p-2" />
          <p className="text-xs text-muted">
            Chave: <code className="break-all font-mono text-ink">{config.segredo.replace(/(.{4})/g, "$1 ").trim()}</code>
          </p>
          <Retorno estado={estadoConf} />
          <div className="max-w-xs">
            <Campo id="codigo" rotulo="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
          </div>
          <button className="btn-primary" disabled={confirmando}>
            {confirmando ? "Conferindo..." : "Confirmar e ativar"}
          </button>
        </form>
      ) : (
        <button type="button" className="btn-primary" disabled={gerando} onClick={() => iniciar(async () => setConfig(await iniciar2fa()))}>
          {gerando ? "Gerando..." : "Ativar"}
        </button>
      )}
    </div>
  );
}

export function SairDeTodos() {
  const [estado, setEstado] = useState<EstadoSeguranca>({});
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Sessões</h3>
      <p className="text-sm text-muted">Esqueceu a conta aberta em outro computador? Encerre todas as sessões, menos esta.</p>
      <Retorno estado={estado} />
      <button type="button" className="btn-ghost" disabled={pendente} onClick={() => iniciar(async () => setEstado(await sairDeTodos()))}>
        {pendente ? "Encerrando..." : "Sair de todos os outros aparelhos"}
      </button>
    </div>
  );
}

export function ExcluirConta() {
  const [estado, acao, pendente] = useActionState<EstadoSeguranca, FormData>(excluirConta, {});
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-bad">Excluir a conta</summary>
      <form action={acao} className="mt-3 space-y-3">
        <p className="text-ink">
          Apaga para sempre a conta, as empresas, as notas, as conversões e o histórico, e cancela a assinatura.{" "}
          <strong>Baixe antes os XML das notas:</strong> a lei obriga a empresa a guardá-los por 5 anos.
        </p>
        <Retorno estado={estado} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="senha" rotulo="Senha atual" type="password" autoComplete="current-password" />
          <Campo id="confirmacao" rotulo="Digite EXCLUIR" autoComplete="off" />
        </div>
        <button className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={pendente}>
          {pendente ? "Excluindo..." : "Excluir conta para sempre"}
        </button>
      </form>
    </details>
  );
}
