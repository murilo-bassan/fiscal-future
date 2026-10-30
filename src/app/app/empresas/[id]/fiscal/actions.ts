"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { criptografar } from "@/lib/cripto";
import { db } from "@/lib/db";
import { lerPercentual } from "@/components/app/formato";

export type EstadoFiscal = {
  erro?: string;
  ok?: string;
  campos?: Record<string, string>;
  tokenSalvo?: boolean;
};

const txt = (form: FormData, k: string, max = 120) => String(form.get(k) ?? "").trim().slice(0, max);

export async function salvarDadosFiscais(empresaId: string, _: EstadoFiscal, form: FormData): Promise<EstadoFiscal> {
  const u = await exigirUsuario();
  const atual = await db.empresa.findFirst({
    where: { id: empresaId, userId: u.id },
    select: { id: true, provedorToken: true, ambiente: true },
  });
  if (!atual) return { erro: "Empresa não encontrada." };

  const campos: Record<string, string> = {};

  const razaoSocial = txt(form, "razaoSocial", 150);
  const ieBruta = txt(form, "inscricaoEstadual", 20).toUpperCase();
  const inscricaoEstadual = ieBruta === "ISENTO" ? "ISENTO" : ieBruta.replace(/\D/g, "");
  if (ieBruta && ieBruta !== "ISENTO" && !/^\d{2,14}$/.test(inscricaoEstadual))
    campos.inscricaoEstadual = "Só números (até 14) ou ISENTO.";
  const inscricaoMunicipal = txt(form, "inscricaoMunicipal", 15).replace(/[^\dA-Za-z]/g, "");

  const crt = txt(form, "crt");
  if (crt && !["1", "2", "3", "4"].includes(crt)) campos.crt = "Escolha uma opção.";

  const endereco = {
    logradouro: txt(form, "logradouro", 255),
    numero: txt(form, "numero", 60),
    bairro: txt(form, "bairro", 60),
    cep: txt(form, "cep").replace(/\D/g, ""),
    municipio: txt(form, "municipio", 60),
    codigoMunicipio: txt(form, "codigoMunicipio").replace(/\D/g, ""),
    uf: txt(form, "uf").toUpperCase(),
  };
  if (endereco.cep && endereco.cep.length !== 8) campos.cep = "O CEP tem 8 dígitos.";
  if (endereco.codigoMunicipio && endereco.codigoMunicipio.length !== 7)
    campos.codigoMunicipio = "O código IBGE do município tem 7 dígitos.";
  if (endereco.uf && !/^[A-Z]{2}$/.test(endereco.uf)) campos.uf = "Escolha a UF.";

  const aliquota = (k: string, max: number) => {
    const s = txt(form, k);
    if (!s) return null;
    const n = lerPercentual(s);
    if (Number.isNaN(n) || n < 0 || n > max) {
      campos[k] = `Informe um percentual entre 0 e ${max}.`;
      return null;
    }
    return Math.round(n * 100) / 10000; // pontos → fração, 2 casas
  };
  const aliquotaIcmsPadrao = aliquota("aliquotaIcmsPadrao", 100);
  const aliquotaIssPadrao = aliquota("aliquotaIssPadrao", 5);

  const serieNfe = txt(form, "serieNfe") || "1";
  if (!/^\d{1,3}$/.test(serieNfe)) campos.serieNfe = "A série é um número de 0 a 999.";

  const ambiente = txt(form, "ambiente");
  const provedor = txt(form, "provedor");
  if (ambiente !== "homologacao" && ambiente !== "producao") campos.ambiente = "Escolha o ambiente.";
  if (provedor !== "simulado" && provedor !== "focus") campos.provedor = "Escolha o provedor.";

  const tokenNovo = txt(form, "provedorToken", 200);
  const removerToken = form.get("removerToken") === "on";
  const terToken = !removerToken && (!!tokenNovo || !!atual.provedorToken);

  if (ambiente === "producao") {
    if (provedor === "simulado") campos.ambiente = "O provedor simulado não emite em produção. Escolha um provedor real.";
    else if (!terToken) campos.provedorToken = "Para emitir em produção, salve o token do provedor.";
    if (atual.ambiente !== "producao" && form.get("confirmaProducao") !== "on") {
      campos.confirmaProducao = "Confirme que você sabe que notas em produção têm valor fiscal.";
    }
  }

  if (Object.keys(campos).length) {
    return { erro: "Alguns campos precisam de ajuste.", campos, tokenSalvo: !!atual.provedorToken };
  }

  const provedorToken = removerToken ? null : tokenNovo ? criptografar(tokenNovo) : atual.provedorToken;

  await db.empresa.updateMany({
    where: { id: atual.id, userId: u.id },
    data: {
      razaoSocial: razaoSocial || null,
      inscricaoEstadual: inscricaoEstadual || null,
      inscricaoMunicipal: inscricaoMunicipal || null,
      crt: crt || null,
      endereco: JSON.stringify(endereco),
      aliquotaIcmsPadrao,
      aliquotaIssPadrao,
      serieNfe,
      ambiente,
      provedor,
      provedorToken,
    },
  });

  revalidatePath(`/app/empresas/${atual.id}`, "layout");
  return { ok: "Dados fiscais salvos.", tokenSalvo: !!provedorToken };
}
