import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // .claude/worktrees guarda cópias do repositório usadas por agentes
  test: { exclude: [...configDefaults.exclude, ".claude/**"] },
});
