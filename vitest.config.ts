import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // Mesmo alias do tsconfig
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // .claude/worktrees guarda cópias do repositório usadas por agentes
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
