import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";
import { PerfilForm } from "@/components/app/PerfilForm";
import { criarEmpresa } from "../actions";

export const metadata: Metadata = { title: "Nova empresa" };

export default async function NovaEmpresaPage() {
  const u = await exigirUsuario();
  const p = plano(u.plano);
  const total = await db.empresa.count({ where: { userId: u.id } });
  const noLimite = total >= p.empresas;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app" className="text-sm text-muted hover:text-ink">
        Voltar para empresas
      </Link>
      <h1 className="display mt-3 text-3xl font-semibold text-ink sm:text-4xl">Nova empresa</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Preencha com os números dos últimos 12 meses. Valores aproximados bastam para uma primeira
        estimativa; o contador pode refinar depois.
      </p>
      {noLimite ? (
        <div className="card mt-8 bg-accent-soft">
          <h2 className="display text-xl font-semibold text-ink">Você chegou ao limite do plano {p.nome}</h2>
          <p className="mt-2 text-sm text-ink">
            O plano {p.nome} permite {p.empresas} {p.empresas === 1 ? "empresa" : "empresas"}. Para
            simular outra, mude de plano ou edite uma empresa existente.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/app/conta" className="btn-primary">
              Ver planos
            </Link>
            <Link href="/app" className="btn-ghost">
              Voltar
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <PerfilForm acao={criarEmpresa} textoBotao="Ver o impacto da reforma" cancelarHref="/app" />
        </div>
      )}
    </div>
  );
}
