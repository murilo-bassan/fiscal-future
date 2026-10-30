import { describe, expect, it } from "vitest";
import { lerCorpoLimitado } from "./corpo";

const req = (corpo: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", { method: "POST", body: corpo, headers });

describe("lerCorpoLimitado", () => {
  it("lê corpos dentro do limite", async () => {
    expect(await lerCorpoLimitado(req('{"ref":"ff-1"}'), 64)).toEqual({ ok: true, texto: '{"ref":"ff-1"}' });
    expect(await lerCorpoLimitado(new Request("http://localhost/api/x", { method: "POST" }), 64)).toEqual({ ok: true, texto: "" });
  });

  it("recusa corpo maior que o limite, mesmo sem Content-Length", async () => {
    expect(await lerCorpoLimitado(req("x".repeat(65)), 64)).toEqual({ ok: false, motivo: "grande" });
    expect(await lerCorpoLimitado(req("x", { "content-length": "100000" }), 64)).toEqual({ ok: false, motivo: "grande" });
  });
});
