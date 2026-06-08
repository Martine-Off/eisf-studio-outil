/**
 * Studio EISF — Plateforme de génération de podcasts pédagogiques
 *
 * © 2026 EISF — École Internationale du Savoir-Faire Français
 * Tous droits réservés / All Rights Reserved.
 *
 * @author  Martine Desmaroux <contact@eisf.fr>
 * @license Propriétaire — EISF
 */
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
