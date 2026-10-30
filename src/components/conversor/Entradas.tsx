"use client";

import Link from "next/link";
import { useState } from "react";
import { CSV_MODELO } from "@/lib/planilhaNotas";
import { MAX_ARQUIVOS } from "./modelo";

export type FormaEntrada = "xml" | "documento" | "digitar" | "planilha";

export const FORMAS: { id: FormaEntrada; nome: string; dica: string }[] = [
  { id: "xml", nome: "XML", dica: "Arquivo da NF-e ou NFC-e" },
  { id: "documento", nome: "PDF ou foto", dica: "DANFE, DANFSE ou NFS-e da prefeitura" },
  { id: "digitar", nome: "Digitar", dica: "Só com a nota em papel ou na tela" },
  { id: "planilha", nome: "Planilha", dica: "Várias notas num CSV" },
];

/** Abas de forma de entrada: 2×2 no celular, uma linha a partir de sm. */
export function AbasEntrada({ atual, onTrocar }: { atual: FormaEntrada; onTrocar: (f: FormaEntrada) => void }) {
  function teclado(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const prox = FORMAS[(i + d + FORMAS.length) % FORMAS.length];
    onTrocar(prox.id);
    document.getElementById(`aba-${prox.id}`)?.focus();
  }
  return (
    <div role="tablist" aria-label="Como você tem a nota" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {FORMAS.map((f, i) => {
        const ativa = atual === f.id;
        return (
          <button
            key={f.id}
            id={`aba-${f.id}`}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={`painel-${f.id}`}
            tabIndex={ativa ? 0 : -1}
            onClick={() => onTrocar(f.id)}
            onKeyDown={(e) => teclado(e, i)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${
              ativa ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink/40"
            }`}
          >
            <span className="block text-sm font-semibold text-ink">{f.nome}</span>
            <span className="block text-xs leading-snug text-muted">{f.dica}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- zona ---- */

function ZonaArquivo({
  inputId,
  titulo,
  detalhe,
  accept,
  multiple,
  onArquivos,
}: {
  inputId: string;
  titulo: string;
  detalhe: string;
  accept: string;
  multiple?: boolean;
  onArquivos: (f: File[]) => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  return (
    <label
      htmlFor={inputId}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        onArquivos([...e.dataTransfer.files]);
      }}
      className={`flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-brand ${
        arrastando ? "border-brand bg-brand-soft" : "border-line bg-paper hover:border-ink/40"
      }`}
    >
      <span className="text-base font-semibold text-ink">{titulo}</span>
      <span className="text-sm text-muted">
        ou <span className="font-medium text-brand underline">escolha no aparelho</span>
      </span>
      <span className="text-xs text-muted">{detalhe}</span>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onArquivos([...e.target.files]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function ArquivoEscolhido({ nome, onRemover }: { nome: string; onRemover: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md bg-paper px-3 py-1.5">
      <span className="truncate text-ink">{nome}</span>
      <button type="button" className="shrink-0 text-xs text-muted hover:text-bad" onClick={onRemover}>
        Remover
      </button>
    </li>
  );
}

/* ---------------------------------------------------------- XML ---- */

export function EntradaXml({
  lote,
  arquivos,
  onEscolher,
  onRemover,
}: {
  lote: boolean;
  arquivos: File[];
  onEscolher: (f: File[]) => void;
  onRemover: (f: File) => void;
}) {
  return (
    <div>
      <ZonaArquivo
        inputId="xmls"
        titulo={lote ? "Arraste os XMLs das notas aqui" : "Arraste o XML da nota aqui"}
        detalhe={`NF-e ou NFC-e, até 2 MB cada${lote ? `, até ${MAX_ARQUIVOS} por vez` : ", 1 por vez"}`}
        accept=".xml,text/xml,application/xml"
        multiple={lote}
        onArquivos={onEscolher}
      />
      {arquivos.length > 0 && (
        <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
          {arquivos.map((f) => (
            <ArquivoEscolhido key={`${f.name}-${f.size}`} nome={f.name} onRemover={() => onRemover(f)} />
          ))}
        </ul>
      )}
      {!lote && (
        <p className="mt-3 text-xs text-muted">
          Quer converter um mês inteiro de notas?{" "}
          <Link href="/app/conta?assinar=profissional" className="font-medium text-brand underline">
            No plano Profissional
          </Link>{" "}
          você envia até {MAX_ARQUIVOS} de uma vez.
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------- PDF ou foto ---- */

const TIPOS_DOCUMENTO = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Validação no navegador; o servidor confere de novo, inclusive pela assinatura dos bytes. */
export function validarDocumentoNoNavegador(f: File): string | null {
  if (!TIPOS_DOCUMENTO.includes(f.type)) {
    return /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)
      ? "Fotos HEIC do iPhone não são aceitas. Nas configurações da câmera, escolha “Mais compatível” ou envie um print."
      : "Envie um PDF ou uma foto em JPG, PNG ou WEBP.";
  }
  if (f.size === 0) return "O arquivo está vazio.";
  if (f.type === "application/pdf" && f.size > 10 * 1024 * 1024) return "PDF grande demais (máx. 10 MB).";
  if (f.type !== "application/pdf" && f.size > 5 * 1024 * 1024) return "Foto grande demais (máx. 5 MB).";
  return null;
}

export function EntradaDocumento({
  disponivel,
  arquivo,
  onEscolher,
  onRemover,
  onDigitar,
}: {
  disponivel: boolean;
  arquivo: File | null;
  onEscolher: (f: File[]) => void;
  onRemover: () => void;
  onDigitar: () => void;
}) {
  if (!disponivel) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-paper px-5 py-8">
        <p className="text-base font-semibold text-ink">A leitura de PDF e foto está indisponível agora</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          Enquanto isso, você pode digitar os dados da nota. Leva poucos minutos para uma nota com poucos itens.
        </p>
        <button type="button" className="btn-ghost mt-4" onClick={onDigitar}>
          Digitar a nota
        </button>
      </div>
    );
  }
  return (
    <div>
      <ZonaArquivo
        inputId="documento"
        titulo="Arraste o PDF ou a foto da nota aqui"
        detalhe="PDF até 10 MB e 20 páginas, foto até 5 MB. Vale DANFE, DANFSE e NFS-e de qualquer prefeitura."
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onArquivos={onEscolher}
      />
      <label className="btn-ghost mt-3 w-full cursor-pointer sm:hidden" htmlFor="camera">
        Tirar foto da nota
        <input
          id="camera"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) onEscolher([...e.target.files]);
            e.target.value = "";
          }}
        />
      </label>
      {arquivo && (
        <ul className="mt-3 text-sm">
          <ArquivoEscolhido nome={arquivo.name || "foto"} onRemover={onRemover} />
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        A IA lê os dados da nota e você confere antes de usar. Para a foto: nota inteira no quadro, sem sombra, com
        boa luz. O arquivo não fica guardado; só os dados lidos.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- planilha ---- */

export type ErroLinha = { linha: number; mensagem: string };

const HREF_MODELO = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_MODELO)}`;

export function EntradaPlanilha({
  lote,
  arquivo,
  erros,
  onEscolher,
  onRemover,
}: {
  lote: boolean;
  arquivo: File | null;
  erros: ErroLinha[];
  onEscolher: (f: File[]) => void;
  onRemover: () => void;
}) {
  return (
    <div>
      <ZonaArquivo
        inputId="planilha"
        titulo="Arraste a planilha .csv aqui"
        detalhe={lote ? `Uma linha por item, até ${MAX_ARQUIVOS} notas por planilha` : "Uma linha por item, 1 nota por vez no seu plano"}
        accept=".csv,text/csv"
        onArquivos={onEscolher}
      />
      {arquivo && (
        <ul className="mt-3 text-sm">
          <ArquivoEscolhido nome={arquivo.name} onRemover={onRemover} />
        </ul>
      )}
      <div className="mt-3 space-y-1 text-xs text-muted">
        <p>
          <a href={HREF_MODELO} download="modelo-notas-fiscal-future.csv" className="font-medium text-brand underline">
            Baixar o modelo da planilha
          </a>{" "}
          e preencher uma linha por item. Linhas com o mesmo número e o mesmo emitente viram uma nota só.
        </p>
        <p>Separador “;” ou “,”. Valores com vírgula decimal (25,50) funcionam; tributos em reais.</p>
      </div>
      {erros.length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-bad-soft px-3 py-2">
          <p className="text-sm font-medium text-bad">
            {erros.length === 1 ? "1 linha com problema" : `${erros.length} linhas com problema`}. As notas dessas linhas
            ficaram de fora.
          </p>
          <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-ink">
            {erros.slice(0, 100).map((e, i) => (
              <li key={i}>
                <span className="font-medium">Linha {e.linha}:</span> {e.mensagem}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
