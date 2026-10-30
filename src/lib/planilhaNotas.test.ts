import { describe, expect, it } from "vitest";
import { CSV_MODELO, lerPlanilhaNotas, numeroBr } from "./planilhaNotas";
import { converterNota, notaDeEntrada, notaManualSchema } from "./nfe";

const CAB = "tipo;numero;serie;emissao;chave;regime_emitente;emitente_documento;emitente_nome;emitente_uf;destinatario_documento;destinatario_nome;descricao;ncm;cfop;codigo_servico;unidade;quantidade;valor_unitario;desconto;icms;pis;cofins;ipi;iss";

describe("numeroBr", () => {
  it("entende vírgula decimal e milhar com ponto", () => {
    expect(numeroBr("1.234,56")).toBe(1234.56);
    expect(numeroBr("R$ 25,00")).toBe(25);
    expect(numeroBr("1234.5")).toBe(1234.5);
    expect(numeroBr("")).toBeUndefined();
    expect(numeroBr("abc")).toBeNaN();
  });
});

describe("lerPlanilhaNotas", () => {
  it("o CSV modelo vira duas notas válidas, agrupadas por emitente e número", () => {
    const r = lerPlanilhaNotas(CSV_MODELO);
    expect(r.erros).toEqual([]);
    expect(r.notas).toHaveLength(2);
    const [venda, servico] = r.notas.map((n) => notaManualSchema.parse(n));
    expect(venda.itens).toHaveLength(2);
    expect(venda.emissao).toBe("2025-10-15");
    expect(venda.itens[0]).toMatchObject({ ncm: "10063021", quantidade: 10, valorUnitario: 25, icms: 17.5, pis: 1.63 });
    expect(servico).toMatchObject({ tipo: "nfse", regimeEmitente: "simples" });
    expect(servico.itens[0]).toMatchObject({ valorUnitario: 1500, iss: 75, codigoServico: "17.19" });
    // e converte como qualquer nota
    const c = converterNota(notaDeEntrada(venda, "planilha"), { ano: 2027 });
    expect(c.itens).toHaveLength(2);
  });

  it("aceita vírgula como separador", () => {
    const t = [
      "numero,emitente_nome,descricao,ncm,cfop,quantidade,valor_unitario,icms",
      '10,Loja A,Caneta azul,9608.10.00,5102,2,"3,50",1.26',
      "10,,Lápis,9609.10.00,5102,1,1.5,0",
    ].join("\n");
    const r = lerPlanilhaNotas(t);
    expect(r.erros).toEqual([]);
    expect(r.notas).toHaveLength(1);
    expect(r.notas[0].emitente.nome).toBe("Loja A");
    expect(r.notas[0].itens.map((i) => i.valorUnitario)).toEqual([3.5, 1.5]);
  });

  it("mesmo número de emitentes diferentes são notas diferentes", () => {
    const t = [
      "numero;emitente_documento;emitente_nome;descricao;valor_unitario",
      "1;12345678000195;A;Item a;10",
      "1;98765432000198;B;Item b;20",
      "1;12345678000195;A;Item c;30",
    ].join("\r\n");
    const r = lerPlanilhaNotas(t);
    expect(r.notas.map((n) => n.itens.length)).toEqual([2, 1]);
  });

  it("informa a linha de cada erro e só descarta a nota com problema", () => {
    const t = [
      CAB,
      "nfe;1;1;01/02/2025;;normal;12345678000195;Loja;SP;;;Parafuso;7318;5102;;UN;1;10;0;0;0;0;0;0",
      "nfe;2;1;01/02/2025;;normal;12345678000195;Loja;SP;;;Porca;73181600;5102;;UN;1;abc;0;0;0;0;0;0",
      "xyz;3;1;01/02/2025;;normal;12345678000195;Loja;SP;;;Arruela;73182200;5102;;UN;1;1;0;0;0;0;0;0",
      ";;1;01/02/2025;;normal;12345678000195;Loja;SP;;;Sem número;73182200;5102;;UN;1;1;0;0;0;0;0;0",
      "nfe;4;1;01/02/2025;;normal;12345678000195;Loja;SP;;;Prego;73170090;5102;;UN;1;2;0;0;0;0;0;0",
    ].join("\n");
    const r = lerPlanilhaNotas(t);
    expect(r.notas.map((n) => n.numero)).toEqual(["4"]);
    expect(r.erros).toEqual([
      { linha: 2, mensagem: "ncm: NCM tem 8 dígitos" },
      { linha: 3, mensagem: 'valor_unitario "abc" não é um número.' },
      { linha: 4, mensagem: 'tipo "xyz" inválido: use nfe, nfce ou nfse.' },
      { linha: 5, mensagem: "Informe o número da nota na coluna numero." },
    ]);
  });

  it("falta de coluna obrigatória e planilha vazia", () => {
    expect(lerPlanilhaNotas("numero;descricao\n1;x").erros[0].mensagem).toMatch(/valor_unitario/);
    expect(lerPlanilhaNotas("").erros[0].mensagem).toMatch(/vazia/);
    expect(lerPlanilhaNotas(CAB).erros[0].mensagem).toMatch(/nenhuma linha/);
  });

  it("exige o nome do emitente", () => {
    const r = lerPlanilhaNotas("numero;descricao;valor_unitario\n7;Item;10");
    expect(r.erros).toEqual([{ linha: 2, mensagem: "emitente_nome: Informe o emitente" }]);
  });
});
