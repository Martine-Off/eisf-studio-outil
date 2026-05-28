// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import { AlertTriangle } from 'lucide-react';

interface ErrorModalProps {
    message: string;
    onClose: () => void;
}

export default function ErrorModal({ message, onClose }: ErrorModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">{message}</p>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#F0EEF0] text-foreground hover:bg-[#E6E2E6] transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}
