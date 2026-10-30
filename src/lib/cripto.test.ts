import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criptografar, descriptografar } from "./cripto";

const CHAVE_A = "a".repeat(64);
const CHAVE_B = "b".repeat(64);

describe("cripto", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", CHAVE_A);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("ida e volta, inclusive com acentos", () => {
    const t = "token-secreto ção ✓";
    expect(descriptografar(criptografar(t))).toBe(t);
  });

  it("formato v1:iv:tag:dados em base64url", () => {
    const c = criptografar("abc");
    const partes = c.split(":");
    expect(partes).toHaveLength(4);
    expect(partes[0]).toBe("v1");
    for (const p of partes.slice(1)) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(c).not.toContain("abc");
  });

  it("IV aleatório: o mesmo texto gera cifras diferentes", () => {
    expect(criptografar("x")).not.toBe(criptografar("x"));
  });

  it("detecta adulteração", () => {
    const [v, iv, tag, dados] = criptografar("valor importante").split(":");
    const trocado = (dados[0] === "A" ? "B" : "A") + dados.slice(1);
    expect(() => descriptografar([v, iv, tag, trocado].join(":"))).toThrow();
    expect(() => descriptografar("v2:a:b:c")).toThrow();
    expect(() => descriptografar("lixo")).toThrow();
  });

  it("chave diferente não descriptografa", () => {
    const c = criptografar("segredo");
    vi.stubEnv("ENCRYPTION_KEY", CHAVE_B);
    expect(() => descriptografar(c)).toThrow();
  });

  it("produção sem chave válida lança erro", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENCRYPTION_KEY", "curta");
    expect(() => criptografar("x")).toThrow(/ENCRYPTION_KEY/);
  });

  it("fora de produção, sem chave, deriva do AUTH_SECRET e avisa uma vez", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("AUTH_SECRET", "s".repeat(40));
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = criptografar("dev");
    expect(descriptografar(c)).toBe("dev");
    criptografar("de novo");
    expect(aviso.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
