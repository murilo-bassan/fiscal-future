import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { emitenteDaEmpresa, lerEndereco } from "@/lib/emissao/emitente";
import { fracaoParaCampo } from "@/components/app/formato";
import { FormFiscal } from "@/components/notas/FormFiscal";
import { formatarDocumento } from "@/components/notas/rotulos";
import { empresaDoUsuario } from "../../dados";
import { salvarDadosFiscais } from "./actions";

export const metadata: Metadata = { title: "Dados fiscais" };

export default async function DadosFiscaisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  const { empresa, perfil } = await empresaDoUsuario(id, u.id);
  const base = `/app/empresas/${empresa.id}`;
  const end = lerEndereco(empresa.endereco);
  const situacao = emitenteDaEmpresa(empresa);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`${base}/notas`} className="text-sm text-muted hover:text-ink">
        Notas fiscais de {empresa.nome}
      </Link>
      <h1 className="display mt-3 text-3xl font-semibold text-ink sm:text-4xl">Dados fiscais</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        O que vai no cabeçalho de toda nota emitida por esta empresa. Preencha uma vez; dá para mudar quando quiser.
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted">CNPJ</dt>
          <dd className="font-medium text-ink tabular-nums">
            {empresa.cnpj ? (
              formatarDocumento(empresa.cnpj)
            ) : (
              <Link href={`${base}/editar`} className="text-bad underline">
                Informe em Editar dados
              </Link>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Regime do cadastro</dt>
          <dd className="font-medium text-ink">
            {perfil ? { simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" }[perfil.regime] : "Não informado"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Situação</dt>
          <dd className={`font-medium ${situacao.ok ? "text-good" : "text-ink"}`}>
            {situacao.ok ? "Pronta para emitir" : `Faltam ${situacao.faltando.length} ${situacao.faltando.length === 1 ? "item" : "itens"}`}
          </dd>
        </div>
      </dl>

      <div className="mt-8">
        <FormFiscal
          acao={salvarDadosFiscais.bind(null, empresa.id)}
          tokenSalvo={!!empresa.provedorToken}
          crtSugerido={perfil ? (perfil.regime === "simples" ? "1" : "3") : undefined}
          inicial={{
            razaoSocial: empresa.razaoSocial ?? "",
            inscricaoEstadual: empresa.inscricaoEstadual ?? "",
            inscricaoMunicipal: empresa.inscricaoMunicipal ?? "",
            crt: empresa.crt ?? "",
            logradouro: end.logradouro,
            numero: end.numero,
            bairro: end.bairro,
            cep: end.cep,
            municipio: end.municipio,
            codigoMunicipio: end.codigoMunicipio,
            uf: end.uf,
            aliquotaIcmsPadrao: empresa.aliquotaIcmsPadrao != null ? fracaoParaCampo(empresa.aliquotaIcmsPadrao) : "",
            aliquotaIssPadrao: empresa.aliquotaIssPadrao != null ? fracaoParaCampo(empresa.aliquotaIssPadrao) : "",
            serieNfe: empresa.serieNfe,
            ambiente: empresa.ambiente,
            provedor: empresa.provedor,
          }}
        />
      </div>
    </div>
  );
}
