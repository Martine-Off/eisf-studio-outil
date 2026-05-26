// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic2, X, Loader2, Play, Volume2, Zap } from 'lucide-react';

export interface AudioSettings {
    voiceInes: string;
    voiceYannick: string;
    speed: number;
}

interface GenerateAudioModalProps {
    isOpen: boolean;
    onConfirm: (settings: AudioSettings) => void;
    onCancel: () => void;
    isGenerating?: boolean;
    estimatedDurationMin?: number;
}

const VOICES = [
    { name: 'Kore',       label: 'Kore',       description: 'Douce, pédagogique' },
    { name: 'Charon',     label: 'Charon',     description: 'Claire, naturelle' },
    { name: 'Fenrir',     label: 'Fenrir',     description: 'Dynamique, affirmée' },
    { name: 'Orus',       label: 'Orus',       description: 'Profonde, posée' },
    { name: 'Sadaltager', label: 'Sadaltager', description: 'Entraînante, expressive' },
];

const SPEEDS = [
    { value: 0.9, label: '0.9×', description: 'Lent' },
    { value: 1.0, label: '1×',   description: 'Normal' },
    { value: 1.1, label: '1.1×', description: 'Rapide' },
];

function VoiceSelector({
    label,
    character,
    value,
    onChange,
}: {
    label: string;
    character: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);

    const playPreview = (e: React.MouseEvent, voiceName: string) => {
        e.stopPropagation();
        if (previewPlaying === voiceName) {
            setPreviewPlaying(null);
            return;
        }
        setPreviewPlaying(voiceName);
        const audio = new Audio(`/audio/voice_preview_${voiceName}.wav`);
        audio.play().catch(() => {});
        audio.onended = () => setPreviewPlaying(null);
        audio.onerror = () => setPreviewPlaying(null);
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D6475B]/10 text-[10px] font-bold text-[#D6475B]">
                    {character.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground">{label}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
                {VOICES.map(v => (
                    <button
                        key={v.name}
                        type="button"
                        onClick={() => onChange(v.name)}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-all border ${
                            value === v.name
                                ? 'border-[#D6475B]/40 bg-[#D6475B]/[0.05] text-foreground'
                                : 'border-[#E0DCE0] bg-white text-muted-foreground hover:border-[#D6475B]/30 hover:bg-[#F8F7F8]'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${value === v.name ? 'bg-[#D6475B]' : 'bg-[#D4D0D4]'}`} />
                            <div>
                                <span className="text-xs font-semibold">{v.label}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">{v.description}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => playPreview(e, v.name)}
                            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#6BB8CD]/10 text-[#6BB8CD] transition-colors flex-shrink-0"
                            title="Écouter un aperçu"
                        >
                            {previewPlaying === v.name ? (
                                <Volume2 className="h-3 w-3 animate-pulse" />
                            ) : (
                                <Play className="h-3 w-3" />
                            )}
                        </button>
                    </button>
                ))}
            </div>
        </div>
    );
}

const GenerateAudioModal: React.FC<GenerateAudioModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    isGenerating = false,
    estimatedDurationMin,
}) => {
    const [voiceInes, setVoiceInes] = useState('Kore');
    const [voiceYannick, setVoiceYannick] = useState('Charon');
    const [speed, setSpeed] = useState(1.0);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay semi-transparent */}
                    <motion.div
                        key="overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={!isGenerating ? onCancel : undefined}
                        className="fixed inset-0 z-40 bg-black/45"
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ scale: 0.96, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.96, opacity: 0, y: 8 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                        className="fixed inset-x-4 top-[6%] bottom-[6%] max-w-xl mx-auto z-50 bg-white border border-[#E0DCE0] shadow-2xl rounded-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EEF0] flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D6475B]/10">
                                    <Mic2 className="h-5 w-5 text-[#D6475B]" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-sm text-foreground">Générer l'audio</h2>
                                    <p className="text-[11px] text-muted-foreground">
                                        {estimatedDurationMin
                                            ? `Durée estimée : ~${estimatedDurationMin} min`
                                            : 'Configuration de la synthèse vocale'}
                                    </p>
                                </div>
                            </div>
                            {!isGenerating && (
                                <button
                                    onClick={onCancel}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#F0EEF0] transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                            {isGenerating ? (
                                <div className="flex flex-col items-center justify-center h-full py-12 gap-4">
                                    <div className="relative">
                                        <div className="h-16 w-16 rounded-full bg-[#D6475B]/10 flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 text-[#D6475B] animate-spin" />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-foreground">Synthèse vocale en cours…</p>
                                        <p className="text-sm text-muted-foreground mt-1">Ne fermez pas cette fenêtre.</p>
                                    </div>
                                    {/* Progress bar animation */}
                                    <div className="w-64 h-1.5 bg-[#E0DCE0] rounded-full overflow-hidden mt-2">
                                        <motion.div
                                            className="h-full bg-[#D6475B] rounded-full"
                                            initial={{ width: '5%' }}
                                            animate={{ width: '92%' }}
                                            transition={{ duration: 90, ease: 'easeOut' }}
                                        />
                                    </div>
                                    {estimatedDurationMin && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Durée estimée : ~{estimatedDurationMin} min
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {/* Voix par personnage */}
                                    <section>
                                        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-3">
                                            Voix par personnage
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <VoiceSelector
                                                label="Inès (présentatrice)"
                                                character="ines"
                                                value={voiceInes}
                                                onChange={setVoiceInes}
                                            />
                                            <VoiceSelector
                                                label="Yannick (expert)"
                                                character="yannick"
                                                value={voiceYannick}
                                                onChange={setVoiceYannick}
                                            />
                                        </div>
                                    </section>

                                    {/* Vitesse */}
                                    <section>
                                        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-3">
                                            Vitesse de lecture
                                        </h3>
                                        <div className="flex gap-2">
                                            {SPEEDS.map(s => (
                                                <button
                                                    key={s.value}
                                                    type="button"
                                                    onClick={() => setSpeed(s.value)}
                                                    className={`flex-1 flex flex-col items-center py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                                        speed === s.value
                                                            ? 'border-[#6BB8CD]/50 bg-[#6BB8CD]/10 text-[#1a6a80]'
                                                            : 'border-[#E0DCE0] text-muted-foreground hover:border-[#6BB8CD]/30 hover:bg-[#F8F7F8]'
                                                    }`}
                                                >
                                                    <span>{s.label}</span>
                                                    <span className="text-[10px] font-normal mt-0.5">{s.description}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Notice */}
                                    <div className="flex items-start gap-2.5 bg-[#6BB8CD]/[0.08] border border-[#6BB8CD]/20 rounded-xl px-4 py-3">
                                        <Zap className="h-4 w-4 text-[#1a6a80] flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-[#1a6a80]">
                                            La génération consomme des crédits API Gemini TTS. Vérifiez que le script est finalisé avant de lancer.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!isGenerating && (
                            <div className="flex gap-3 px-6 py-4 border-t border-[#F0EEF0] flex-shrink-0">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 bg-[#F0EEF0] text-foreground font-semibold py-2.5 rounded-lg hover:bg-[#E6E2E6] transition-colors text-sm"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => onConfirm({ voiceInes, voiceYannick, speed })}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#D6475B] text-white font-semibold py-2.5 rounded-lg hover:bg-[#c03d50] transition-colors text-sm active:scale-[0.99]"
                                >
                                    <Mic2 className="h-4 w-4" />
                                    Générer l'audio
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default GenerateAudioModal;
