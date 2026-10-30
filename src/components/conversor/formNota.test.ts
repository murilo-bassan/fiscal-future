import { describe, expect, it } from "vitest";
import { aplicarChave, baseDoItem, formDeEntrada, formVazio, validarForm, valorDaAliquota } from "./formNota";

const CHAVE = "35251012345678000195550010000012341000012340";

describe("formulário de nota digitada", () => {
  it("a chave colada preenche UF, mês, CNPJ, modelo, série e número", () => {
    const { form, lida, valida } = aplicarChave(formVazio("nfse"), CHAVE.replace(/(\d{4})/g, "$1 "));
    expect(lida && valida).toBe(true);
    expect(form).toMatchObject({ tipo: "nfe", emitenteUf: "SP", emitenteDocumento: "12345678000195", serie: "1", numero: "1234", emissao: "2025-10-01" });
    // não apaga o que já foi digitado
    const outro = aplicarChave({ ...formVazio(), numero: "99" }, CHAVE).form;
    expect(outro.numero).toBe("99");
  });

  it("mostra o erro no campo certo e aceita vírgula decimal", () => {
    const f = formVazio();
    f.itens[0] = { ...f.itens[0], descricao: "Camiseta", ncm: "6109", valorUnitario: "" };
    const r = validarForm(f);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros["emitente.nome"]).toBe("Informe o emitente");
      expect(r.erros["itens.0.ncm"]).toBe("NCM tem 8 dígitos");
      expect(r.erros["itens.0.valorUnitario"]).toMatch(/número/);
    }
    f.emitenteNome = "Loja";
    f.itens[0] = { ...f.itens[0], ncm: "6109.10.00", valorUnitario: "1.234,50", quantidade: "2", icms: "18" };
    const ok = validarForm(f);
    expect(ok.ok && ok.nota.itens[0]).toMatchObject({ valorUnitario: 1234.5, quantidade: 2, icms: 18 });
  });

  it("atalho de %: alíquota vira valor sobre o item", () => {
    const it = { ...formVazio().itens[0], quantidade: "20", valorUnitario: "25", desconto: "10" };
    expect(baseDoItem(it, "nfe")).toBe(490);
    expect(valorDaAliquota(490, "18%")).toBe(88.2);
    expect(valorDaAliquota(10000, "0,65")).toBe(65);
    expect(valorDaAliquota(100, "abc")).toBeNull();
  });

  it("ida e volta com a entrada guardada", () => {
    const f = formDeEntrada({
      tipo: "nfse",
      emitente: { nome: "Consultoria" },
      itens: [{ descricao: "Honorários", codigoServico: "17.14", valorUnitario: 10000, iss: 500, pis: 0 }],
    });
    expect(f.itens[0]).toMatchObject({ valorUnitario: "10000", iss: "500", pis: "", quantidade: "1" });
    const r = validarForm(f);
    expect(r.ok && r.nota.itens[0]).toMatchObject({ valorUnitario: 10000, iss: 500, codigoServico: "17.14" });
  });
});
