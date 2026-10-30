"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", nome: "Empresas", ativo: (p: string) => p === "/app" || p.startsWith("/app/empresas") },
  { href: "/app/converter", nome: "Converter notas", ativo: (p: string) => p.startsWith("/app/converter") },
  { href: "/app/classificar", nome: "Classificar produtos", ativo: (p: string) => p.startsWith("/app/classificar") },
  { href: "/app/conta", nome: "Conta", ativo: (p: string) => p.startsWith("/app/conta") },
];

export function NavApp() {
  const p = usePathname() ?? "";
  return (
    <nav aria-label="Área logada" className="-mb-px flex gap-5 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const ativo = l.ativo(p);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={ativo ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 py-3 font-medium transition-colors ${
              ativo ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {l.nome}
          </Link>
        );
      })}
    </nav>
  );
}
