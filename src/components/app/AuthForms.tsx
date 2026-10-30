"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrar, entrar, type EstadoAuth } from "@/app/(auth)/actions";

function Erro({ texto, id }: { texto?: string; id: string }) {
  if (!texto) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-bad">
      {texto}
    </p>
  );
}

export function EntrarForm() {
  const [estado, acao, pendente] = useActionState<EstadoAuth, FormData>(entrar, {});
  return (
    <form action={acao} className="space-y-4" noValidate>
      {estado.erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {estado.erro}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.valores?.email}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="senha" className="label">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pendente}>
        {pendente ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastrar" className="font-medium text-brand underline-offset-2 hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}

export function CadastrarForm({ plano }: { plano?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoAuth, FormData>(cadastrar, {});
  const c = estado.campos ?? {};
  return (
    <form action={acao} className="space-y-4" noValidate>
      {plano && <input type="hidden" name="plano" value={plano} />}
      {estado.erro && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {estado.erro}
        </p>
      )}
      <div>
        <label htmlFor="nome" className="label">
          Seu nome
        </label>
        <input
          id="nome"
          name="nome"
          autoComplete="name"
          required
          defaultValue={estado.valores?.nome}
          aria-invalid={!!c.nome}
          aria-describedby={c.nome ? "erro-nome" : undefined}
          className="input"
        />
        <Erro id="erro-nome" texto={c.nome} />
      </div>
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.valores?.email}
          aria-invalid={!!c.email}
          aria-describedby={c.email ? "erro-email" : undefined}
          className="input"
        />
        <Erro id="erro-email" texto={c.email} />
      </div>
      <div>
        <label htmlFor="senha" className="label">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={!!c.senha}
          aria-describedby={c.senha ? "erro-senha" : "dica-senha"}
          className="input"
        />
        {c.senha ? (
          <Erro id="erro-senha" texto={c.senha} />
        ) : (
          <p id="dica-senha" className="hint">
            Pelo menos 8 caracteres.
          </p>
        )}
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pendente}>
        {pendente ? "Criando conta..." : "Criar conta"}
      </button>
      <p className="text-xs text-muted">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="underline underline-offset-2">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline underline-offset-2">
          Política de privacidade
        </Link>
        .
      </p>
      <p className="text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-brand underline-offset-2 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
