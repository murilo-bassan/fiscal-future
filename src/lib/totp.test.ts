import { describe, expect, it } from "vitest";
import { base32, codigo, deBase32, novoSegredo, passoAtual, uriOtpauth, verificar } from "./totp";

// Vetores da RFC 6238 (apêndice B), segredo ASCII "12345678901234567890", SHA-1
const SEGREDO_RFC = base32(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("base32 ida e volta", () => {
    const b = Buffer.from("qualquer coisa é válida");
    expect(deBase32(base32(b)).equals(b)).toBe(true);
    expect(base32(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("reproduz os vetores da RFC 6238", () => {
    expect(codigo(SEGREDO_RFC, passoAtual(59_000), 8)).toBe("94287082");
    expect(codigo(SEGREDO_RFC, passoAtual(1111111109_000), 8)).toBe("07081804");
    expect(codigo(SEGREDO_RFC, passoAtual(2000000000_000), 8)).toBe("69279037");
  });

  it("aceita o passo vizinho e recusa reuso e códigos errados", () => {
    const s = novoSegredo();
    const agora = 1_700_000_000_000;
    const p = passoAtual(agora);
    expect(verificar(s, codigo(s, p), null, agora)).toBe(p);
    expect(verificar(s, codigo(s, p - 1), null, agora)).toBe(p - 1);
    expect(verificar(s, codigo(s, p - 3), null, agora)).toBeNull();
    expect(verificar(s, codigo(s, p), p, agora)).toBeNull();
    expect(verificar(s, "12345", null, agora)).toBeNull();
    expect(verificar(s, `${codigo(s, p).slice(0, 3)} ${codigo(s, p).slice(3)}`, null, agora)).toBe(p);
  });

  it("monta a URI do autenticador", () => {
    const u = uriOtpauth("ABC", "a@b.com");
    expect(u).toMatch(/^otpauth:\/\/totp\/Fiscal%20Future%3Aa%40b\.com\?/);
    expect(u).toContain("secret=ABC");
  });
});
