"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { plano } from "@/lib/planos";

export type EstadoEscritorio = { ok?: boolean; erro?: string };

const Nome = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(80, "Use no máximo 80 caracteres."));

/** Salva o nome do escritório exibido nos relatórios (só planos com marca própria). */
export async function salvarEscritorio(_prev: EstadoEscritorio, form: FormData): Promise<EstadoEscritorio> {
  const u = await exigirUsuario();
  if (!plano(u.plano).marcaPropria) {
    return { erro: "Relatórios com a marca do escritório estão no plano Escritório Contábil." };
  }
  const parsed = Nome.safeParse(form.get("escritorio") ?? "");
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Nome inválido." };

  await db.user.update({ where: { id: u.id }, data: { escritorio: parsed.data || null } });
  revalidatePath("/app/conta");
  return { ok: true };
}
