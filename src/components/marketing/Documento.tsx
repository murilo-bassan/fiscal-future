import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

/** Moldura para páginas de texto corrido (termos, privacidade). */
export function Documento({
  titulo,
  atualizado,
  children,
}: {
  titulo: string;
  atualizado: string;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20">
        <h1 className="display text-4xl leading-tight text-ink sm:text-5xl">{titulo}</h1>
        <p className="mt-3 text-sm text-muted">Atualizado em {atualizado}</p>
        <div className="mt-10 space-y-5 leading-relaxed text-ink/90 [&_h2]:pt-6 [&_h2]:font-display [&_h2]:tracking-tight [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
