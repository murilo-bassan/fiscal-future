import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  DEFAULT_CENARIO,
  PRESETS,
  perfilSchema,
  type CenarioAliquota,
  type PerfilEmpresa,
} from "@/lib/tax";

export function cenarioPorId(id: string | null | undefined): CenarioAliquota {
  return PRESETS.find((c) => c.id === id) ?? DEFAULT_CENARIO;
}

/** Lê o JSON salvo. Se estiver corrompido ou de uma versão antiga, devolve null. */
export function lerPerfil(json: string, nome: string): PerfilEmpresa | null {
  try {
    const r = perfilSchema.safeParse({ ...JSON.parse(json), nome });
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Busca uma empresa garantindo que ela pertence ao usuário. 404 se não for dele. */
export async function empresaDoUsuario(id: string, userId: string) {
  const empresa = await db.empresa.findFirst({ where: { id, userId } });
  if (!empresa) notFound();
  return { empresa, perfil: lerPerfil(empresa.perfil, empresa.nome) };
}
