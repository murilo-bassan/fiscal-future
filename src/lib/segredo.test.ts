import { describe, expect, it } from "vitest";
import { bearerConfere, segredoConfere } from "./segredo";

describe("segredoConfere", () => {
  it("aceita só o segredo exato", () => {
    expect(segredoConfere("abc123", "abc123")).toBe(true);
    expect(segredoConfere("abc124", "abc123")).toBe(false);
    expect(segredoConfere("abc12", "abc123")).toBe(false);
    expect(segredoConfere("abc1234", "abc123")).toBe(false);
    expect(segredoConfere(" abc123", "abc123")).toBe(false);
  });

  it("recusa header ausente e segredo não configurado", () => {
    expect(segredoConfere(null, "abc123")).toBe(false);
    expect(segredoConfere(undefined, "abc123")).toBe(false);
    expect(segredoConfere("", "")).toBe(false);
    expect(segredoConfere("abc123", undefined)).toBe(false);
    expect(segredoConfere("", "abc123")).toBe(false);
  });
});

describe("bearerConfere", () => {
  it("exige o formato Bearer da Vercel Cron", () => {
    expect(bearerConfere("Bearer s3gr3d0", "s3gr3d0")).toBe(true);
    expect(bearerConfere("s3gr3d0", "s3gr3d0")).toBe(false);
    expect(bearerConfere("Bearer outro", "s3gr3d0")).toBe(false);
    expect(bearerConfere("Bearer ", "")).toBe(false);
    expect(bearerConfere("Bearer undefined", undefined)).toBe(false);
  });
});
