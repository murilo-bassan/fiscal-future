-- AlterTable
ALTER TABLE "NotaFiscal" ADD COLUMN "destinatario" TEXT;

-- CreateTable
CREATE TABLE "TokenSenha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "expiraEm" DATETIME NOT NULL,
    "usadoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TokenSenha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LimiteTaxa" (
    "chave" TEXT NOT NULL PRIMARY KEY,
    "contador" INTEGER NOT NULL,
    "reiniciaEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventoAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoAuditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "plano" TEXT NOT NULL DEFAULT 'gratis',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "escritorio" TEXT,
    "sessaoVersao" INTEGER NOT NULL DEFAULT 0,
    "totpSegredo" TEXT,
    "totpAtivo" BOOLEAN NOT NULL DEFAULT false,
    "totpUltimoPasso" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "escritorio", "id", "nome", "plano", "senhaHash", "stripeCustomerId", "stripeSubscriptionId") SELECT "createdAt", "email", "escritorio", "id", "nome", "plano", "senhaHash", "stripeCustomerId", "stripeSubscriptionId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TokenSenha_hash_key" ON "TokenSenha"("hash");

-- CreateIndex
CREATE INDEX "TokenSenha_userId_idx" ON "TokenSenha"("userId");

-- CreateIndex
CREATE INDEX "EventoAuditoria_userId_createdAt_idx" ON "EventoAuditoria"("userId", "createdAt");

-- Preenche o destinatário das notas já emitidas a partir do payload JSON
UPDATE "NotaFiscal" SET "destinatario" = json_extract("payload", '$.destinatario.nome') WHERE "destinatario" IS NULL;
