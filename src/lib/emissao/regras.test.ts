import { describe, expect, it, vi } from "vitest";
import { criptografar } from "../cripto";
import { emitenteDaEmpresa } from "./emitente";
import { NFE, NFSE } from "./fixtures.test-utils";
import { checarLimite, documentoValido, gerarRef, validarJustificativa, validarRascunho } from "./regras";

describe("validarRascunho", () => {
  it("aceita NF-e e NFS-e válidas", () => {
    expect(validarRascunho(NFE).ok).toBe(true);
    expect(validarRascunho(NFSE).ok).toBe(true);
  });

  it("limpa máscara do documento", () => {
    const r = validarRascunho({ ...NFE, destinatario: { ...NFE.destinatario, documento: "11.444.777/0001-61" } });
    expect(r.ok && r.rascunho.destinatario.documento).toBe("11444777000161");
  });

  it("documento com 11 ou 14 dígitos e DV correto", () => {
    const r = validarRascunho({ ...NFE, destinatario: { ...NFE.destinatario, documento: "123" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros["destinatario.documento"]).toMatch(/11 dígitos/);
    expect(documentoValido("52998224725")).toBe(true);
    expect(documentoValido("52998224726")).toBe(false);
    expect(documentoValido("11111111111")).toBe(false);
  });

  it("NF-e exige NCM com 8 e CFOP com 4 dígitos", () => {
    const itens = [{ ...NFE.itens[0], ncm: "7318", cfop: "61" }];
    const r = validarRascunho({ ...NFE, itens });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros["itens.0.ncm"]).toBeTruthy();
      expect(r.erros["itens.0.cfop"]).toBeTruthy();
      expect(r.mensagens[0]).toMatch(/^Item 1:/);
    }
  });

  it("quantidade e valor maiores que zero; desconto não passa do valor", () => {
    const r = validarRascunho({ ...NFE, itens: [{ ...NFE.itens[0], quantidade: 0, valorUnitario: -1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros["itens.0.quantidade"]).toBeTruthy();
      expect(r.erros["itens.0.valorUnitario"]).toBeTruthy();
    }
    const d = validarRascunho({ ...NFE, itens: [{ ...NFE.itens[0], desconto: 5000 }] });
    expect(d.ok).toBe(false);
  });

  it("NFS-e: um serviço só, com código de 6 dígitos", () => {
    const r = validarRascunho({ ...NFSE, itens: [NFSE.itens[0], NFSE.itens[0]] });
    expect(r.ok).toBe(false);
    const s = validarRascunho({ ...NFSE, itens: [{ ...NFSE.itens[0], codigoServico: "12" }] });
    expect(s.ok).toBe(false);
  });

  it("categoria precisa existir", () => {
    const r = validarRascunho({ ...NFE, itens: [{ ...NFE.itens[0], categoriaId: "inventada" }] });
    expect(r.ok).toBe(false);
  });
});

describe("outras regras", () => {
  it("justificativa de 15 a 255 caracteres", () => {
    expect(validarJustificativa("curta").ok).toBe(false);
    expect(validarJustificativa("x".repeat(256)).ok).toBe(false);
    expect(validarJustificativa("  Cliente   desistiu da compra  ")).toEqual({ ok: true, justificativa: "Cliente desistiu da compra" });
  });

  it("limite do plano", () => {
    expect(checarLimite(0, 0).ok).toBe(false);
    expect(checarLimite(49, 50).ok).toBe(true);
    expect(checarLimite(50, 50).ok).toBe(false);
  });

  it("ref começa com za-", () => {
    expect(gerarRef("abc")).toBe("za-abc");
  });
});

describe("emitenteDaEmpresa", () => {
  const base = {
    id: "e1",
    cnpj: "11222333000181",
    perfil: JSON.stringify({ regime: "presumido" }),
    razaoSocial: "Exemplo Ltda",
    inscricaoEstadual: "110042490114",
    inscricaoMunicipal: "123",
    crt: "3",
    endereco: JSON.stringify({
      logradouro: "Rua A",
      numero: "1",
      bairro: "Centro",
      cep: "01001-000",
      municipio: "São Paulo",
      codigoMunicipio: "3550308",
      uf: "sp",
    }),
    aliquotaIcmsPadrao: 0.18,
    aliquotaIssPadrao: 0.05,
    ambiente: "homologacao",
    provedor: "simulado",
    provedorToken: null,
    serieNfe: "1",
  };

  it("monta o emitente completo", () => {
    const r = emitenteDaEmpresa(base, "nfe");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.emitente.regime).toBe("presumido");
      expect(r.emitente.endereco.cep).toBe("01001000");
      expect(r.emitente.endereco.uf).toBe("SP");
    }
  });

  it("lista o que falta em português", () => {
    const r = emitenteDaEmpresa({ ...base, razaoSocial: null, crt: null, endereco: null, inscricaoEstadual: null }, "nfe");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.faltando).toContain("razão social");
      expect(r.faltando).toContain("regime na nota (CRT)");
      expect(r.faltando.some((f) => f.includes("código IBGE"))).toBe(true);
      expect(r.faltando.some((f) => f.includes("inscrição estadual"))).toBe(true);
    }
  });

  it("produção exige provedor real; Focus exige token legível", () => {
    const p = emitenteDaEmpresa({ ...base, ambiente: "producao" });
    expect(!p.ok && p.faltando.some((f) => f.includes("provedor real"))).toBe(true);
    const f = emitenteDaEmpresa({ ...base, provedor: "focus", provedorToken: null });
    expect(!f.ok && f.faltando.some((x) => x.includes("token"))).toBe(true);
  });

  it("descriptografa o token salvo", () => {
    vi.stubEnv("ENCRYPTION_KEY", "c".repeat(64));
    const r = emitenteDaEmpresa({ ...base, provedor: "focus", provedorToken: criptografar("meu-token") });
    expect(r.ok && r.emitente.provedorToken).toBe("meu-token");
    vi.unstubAllEnvs();
  });

  it("CRT e regime precisam combinar", () => {
    const r = emitenteDaEmpresa({ ...base, crt: "1" });
    expect(!r.ok && r.faltando.some((f) => f.startsWith("regime:"))).toBe(true);
  });
});
