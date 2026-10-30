import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { plano } from "@/lib/planos";
import { sair } from "@/app/(auth)/actions";
import { NavApp } from "@/components/app/NavApp";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const p = plano(u.plano);
  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 pt-4">
            <Link href="/app" className="display text-xl font-semibold text-ink">
              Fiscal Future
            </Link>
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <Link
                href="/app/conta"
                className="truncate rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-strong hover:underline"
                title="Ver ou mudar o plano"
              >
                Plano {p.nome}
              </Link>
              <form action={sair}>
                <button type="submit" className="text-muted hover:text-ink">
                  Sair
                </button>
              </form>
            </div>
          </div>
          <NavApp />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
