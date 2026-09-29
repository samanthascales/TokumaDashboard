import type { ReactNode } from 'react';

interface Row {
  color: string;
  label: string;
  value: ReactNode;
  dashed?: boolean;
}

export function TooltipBox({ title, rows, footer }: { title: ReactNode; rows: Row[]; footer?: ReactNode }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2.5 text-xs shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink-850/95">
      <p className="mb-1.5 font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              {r.dashed ? (
                <span className="w-3 border-t-2 border-dashed" style={{ borderColor: r.color }} />
              ) : (
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <p className="mt-2 border-t border-gray-100 pt-1.5 text-[11px] text-gray-400 dark:border-white/5">{footer}</p>}
    </div>
  );
}

export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      {dashed ? <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: color }} /> : <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  );
}
