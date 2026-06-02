import React from 'react';

export type BadgeTone = 'neutral' | 'amber' | 'emerald' | 'danger' | 'ines' | 'yannick' | 'mauve';

interface BadgeProps {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ink/8    border-ink/15    text-ink-soft',
  amber:   'bg-amber/12   border-amber/30   text-amber-ink',
  emerald: 'bg-emerald/12 border-emerald/30 text-emerald-ink',
  danger:  'bg-danger/12  border-danger/30  text-danger-ink',
  ines:    'bg-ines/12    border-ines/30    text-ines-ink',
  yannick: 'bg-yannick/12 border-yannick/30 text-yannick-ink',
  mauve:   'bg-mauve/12   border-mauve/30   text-yannick-ink',
};

export function Badge({ tone = 'neutral', icon, children, className = '' }: BadgeProps) {
  return (
    <span className={[
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border text-[12px] font-medium',
      tones[tone],
      className,
    ].join(' ')}>
      {icon && <span className="shrink-0 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>}
      {children}
    </span>
  );
}
