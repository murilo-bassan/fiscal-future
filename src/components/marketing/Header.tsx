import Link from "next/link";

export const foco =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function Header() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className={`display text-2xl font-semibold text-ink ${foco}`}>
          ZeroAbi
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm sm:gap-4">
          <Link
            href="/precos"
            className={`rounded-md px-2 py-1.5 text-muted hover:text-ink ${foco}`}
          >
            Preços
          </Link>
          <Link
            href="/entrar"
            className={`rounded-md px-2 py-1.5 text-muted hover:text-ink ${foco}`}
          >
            Entrar
          </Link>
          <Link href="/cadastrar" className={`btn-primary ml-1 px-3 py-2 ${foco}`}>
            Começar
          </Link>
        </nav>
      </div>
    </header>
  );
}
