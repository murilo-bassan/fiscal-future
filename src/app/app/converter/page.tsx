import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { iaDisponivel } from "@/lib/classificador";
import { DEFAULT_CENARIO } from "@/lib/tax/params";
import { Conversor } from "@/components/conversor/Conversor";
import { conversoesNoMes, resumo } from "@/app/api/converter/_lib/servico";

export const metadata: Metadata = { title: "Converter notas para o modelo novo" };

export default async function ConverterPage() {
  const u = await exigirUsuario();
  const p = plano(u.plano);
  const [usados, empresas, recentes] = await Promise.all([
    conversoesNoMes(u.id),
    db.empresa.findMany({ where: { userId: u.id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.conversaoNota.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, numero: true, emitente: true, ano: true, createdAt: true, chave: true, resultado: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <h1 className="display text-2xl font-semibold text-ink sm:text-3xl">Converter notas para o modelo novo</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Envie o XML de uma NF-e ou NFC-e que você já emitiu e veja como ela fica com IBS e CBS: a classificação de
          cada item, o imposto no ano escolhido e o XML no layout novo.
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-ink">
          Uma nota autorizada não pode ser alterada. O resultado serve de referência para ajustar o cadastro do ERP e
          emitir as próximas notas; o XML gerado não tem assinatura nem valor fiscal.
        </p>
      </header>

      <Conversor
        lote={p.classificacaoLote}
        usados={usados}
        limite={p.conversoesMes}
        iaAtiva={iaDisponivel()}
        empresas={empresas}
        historico={recentes.map(resumo)}
        cenarioPadrao={DEFAULT_CENARIO.id}
      />
    </div>
  );
}
