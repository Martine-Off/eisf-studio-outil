import React from 'react';

interface ChecklistItemProps {
  checked?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ChecklistItem({ checked = false, children, className = '' }: ChecklistItemProps) {
  return (
    <div className={['flex items-start gap-2.5', className].join(' ')}>
      <span className={[
        'mt-0.5 shrink-0 w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors',
        checked ? 'bg-emerald border-emerald' : 'bg-surface border-border',
      ].join(' ')}>
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={['text-[14px] leading-snug', checked ? 'line-through text-ink-faint' : 'text-ink'].join(' ')}>
        {children}
      </span>
    </div>
  );
}
