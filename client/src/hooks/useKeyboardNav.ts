import { useEffect } from 'react';

export function useKeyboardNav(handlers: {
    onSave?: () => void;
    onEdit?: () => void;
    onGenerate?: () => void;
}) {
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Ctrl + S : Sauvegarder
            if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handlers.onSave?.();
            }

            // Ctrl + E : Mode édition
            if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
                handlers.onEdit?.();
            }

            // Ctrl + G : Générer
            if (e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
                e.preventDefault();
                handlers.onGenerate?.();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handlers]);
}
