import { describe, expect, it } from "vitest";
import { chaveValida, dvModulo11, formatarChave, montarChaveNfe, montarChaveNfse } from "./chave";

describe("chave de acesso", () => {
  it("DV módulo 11 confere com chaves de exemplo do Manual de Orientação", () => {
    for (const ch of ["52060433009911002506550120000007800267301615", "35080599999090910270550010000000015180051273"]) {
      expect(dvModulo11(ch.slice(0, 43))).toBe(Number(ch[43]));
      expect(chaveValida(ch)).toBe(true);
    }
  });

  it("resto 0 ou 1 dá DV 0", () => {
    expect(dvModulo11("0")).toBe(0); // soma 0, resto 0
    expect(dvModulo11("6")).toBe(0); // 6 × 2 = 12, resto 1
    expect(dvModulo11("5")).toBe(1); // 5 × 2 = 10, resto 10
  });

  it("monta a chave de NF-e na ordem do layout", () => {
    const ch = montarChaveNfe({
      cUF: "35",
      emissao: new Date(2026, 9, 15),
      cnpj: "12345678000195",
      serie: "1",
      numero: 42,
      cNF: "12345678",
    });
    expect(ch).toHaveLength(44);
    expect(ch.slice(0, 2)).toBe("35");
    expect(ch.slice(2, 6)).toBe("2610");
    expect(ch.slice(6, 20)).toBe("12345678000195");
    expect(ch.slice(20, 22)).toBe("55");
    expect(ch.slice(22, 25)).toBe("001");
    expect(ch.slice(25, 34)).toBe("000000042");
    expect(ch[34]).toBe("1");
    expect(ch.slice(35, 43)).toBe("12345678");
    expect(chaveValida(ch)).toBe(true);
  });

  it("chave adulterada não passa", () => {
    const ch = "52060433009911002506550120000007800267301615";
    expect(chaveValida(ch.slice(0, 43) + "4")).toBe(false);
    expect(chaveValida("123")).toBe(false);
  });

  it("NFS-e nacional tem 50 dígitos com DV válido", () => {
    const ch = montarChaveNfse({
      codigoMunicipio: "3550308",
      documento: "12345678000195",
      numero: 7,
      emissao: new Date(2026, 10, 3),
      codigoNumerico: 123,
    });
    expect(ch).toHaveLength(50);
    expect(ch.slice(0, 7)).toBe("3550308");
    expect(chaveValida(ch)).toBe(true);
  });

  it("formata em blocos de 4", () => {
    expect(formatarChave("12345678")).toBe("1234 5678");
  });
});
