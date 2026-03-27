'use client';

type Variant = 'neutral' | 'good' | 'warn' | 'danger' | 'info';

type StatusChipProps = {
  label: string;
  variant?: Variant;
};

const variantClass: Record<Variant, string> = {
  neutral: 'border-base-300 bg-base-100/80 text-base-content/80',
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
};

export function StatusChip({ label, variant = 'neutral' }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${variantClass[variant]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

