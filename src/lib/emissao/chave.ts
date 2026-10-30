/**
 * Chave de acesso de documentos fiscais. Sem dependências de servidor.
 *
 * NF-e (44 dígitos, MOC 7.0): cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9)
 * tpEmis(1) cNF(8) cDV(1). DV por módulo 11, pesos 2 a 9 da direita para a esquerda.
 *
 * NFS-e nacional (50 dígitos): cMun(7) ambGer(1) tpInsc(1) inscFed(14) nNFSe(13)
 * AAMM(4) cNum(9) DV(1), com o mesmo módulo 11.
 */

export function dvModulo11(digitos: string): number {
  if (!/^\d+$/.test(digitos)) throw new Error("A chave só pode ter dígitos.");
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    soma += Number(digitos[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

const pad = (v: string | number, n: number) => String(v).padStart(n, "0");

function exigir(valor: string, tamanho: number, nome: string) {
  if (!new RegExp(`^\\d{${tamanho}}$`).test(valor)) throw new Error(`${nome} deve ter ${tamanho} dígitos.`);
  return valor;
}

export function aamm(data: Date): string {
  return pad(data.getFullYear() % 100, 2) + pad(data.getMonth() + 1, 2);
}

export function montarChaveNfe(p: {
  cUF: string;
  emissao: Date;
  cnpj: string;
  modelo?: "55" | "65";
  serie: string | number;
  numero: string | number;
  tpEmis?: string;
  cNF: string | number;
}): string {
  const corpo =
    exigir(p.cUF, 2, "cUF") +
    aamm(p.emissao) +
    exigir(p.cnpj, 14, "CNPJ") +
    (p.modelo ?? "55") +
    exigir(pad(p.serie, 3), 3, "Série") +
    exigir(pad(p.numero, 9), 9, "Número") +
    exigir(p.tpEmis ?? "1", 1, "tpEmis") +
    exigir(pad(p.cNF, 8), 8, "cNF");
  return corpo + dvModulo11(corpo);
}

export function montarChaveNfse(p: {
  codigoMunicipio: string;
  /** 1 = prefeitura, 2 = Sefin Nacional. */
  ambienteGerador?: "1" | "2";
  documento: string;
  numero: string | number;
  emissao: Date;
  codigoNumerico: string | number;
}): string {
  const tpInsc = p.documento.length === 11 ? "1" : "2";
  const corpo =
    exigir(p.codigoMunicipio, 7, "Município") +
    (p.ambienteGerador ?? "2") +
    tpInsc +
    exigir(pad(p.documento, 14), 14, "Documento") +
    exigir(pad(p.numero, 13), 13, "Número") +
    aamm(p.emissao) +
    exigir(pad(p.codigoNumerico, 9), 9, "Código numérico");
  return corpo + dvModulo11(corpo);
}

/** Confere o DV de uma chave de NF-e (44) ou NFS-e nacional (50). */
export function chaveValida(chave: string): boolean {
  if (!/^\d{44}$|^\d{50}$/.test(chave)) return false;
  return dvModulo11(chave.slice(0, -1)) === Number(chave.at(-1));
}

/** "3525 1012 ..." em blocos de 4 para leitura. */
export function formatarChave(chave: string): string {
  return chave.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
}
