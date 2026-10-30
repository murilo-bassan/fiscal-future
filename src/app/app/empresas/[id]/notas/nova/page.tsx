import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { emitenteDaEmpresa, lerEndereco } from "@/lib/emissao/emitente";
import { notasNoMes } from "@/lib/emissao/servico";
import type { RascunhoNota } from "@/lib/emissao/tipos";
import { converterNota, rascunhoDeConversao } from "@/lib/nfe";
import { notaDoRegistro } from "@/app/api/converter/_lib/servico";
import { ConviteDadosFiscais, ConviteUpgrade } from "@/components/notas/Convites";
import { FormNota } from "@/components/notas/FormNota";
import { FaixaSemValor } from "@/components/notas/Selos";
import { cenarioPorId, empresaDoUsuario } from "../../../dados";
import { emitirNotaAction } from "../actions";

export const metadata: Metadata = { title: "Emitir nota" };

type Origem = { rascunho?: RascunhoNota; aviso?: string; alerta?: string };

async function rascunhoDaConversao(conversaoId: string, userId: string, cnpjEmpresa: string | null, ano: number): Promise<Origem> {
  const c = await db.conversaoNota.findFirst({
    where: { id: conversaoId, userId },
    select: { xmlOriginal: true, fonte: true, resultado: true, numero: true },
  });
  if (!c) return { alerta: "Não encontramos essa conversão. Comece a nota do zero." };
  try {
    // XML ou dados da nota (digitada, PDF/foto, planilha)
    const nota = notaDoRegistro(c);
    // Mantém as classificações que o usuário escolheu na conversão
    const classificacoes: Record<number, string> = {};
    try {
      const salvo = JSON.parse(c.resultado) as { itens?: { nItem: number; categoria?: { id?: string } }[] };
      for (const it of salvo.itens ?? []) if (it.categoria?.id) classificacoes[it.nItem] = it.categoria.id;
    } catch {
      // resultado ilegível: o conversor classifica de novo
    }
    const convertida = converterNota(nota, { ano, classificacoes });
    const rascunho = rascunhoDeConversao(nota, convertida);
    const outroCnpj = cnpjEmpresa && nota.emitente.documento && nota.emitente.documento !== cnpjEmpresa;
    return {
      rascunho,
      aviso: `Rascunho criado a partir da nota nº ${c.numero || nota.numero}. Confira cliente, itens e valores antes de emitir.`,
      alerta: outroCnpj ? "A nota antiga foi emitida por outro CNPJ. Confira se esta é a empresa certa." : undefined,
    };
  } catch {
    return { alerta: "Não conseguimos ler a nota antiga desta conversão. Comece a nota do zero." };
  }
}

export default async function NovaNotaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversao?: string | string[] }>;
}) {
  const [{ id }, sp, u] = await Promise.all([params, searchParams, exigirUsuario()]);
  const { empresa } = await empresaDoUsuario(id, u.id);
  const base = `/app/empresas/${empresa.id}`;
  const limite = plano(u.plano).notasMes;

  const cabecalho = (
    <header>
      <Link href={`${base}/notas`} className="text-sm text-muted hover:text-ink">
        Notas de {empresa.nome}
      </Link>
      <h1 className="display mt-1 text-2xl font-semibold text-ink sm:text-3xl">Emitir nota</h1>
    </header>
  );

  if (limite === 0) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <ConviteUpgrade />
      </div>
    );
  }

  const geral = emitenteDaEmpresa(empresa);
  if (!geral.ok) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <ConviteDadosFiscais empresaId={empresa.id} faltando={geral.faltando} />
      </div>
    );
  }

  const usadas = await notasNoMes(u.id);
  if (usadas >= limite) {
    return (
      <div className="space-y-6">
        {cabecalho}
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink">
          Você já emitiu {usadas} de {limite} notas este mês.{" "}
          <Link href="/app/conta" className="font-semibold text-brand underline">
            Mude de plano
          </Link>{" "}
          para emitir mais.
        </p>
      </div>
    );
  }

  const faltaDe = (t: "nfe" | "nfse") => {
    const r = emitenteDaEmpresa(empresa, t);
    return r.ok ? [] : r.faltando;
  };
  const e = geral.emitente;
  const ano = new Date().getFullYear();
  const cenario = cenarioPorId(empresa.cenarioId);
  const conversaoId = Array.isArray(sp.conversao) ? sp.conversao[0] : sp.conversao;
  const origem: Origem = conversaoId ? await rascunhoDaConversao(conversaoId, u.id, empresa.cnpj, ano) : {};

  return (
    <div className="space-y-6">
      {cabecalho}
      <FaixaSemValor ambiente={e.ambiente} provedor={e.provedor} />
      {origem.aviso && (
        <p role="status" className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-ink">
          {origem.aviso}
        </p>
      )}
      {origem.alerta && (
        <p role="alert" className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink">
          {origem.alerta}
        </p>
      )}
      <FormNota
        acao={emitirNotaAction.bind(null, empresa.id)}
        emitente={{ crt: e.crt, regime: e.regime, aliquotaIssPadrao: e.aliquotaIssPadrao }}
        ufEmitente={lerEndereco(empresa.endereco).uf}
        aliquotaIcmsPadrao={empresa.aliquotaIcmsPadrao}
        ano={ano}
        cenario={cenario}
        inicial={origem.rascunho}
        faltaPorTipo={{ nfe: faltaDe("nfe"), nfse: faltaDe("nfse") }}
        fiscalHref={`${base}/fiscal`}
        cancelarHref={`${base}/notas`}
        teste={e.ambiente !== "producao" || e.provedor === "simulado"}
      />
    </div>
  );
}
