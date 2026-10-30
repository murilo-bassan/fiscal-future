import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { classificacoesNoMes } from "@/lib/uso";
import { iaDisponivel, type ItemClassificado } from "@/lib/classificador";
import { REDUCOES } from "@/lib/tax/params";
import { Classificador } from "@/components/classificar/Classificador";
import { Historico, type ItemHistorico } from "@/components/classificar/Historico";

export const metadata: Metadata = { title: "Classificar produtos e serviços" };

export default async function ClassificarPage() {
  const u = await exigirUsuario();
  const p = plano(u.plano);
  const [usados, recentes] = await Promise.all([
    classificacoesNoMes(u.id),
    db.classificacao.findMany({
      where: { userId: u.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, descricao: true, resultado: true, createdAt: true },
    }),
  ]);

  const historico: ItemHistorico[] = recentes.map((c) => ({
    id: c.id,
    descricao: c.descricao,
    createdAt: c.createdAt,
    item: lerResultado(c.resultado),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1.5">
        <h1 className="display text-2xl font-semibold text-ink sm:text-3xl">Classificar produtos e serviços</h1>
        <p className="max-w-2xl text-sm text-muted">
          Descubra se o item paga IBS e CBS cheios, com redução de 30% ou 60%, ou alíquota zero. Cada resultado diz o
          que você precisa conferir antes de emitir nota.
        </p>
      </header>

      <Classificador lote={p.classificacaoLote} usados={usados} limite={p.classificacoesMes} iaAtiva={iaDisponivel()} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Últimas classificações</h2>
        <Historico itens={historico} />
      </section>
    </div>
  );
}

/** O JSON vem do banco: valida o mínimo antes de mostrar. */
function lerResultado(json: string): ItemClassificado | null {
  try {
    const r = JSON.parse(json) as Partial<ItemClassificado>;
    if (!r || typeof r.categoriaNome !== "string" || !r.reducao || !(r.reducao in REDUCOES)) return null;
    if (r.confianca !== "alta" && r.confianca !== "media" && r.confianca !== "baixa") return null;
    return r as ItemClassificado;
  } catch {
    return null;
  }
}
