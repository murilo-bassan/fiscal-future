export function BarraUso({ rotulo, usados, limite }: { rotulo: string; usados: number; limite: number }) {
  const frac = limite > 0 ? Math.min(usados / limite, 1) : 1;
  const cheio = usados >= limite;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">{rotulo}</span>
        <span className="text-ink">
          <span className="font-semibold">{usados.toLocaleString("pt-BR")}</span>
          <span className="text-muted"> de {limite.toLocaleString("pt-BR")}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${cheio ? "bg-bad" : "bg-brand"}`} style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}
