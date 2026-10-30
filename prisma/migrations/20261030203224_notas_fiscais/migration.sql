-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "numero" TEXT,
    "serie" TEXT,
    "chave" TEXT,
    "protocolo" TEXT,
    "mensagem" TEXT,
    "payload" TEXT NOT NULL,
    "calculo" TEXT NOT NULL,
    "xml" TEXT,
    "xmlUrl" TEXT,
    "danfeUrl" TEXT,
    "valorTotal" REAL NOT NULL,
    "ibsCbsTotal" REAL NOT NULL,
    "origemChave" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotaFiscal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversaoNota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT,
    "chave" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "emitente" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "xml" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversaoNota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversaoNota_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "perfil" TEXT NOT NULL,
    "cenarioId" TEXT NOT NULL DEFAULT 'governo-2024',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "razaoSocial" TEXT,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "crt" TEXT,
    "endereco" TEXT,
    "aliquotaIcmsPadrao" REAL,
    "aliquotaIssPadrao" REAL,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "provedor" TEXT NOT NULL DEFAULT 'simulado',
    "provedorToken" TEXT,
    "serieNfe" TEXT NOT NULL DEFAULT '1',
    CONSTRAINT "Empresa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Empresa" ("cenarioId", "cnpj", "createdAt", "id", "nome", "perfil", "updatedAt", "userId") SELECT "cenarioId", "cnpj", "createdAt", "id", "nome", "perfil", "updatedAt", "userId" FROM "Empresa";
DROP TABLE "Empresa";
ALTER TABLE "new_Empresa" RENAME TO "Empresa";
CREATE INDEX "Empresa_userId_idx" ON "Empresa"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_ref_key" ON "NotaFiscal"("ref");

-- CreateIndex
CREATE INDEX "NotaFiscal_userId_createdAt_idx" ON "NotaFiscal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotaFiscal_empresaId_createdAt_idx" ON "NotaFiscal"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversaoNota_userId_createdAt_idx" ON "ConversaoNota"("userId", "createdAt");
