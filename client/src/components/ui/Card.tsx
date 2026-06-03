import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={['bg-surface border border-border rounded-lg shadow-card', padding ? 'p-5' : '', className].join(' ')}>
      {children}
    </div>
  );
}
