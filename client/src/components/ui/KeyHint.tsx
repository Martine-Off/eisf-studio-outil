interface KeyHintProps {
  k: string;
  className?: string;
}

export function KeyHint({ k, className = '' }: KeyHintProps) {
  return (
    <kbd className={[
      'inline-flex items-center justify-center h-5 min-w-[20px] px-1',
      'rounded text-[11px] font-medium font-heading',
      'bg-border text-ink-soft border border-border-soft',
      className,
    ].join(' ')}>
      {k}
    </kbd>
  );
}
