import { describe, expect, it } from "vitest";
import { dividirLinhaCsv, gerarCsv, lerDescricoes } from "./csv";

describe("lerDescricoes", () => {
  it("uma descrição por linha, sem vazias nem repetidas", () => {
    expect(lerDescricoes("arroz\n\n  feijão  \nArroz\r\nCafé torrado\n")).toEqual(["arroz", "feijão", "Café torrado"]);
  });

  it("coluna descricao com ; (Excel em português) e BOM", () => {
    const csv = '﻿codigo;Descrição;ncm\n1;Arroz tipo 1;1006\n2;"Leite; integral";0401\n3;;0000';
    expect(lerDescricoes(csv)).toEqual(["Arroz tipo 1", "Leite; integral"]);
  });

  it("coluna descricao com vírgula e aspas escapadas", () => {
    const csv = 'sku,descricao\nA1,"Camiseta ""básica"", algodão"\nA2,Tênis';
    expect(lerDescricoes(csv)).toEqual(['Camiseta "básica", algodão', "Tênis"]);
  });

  it("sem cabeçalho, linhas com vírgula ficam inteiras", () => {
    expect(lerDescricoes("Arroz branco, tipo 1, 5 kg\nFeijão")).toEqual(["Arroz branco, tipo 1, 5 kg", "Feijão"]);
  });

  it("tira aspas em volta da linha", () => {
    expect(lerDescricoes('"Pão francês"')).toEqual(["Pão francês"]);
  });
});

describe("dividirLinhaCsv", () => {
  it("respeita aspas", () => {
    expect(dividirLinhaCsv('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"]);
  });
});

describe("gerarCsv", () => {
  it("usa ;, BOM e escapa aspas e quebras", () => {
    const csv = gerarCsv([["a", 'diz "oi"'], ["linha\n2", 3]]);
    expect(csv).toBe('﻿a;"diz ""oi"""\r\n"linha\n2";3');
  });

  it("neutraliza fórmulas", () => {
    expect(gerarCsv([["=SOMA(A1)", "-1", "@x", "+2"]])).toBe("﻿'=SOMA(A1);'-1;'@x;'+2");
  });

  it("ida e volta pela coluna descricao", () => {
    const csv = gerarCsv([["descricao", "x"], ["Leite; integral", "1"]]);
    expect(lerDescricoes(csv)).toEqual(["Leite; integral"]);
  });
});
