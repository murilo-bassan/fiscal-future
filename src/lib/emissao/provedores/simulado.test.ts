import { describe, expect, it } from "vitest";
import { XMLParser } from "fast-xml-parser";
import { calcularRascunho } from "../calculo";
import { chaveValida } from "../chave";
import { EMITENTE_NORMAL, NFE, NFSE } from "../fixtures.test-utils";
import { criarProvedorSimulado, PRAZO_CANCELAMENTO_MS, type DepsSimulado, type NotaGuardada } from "./simulado";

const E = { ...EMITENTE_NORMAL, provedor: "simulado" as const, provedorToken: undefined };

function deps(agora: Date, guardadas: Record<string, NotaGuardada> = {}, ultimo = 0): DepsSimulado {
  return {
    ultimoNumero: async () => ultimo,
    buscar: async (_e, ref) => guardadas[ref] ?? null,
    agora: () => agora,
    aleatorio: (max) => Math.min(4242, max - 1),
  };
}

describe("provedor simulado", () => {
  const agora = new Date(2026, 9, 30, 10, 0, 0);

  it("autoriza NF-e na hora, com número sequencial e chave válida", async () => {
    const p = criarProvedorSimulado(deps(agora, {}, 41));
    const c = calcularRascunho(E, NFE, { ano: 2026 });
    const r = await p.emitir(E, NFE, c, "ff-1");
    expect(r.status).toBe("autorizada");
    expect(r.numero).toBe("42");
    expect(r.chave).toHaveLength(44);
    expect(chaveValida(r.chave!)).toBe(true);
    expect(r.chave!.slice(0, 2)).toBe("35");
    expect(r.chave!.slice(6, 20)).toBe(E.cnpj);
    expect(r.protocolo).toMatch(/^\d{15}$/);
  });

  it("XML de NF-e: tpAmb=2, aviso SEM VALOR FISCAL e grupos IBSCBS do cálculo", async () => {
    const p = criarProvedorSimulado(deps(agora));
    const c = calcularRascunho(E, NFE, { ano: 2026 });
    const r = await p.emitir(E, NFE, c, "ff-2");
    expect(r.xml).toContain("SEM VALOR FISCAL");
    const x = new XMLParser({ parseTagValue: false, ignoreAttributes: false }).parse(r.xml!);
    const inf = x.nfeProc.NFe.infNFe;
    expect(inf.ide.tpAmb).toBe("2");
    expect(inf.ide.idDest).toBe("2");
    expect(inf.det).toHaveLength(2);
    expect(inf.det[0].imposto.IBSCBS.CST).toBe(c.itens[0].ibsCbs.cst);
    expect(inf.det[0].imposto.IBSCBS.gIBSCBS.gCBS.vCBS).toBe(c.itens[0].ibsCbs.cbs.valor.toFixed(2));
    expect(inf.total.IBSCBSTot.gCBS.vCBS).toBe(c.totais.cbs.toFixed(2));
    expect(inf.total.ICMSTot.vNF).toBe(c.totais.nota.toFixed(2));
    expect(inf.dest.xNome).toContain("SEM VALOR FISCAL");
    // & escapado
    expect(r.xml).toContain("Cliente &amp; Filhos");
  });

  it("NFS-e: chave nacional de 50 dígitos e XML com ISS e IBS/CBS", async () => {
    const p = criarProvedorSimulado(deps(agora));
    const c = calcularRascunho(E, NFSE, { ano: 2026 });
    const r = await p.emitir(E, NFSE, c, "ff-3");
    expect(r.status).toBe("autorizada");
    expect(r.chave).toHaveLength(50);
    expect(chaveValida(r.chave!)).toBe(true);
    expect(r.xml).toContain("SEM VALOR FISCAL");
    expect(r.xml).toContain(`<vISSQN>${c.totais.iss.toFixed(2)}</vISSQN>`);
    expect(r.xml).toContain(`<vCBS>${c.totais.cbs.toFixed(2)}</vCBS>`);
    expect(r.xml).toContain("<tpAmb>2</tpAmb>");
  });

  it("recusa produção", async () => {
    const p = criarProvedorSimulado(deps(agora));
    const prod = { ...E, ambiente: "producao" as const };
    const r = await p.emitir(prod, NFE, calcularRascunho(prod, NFE, { ano: 2026 }), "ff-4");
    expect(r.status).toBe("erro");
  });

  it("mesma ref devolve a mesma nota (idempotente)", async () => {
    const guardada: NotaGuardada = { status: "autorizada", numero: "7", serie: "1", chave: "1".repeat(44), emitidaEm: agora };
    const p = criarProvedorSimulado(deps(agora, { "ff-5": guardada }, 99));
    const r = await p.emitir(E, NFE, calcularRascunho(E, NFE, { ano: 2026 }), "ff-5");
    expect(r.numero).toBe("7");
  });

  it("cancela só dentro de 24 h", async () => {
    const emitida = new Date(agora.getTime() - PRAZO_CANCELAMENTO_MS + 60_000);
    const g = { "ff-6": { status: "autorizada" as const, emitidaEm: emitida } };
    expect((await criarProvedorSimulado(deps(agora, g)).cancelar(E, "nfe", "ff-6", "x")).status).toBe("cancelada");

    const depois = new Date(emitida.getTime() + PRAZO_CANCELAMENTO_MS + 1);
    const r = await criarProvedorSimulado(deps(depois, g)).cancelar(E, "nfe", "ff-6", "x");
    expect(r.status).toBe("autorizada");
    expect(r.mensagem).toMatch(/24 horas/);
  });
});
