import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { PerfilForm } from "@/components/app/PerfilForm";
import { BotaoExcluir } from "@/components/app/BotaoExcluir";
import { atualizarEmpresa, excluirEmpresa } from "../../actions";
import { empresaDoUsuario } from "../../dados";

export const metadata: Metadata = { title: "Editar empresa" };

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const { empresa, perfil } = await empresaDoUsuario(id, u.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/app/empresas/${empresa.id}`} className="text-sm text-muted hover:text-ink">
        Voltar para o resultado
      </Link>
      <h1 className="display mt-3 text-3xl font-semibold text-ink sm:text-4xl">Editar {empresa.nome}</h1>
      {!perfil && (
        <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
          Não conseguimos ler os dados salvos desta empresa. Preencha o formulário de novo.
        </p>
      )}
      <div className="mt-8">
        <PerfilForm
          acao={atualizarEmpresa.bind(null, empresa.id)}
          inicial={perfil ?? { ...PERFIL_VAZIO, nome: empresa.nome }}
          cnpj={empresa.cnpj}
          cenarioId={empresa.cenarioId}
          textoBotao="Salvar e recalcular"
          cancelarHref={`/app/empresas/${empresa.id}`}
        />
      </div>
      <section className="mt-12 border-t border-line pt-6">
        <h2 className="text-base font-semibold text-ink">Excluir empresa</h2>
        <p className="mt-1 text-sm text-muted">
          Apaga a empresa e a simulação. Não dá para desfazer.
        </p>
        <form action={excluirEmpresa.bind(null, empresa.id)} className="mt-3">
          <BotaoExcluir nome={empresa.nome} />
        </form>
      </section>
    </div>
  );
}

const PERFIL_VAZIO = {
  nome: "",
  regime: "simples",
  atividade: "comercio",
  receitaAnual: 0,
  comprasAnuais: 0,
  despesasCreditaveis: 0,
  despesasNaoCreditaveis: 0,
  aliquotaIcmsVendas: 0,
  aliquotaIcmsCompras: 0,
  aliquotaIss: 0,
  aliquotaIpiVendas: 0,
  aliquotaIpiCompras: 0,
  aliquotaSimples: 0,
  reducaoVendas: "padrao",
  reducaoCompras: "padrao",
  percentualB2B: 0,
  percentualComprasSimples: 0,
  prazoMedioRecebimentoDias: 0,
} as const;
