import Link from "next/link";
import { foco } from "./Header";

export function Footer() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="max-w-md">
          <p className="display text-xl font-semibold text-ink">Fiscal Future</p>
          <p className="mt-2 text-muted">
            Estimativas baseadas na EC 132/2023 e LC 214/2025. Confira com seu contador.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-muted md:justify-end">
          <Link href="/precos" className={`hover:text-ink ${foco}`}>
            Preços
          </Link>
          <Link href="/entrar" className={`hover:text-ink ${foco}`}>
            Entrar
          </Link>
          <Link href="/termos" className={`hover:text-ink ${foco}`}>
            Termos de uso
          </Link>
          <Link href="/privacidade" className={`hover:text-ink ${foco}`}>
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
