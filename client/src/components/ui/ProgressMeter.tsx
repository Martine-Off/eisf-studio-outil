/**
 * Studio EISF — Plateforme de génération de podcasts pédagogiques
 *
 * © 2026 EISF — École Internationale du Savoir-Faire Français
 * Tous droits réservés / All Rights Reserved.
 *
 * @author  Martine Desmaroux <contact@eisf.fr>
 * @license Propriétaire — EISF
 */
interface ProgressMeterProps {
  value: number;
  threshold?: number;
  label?: string;
  className?: string;
}

type Level = 'success' | 'warning' | 'danger';

function getLevel(value: number, threshold?: number): Level {
  if (threshold != null && value >= threshold) return 'success';
  if (value >= 70) return 'warning';
  return 'danger';
}

const levelMap: Record<Level, { bar: string; text: string; status: string }> = {
  success: { bar: 'bg-emerald', text: 'text-emerald-ink', status: 'Validé' },
  warning: { bar: 'bg-amber',   text: 'text-amber-ink',   status: 'À renforcer' },
  danger:  { bar: 'bg-danger',  text: 'text-danger-ink',  status: 'Insuffisant' },
};

export function ProgressMeter({ value, threshold, label, className = '' }: ProgressMeterProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const { bar, text, status } = levelMap[getLevel(clamped, threshold)];

  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      {label && <span className="text-[13px] text-ink-soft shrink-0">{label}</span>}
      <div className="relative flex-1 h-[5px] bg-border rounded-pill overflow-visible">
        <div
          className={['h-full rounded-pill transition-all', bar].join(' ')}
          style={{ width: `${clamped}%` }}
        />
        {threshold != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[2px] h-[9px] bg-ink-faint rounded-full"
            style={{ left: `${threshold}%` }}
          />
        )}
      </div>
      <span className={['text-[12px] font-medium font-heading tabular-nums shrink-0', text].join(' ')}>
        {clamped}%
      </span>
      <span className="text-[12px] text-ink-faint shrink-0">{status}</span>
    </div>
  );
}
