/**
 * Lê o corpo de uma requisição com teto de bytes, sem confiar no Content-Length
 * (que pode faltar ou mentir): para de ler assim que passa do limite.
 */

export type CorpoLido = { ok: true; texto: string } | { ok: false; motivo: "grande" | "ilegivel" };

export async function lerCorpoLimitado(req: Request, maxBytes: number): Promise<CorpoLido> {
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) return { ok: false, motivo: "grande" };
  if (!req.body) return { ok: true, texto: "" };

  const leitor = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await leitor.cancel().catch(() => {});
        return { ok: false, motivo: "grande" };
      }
      partes.push(value);
    }
  } catch {
    return { ok: false, motivo: "ilegivel" };
  }
  return { ok: true, texto: Buffer.concat(partes).toString("utf8") };
}
