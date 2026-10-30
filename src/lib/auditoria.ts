/**
 * Registro de ações sensíveis (quem, o quê, quando, de onde). Falhar ao registrar
 * nunca derruba a ação principal: só vai para o log do servidor.
 */

import "server-only";
import { db } from "./db";

export type AcaoAuditoria =
  | "login"
  | "login_2fa"
  | "logout_todos"
  | "senha_alterada"
  | "senha_redefinida"
  | "senha_esquecida"
  | "2fa_ativado"
  | "2fa_desativado"
  | "conta_exportada"
  | "dados_fiscais_alterados"
  | "empresa_excluida"
  | "nota_emitida"
  | "nota_retentada"
  | "nota_cancelada";

export const NOMES_ACAO: Record<AcaoAuditoria, string> = {
  login: "Entrou na conta",
  login_2fa: "Entrou na conta (com verificação em duas etapas)",
  logout_todos: "Saiu de todos os dispositivos",
  senha_alterada: "Trocou a senha",
  senha_redefinida: "Redefiniu a senha pelo link do e-mail",
  senha_esquecida: "Pediu o link para redefinir a senha",
  "2fa_ativado": "Ativou a verificação em duas etapas",
  "2fa_desativado": "Desativou a verificação em duas etapas",
  conta_exportada: "Baixou uma cópia dos dados",
  dados_fiscais_alterados: "Alterou os dados fiscais de uma empresa",
  empresa_excluida: "Excluiu uma empresa",
  nota_emitida: "Emitiu uma nota",
  nota_retentada: "Reenviou uma nota com erro",
  nota_cancelada: "Cancelou uma nota",
};

export async function registrar(
  userId: string,
  acao: AcaoAuditoria,
  extra: { empresaId?: string | null; detalhe?: string | null; ip?: string | null } = {},
) {
  try {
    await db.eventoAuditoria.create({
      data: {
        userId,
        acao,
        empresaId: extra.empresaId ?? null,
        detalhe: extra.detalhe?.slice(0, 500) ?? null,
        ip: extra.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[auditoria] falha ao registrar", acao, err instanceof Error ? err.message : err);
  }
}

export function eventosRecentes(userId: string, take = 20) {
  return db.eventoAuditoria.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}
