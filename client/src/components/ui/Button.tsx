import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40',
  secondary: 'bg-surface border border-border text-ink-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/40',
  ghost:     'text-ink-soft hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-primary/40',
  danger:    'bg-surface border border-danger/30 text-danger hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger/30',
};

const sizes: Record<Size, string> = {
  sm: 'h-8  px-3 text-[13px] gap-1.5',
  md: 'h-9  px-4 text-[14px] gap-1.5',
  lg: 'h-10 px-5 text-[15px] gap-2',
};

export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded font-body font-medium',
        'transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {icon && <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {children}
    </button>
  );
}
