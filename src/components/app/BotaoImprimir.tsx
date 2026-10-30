"use client";

export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      Imprimir ou salvar PDF
    </button>
  );
}
