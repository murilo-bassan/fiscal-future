-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConversaoNota" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "empresaId" TEXT,
    "chave" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "emitente" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "resultado" TEXT NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'xml',
    "xmlOriginal" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversaoNota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversaoNota_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ConversaoNota" ("ano", "chave", "createdAt", "emitente", "empresaId", "id", "numero", "resultado", "userId", "xmlOriginal") SELECT "ano", "chave", "createdAt", "emitente", "empresaId", "id", "numero", "resultado", "userId", "xmlOriginal" FROM "ConversaoNota";
DROP TABLE "ConversaoNota";
ALTER TABLE "new_ConversaoNota" RENAME TO "ConversaoNota";
CREATE INDEX "ConversaoNota_userId_createdAt_idx" ON "ConversaoNota"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
