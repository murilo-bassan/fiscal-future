import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));

const { avaliar, ipDe } = await import("./limite");

const regra = { limite: 3, janelaSeg: 60 };
const agora = new Date("2026-10-30T12:00:00Z");

describe("limite de tentativas", () => {
  it("abre janela nova sem registro ou com janela vencida", () => {
    const r = avaliar(null, regra, agora);
    expect(r).toMatchObject({ ok: true, contador: 1, novaJanela: true });
    expect(r.reiniciaEm.getTime()).toBe(agora.getTime() + 60_000);
    expect(avaliar({ contador: 99, reiniciaEm: agora }, regra, agora)).toMatchObject({ ok: true, contador: 1 });
  });

  it("conta dentro da janela e bloqueia no limite", () => {
    const fim = new Date(agora.getTime() + 30_000);
    expect(avaliar({ contador: 2, reiniciaEm: fim }, regra, agora)).toMatchObject({ ok: true, contador: 3, novaJanela: false });
    expect(avaliar({ contador: 3, reiniciaEm: fim }, regra, agora)).toMatchObject({ ok: false, reiniciaEm: fim });
  });

  it("lê o IP do proxy", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(ipDe(new Headers({ "x-real-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(ipDe(new Headers())).toBe("desconhecido");
  });
});
