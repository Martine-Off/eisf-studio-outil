// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type SectionId = 'connexion' | 'projet' | 'import' | 'generation' | 'verification'
               | 'edition' | 'audio' | 'export' | 'aide' | 'captures';

const C = {
  blue:       '#3465AE', red:    '#E63337', gray:   '#5A5963',
  bg:         '#F5F4F7', white:  '#ffffff', border: '#E8E6EA',
  ink:        '#1C1B22', blueBg: '#EDF2FA', blueBorder: '#C5D6EF',
} as const;

interface NavItem { id: SectionId; label: string; num: string; group: string }
const NAV: NavItem[] = [
  { id: 'connexion',    label: 'Se connecter',        num: '1',  group: 'Démarrage'    },
  { id: 'projet',       label: 'Créer un projet',      num: '2',  group: 'Démarrage'    },
  { id: 'import',       label: 'Importer Storyline',   num: '3',  group: 'Démarrage'    },
  { id: 'generation',   label: 'Générer le dialogue',  num: '4',  group: 'Génération'   },
  { id: 'verification', label: 'Vérifier la fidélité', num: '5',  group: 'Génération'   },
  { id: 'edition',      label: 'Éditer le dialogue',   num: '6',  group: 'Génération'   },
  { id: 'audio',        label: "Générer l'audio",      num: '7',  group: 'Finalisation' },
  { id: 'export',       label: 'Exporter',             num: '8',  group: 'Finalisation' },
  { id: 'aide',         label: 'Aide & dépannage',     num: '?',  group: 'Support'      },
  { id: 'captures',     label: 'Liste captures',       num: '📷', group: 'Support'      },
];

function Capture({ code, desc }: { code: string; desc: string }) {
  return (
    <div style={{ background: C.bg, border: `2px dashed ${C.border}`, borderRadius: 10, padding: '1.5rem', margin: '1rem 0', textAlign: 'center' }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0AEBC', marginBottom: 4 }}>{code}</span>
      <span style={{ fontSize: 13, color: C.gray }}>{desc}</span>
    </div>
  );
}

function Alert({ type, children }: { type: 'info' | 'warning' | 'block'; children: React.ReactNode }) {
  const s = {
    info:    { background: '#EDF6FF', border: '1px solid #B5D4F4', color: '#185FA5' },
    warning: { background: '#FFF8E6', border: '1px solid #F5D98A', color: '#7A5A0A' },
    block:   { background: '#FEECEC', border: '1px solid #F5BABA', color: '#A32D2D' },
  }[type];
  const icon = { info: '💡', warning: '⚠️', block: '🚫' }[type];
  return (
    <div style={{ ...s, display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderRadius: 10, padding: '0.9rem 1.1rem', margin: '1rem 0', fontSize: 13.5, lineHeight: 1.6 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.5rem', marginBottom: '1.25rem' }}>
      {children}
    </div>
  );
}

function StepHeader({ num, title, subtitle }: { num: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.blue, color: C.white, fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(52,101,174,0.3)' }}>
        {num}
      </div>
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: C.ink }}>{title}</h2>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: i < items.length - 1 ? `1px solid ${C.bg}` : 'none', fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
          <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: C.bg, color: C.blue, fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function SectionContent({ active }: { active: SectionId }) {
  if (active === 'connexion') return (
    <>
      <StepHeader num="1" title="Se connecter" subtitle="Accéder à Studio EISF depuis votre navigateur" />
      <Card>
        <Capture code="CAPTURE_01" desc="Page de connexion — champs identifiant + mot de passe + bouton Se connecter" />
        <Steps items={[
          <span>Ouvrir <strong>https://en.eisf.fr/studio</strong> dans votre navigateur</span>,
          <span>Saisir l'identifiant et le mot de passe fournis par votre administrateur</span>,
          <span>Cliquer sur <strong>Se connecter</strong></span>,
        ]} />
        <Alert type="info">Identifiant et mot de passe fournis par votre administrateur EISF. En cas de perte : <strong>contact@eisf.fr</strong></Alert>
      </Card>
    </>
  );

  if (active === 'projet') return (
    <>
      <StepHeader num="2" title="Créer un projet" subtitle="Un projet par cours ou module Storyline" />
      <Card>
        <Capture code="CAPTURE_02" desc='Tableau de bord avec bouton "Nouveau projet" en évidence' />
        <Steps items={[
          <span>Sur le tableau de bord, cliquer sur <strong>Nouveau projet</strong></span>,
          <span>Donner un nom au projet (ex : <em>"La panification — Module 1"</em>)</span>,
          <span>Cliquer sur <strong>Créer</strong></span>,
        ]} />
        <Alert type="info">Les personnages sont prédéfinis : <strong>Inès</strong> (experte, 70% du temps de parole) et <strong>Yannick</strong> (apprenant curieux, 30%).</Alert>
      </Card>
    </>
  );

  if (active === 'import') return (
    <>
      <StepHeader num="3" title="Importer votre cours Storyline" subtitle="Format accepté : export Word d'Articulate Storyline (.docx)" />
      <Card>
        <Capture code="CAPTURE_03" desc="Zone d'import glisser-déposer avec fichier .docx" />
        <Steps items={[
          <span>Dans le projet, cliquer sur <strong>Importer un fichier</strong></span>,
          <span>Glisser votre fichier <strong>.docx</strong> dans la zone, ou cliquer pour le sélectionner</span>,
          <span>L'outil détecte automatiquement les chapitres — vérifier la liste affichée</span>,
        ]} />
        <Capture code="CAPTURE_04" desc="Liste des chapitres détectés après import" />
        <Alert type="warning"><strong>Prérequis :</strong> Le fichier doit être un <strong>export Word d'Articulate Storyline</strong> (tableau 4 colonnes). Un export PDF ou un document Word classique ne fonctionnera pas.</Alert>
      </Card>
    </>
  );

  if (active === 'generation') return (
    <>
      <StepHeader num="4" title="Générer le dialogue IA" subtitle="L'IA crée un dialogue naturel entre Inès et Yannick" />
      <Card>
        <Capture code="CAPTURE_05" desc='Sélection d\'un chapitre + choix durée + bouton "Générer le dialogue"' />
        <Steps items={[
          <span>Sélectionner un chapitre dans la liste</span>,
          <span>Choisir la durée cible : <strong>4, 5, 6 ou 7 minutes</strong></span>,
          <span>Cliquer sur <strong>Générer le dialogue</strong></span>,
          <span>Attendre la génération (30 à 60 secondes selon la longueur)</span>,
        ]} />
        <Alert type="info">Le dialogue contient automatiquement : une <strong>accroche</strong> (45s), le <strong>contenu pédagogique</strong> avec quiz intégré, une <strong>conclusion</strong> + annonce du prochain épisode, et l'<strong>intro/outro EISF</strong> fixes.</Alert>
      </Card>
    </>
  );

  if (active === 'verification') return (
    <>
      <StepHeader num="5" title="Vérifier la fidélité au contenu" subtitle="Garantir que le dialogue respecte votre cours source" />
      <Card>
        <Capture code="CAPTURE_06" desc="Bandeau score de fidélité (ex : 97%) en haut de l'éditeur" />
        <p style={{ fontSize: 14, color: C.gray, marginBottom: '0.75rem', lineHeight: 1.6 }}>Après génération, l'IA vérifie automatiquement que le dialogue respecte votre cours source.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#EAF3DE', color: '#3B6D11', border: '1px solid #C0DD97' }}>✅ Score ≥ 95% — vous pouvez générer l'audio</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#FFF8E6', color: '#7A5A0A', border: '1px solid #F5D98A' }}>⚠️ Score &lt; 95% — corrections suggérées</span>
        </div>
      </Card>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.ink, margin: '1.25rem 0 0.75rem', paddingBottom: '0.4rem', borderBottom: `2px solid ${C.bg}` }}>Les balises [PROPOSITION]</p>
      <Card>
        <p style={{ fontSize: 14, color: C.gray, marginBottom: '0.75rem', lineHeight: 1.6 }}>Quand l'IA ajoute du contenu <strong>absent de votre cours source</strong>, elle le signale :</p>
        <Capture code="CAPTURE_07" desc="Bandeau orange «Propositions en attente» avec boutons ◀ ▶ Garder / Supprimer" />
        <div style={{ background: '#FFF3EC', border: '1px solid #F5C4A0', borderRadius: 10, padding: '1.25rem 1.5rem', margin: '1rem 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C05A0A', marginBottom: '0.6rem' }}>Proposition détectée</div>
          <code style={{ display: 'block', fontFamily: "'Courier New', monospace", fontSize: 13, background: C.white, border: '1px solid #F5C4A0', borderRadius: 6, padding: '10px 14px', color: '#7A3A0A', marginBottom: '0.75rem' }}>[PROPOSITION: exemple concret que j'ajoute pour illustrer]</code>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ background: '#3B6D11', color: C.white, borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 700 }}>Garder</span>
            <span style={{ background: '#A32D2D', color: C.white, borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 700 }}>Supprimer</span>
          </div>
        </div>
        <Alert type="block">La génération audio est <strong>bloquée</strong> tant qu'il reste des propositions non résolues. Utiliser les boutons <strong>◀ ▶</strong> pour naviguer entre elles.</Alert>
      </Card>
    </>
  );

  if (active === 'edition') return (
    <>
      <StepHeader num="6" title="Éditer le dialogue" subtitle="Modifier les répliques directement dans l'éditeur" />
      <Card>
        <Capture code="CAPTURE_08" desc="Éditeur avec une réplique sélectionnée en mode édition" />
        <Steps items={[
          <span>Cliquer sur une réplique pour la modifier directement</span>,
          <span>Les modifications sont sauvegardées automatiquement</span>,
          <span>Relancer la vérification après toute modification importante</span>,
        ]} />
      </Card>
    </>
  );

  if (active === 'audio') return (
    <>
      <StepHeader num="7" title="Générer l'audio" subtitle="Synthèse vocale par les voix Inès et Yannick (ElevenLabs)" />
      <Card>
        <Capture code="CAPTURE_09" desc="Bouton «Générer l'audio» actif + lecteur audio intégré avec waveform" />
        <Steps items={[
          <span>Vérifier que toutes les propositions sont résolues et le score ≥ 95%</span>,
          <span>Cliquer sur <strong>Générer l'audio</strong></span>,
          <span>Attendre la synthèse vocale (1 à 3 minutes selon la durée)</span>,
          <span>Écouter l'aperçu dans le lecteur intégré</span>,
        ]} />
        <Alert type="info">Les voix utilisées sont celles d'<strong>Inès</strong> et <strong>Yannick</strong>, synthétisées par ElevenLabs.</Alert>
      </Card>
    </>
  );

  if (active === 'export') return (
    <>
      <StepHeader num="8" title="Exporter le podcast" subtitle="Plusieurs formats disponibles selon l'usage" />
      <Card>
        <Capture code="CAPTURE_10" desc="Menu d'export avec les différents formats disponibles" />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, margin: '0.75rem 0' }}>
          <thead>
            <tr>
              {['Format', 'Usage'].map(h => (
                <th key={h} style={{ background: C.bg, color: C.gray, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { fmt: 'MP3',          main: true,  usage: 'Podcast final à diffuser aux apprenants' },
              { fmt: 'Word Studio',  main: false, usage: 'Dialogue avec indications de jeu (usage interne)' },
              { fmt: 'Word Lecture', main: false, usage: 'Texte seul, sans instructions (version apprenant)' },
              { fmt: 'PDF',          main: false, usage: 'Version imprimable' },
              { fmt: 'JSON',         main: false, usage: 'Données complètes (usage technique)' },
            ].map((row, i, arr) => (
              <tr key={row.fmt}>
                <td style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontWeight: 600 }}>
                  <span style={row.main
                    ? { background: C.blue, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: C.white }
                    : { background: C.blueBg, border: `1px solid ${C.blueBorder}`, borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700, color: C.blue }}>
                    {row.fmt}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', color: C.ink, lineHeight: 1.5 }}>{row.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );

  if (active === 'aide') return (
    <>
      <StepHeader num="?" title="Aide & dépannage" subtitle="Solutions aux problèmes les plus fréquents" />
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, margin: '0.75rem 0' }}>
          <thead>
            <tr>
              {['Problème', 'Solution'].map(h => (
                <th key={h} style={{ background: C.bg, color: C.gray, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 14px', textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Le fichier .docx n'est pas reconnu", "Vérifier que c'est un export Storyline, pas un Word classique"],
              ["La génération échoue",               "Vérifier la connexion internet et relancer"],
              ["Score de fidélité bas",              "Corriger les passages inventés dans l'éditeur, relancer la vérification"],
              ["L'audio est coupé",                  "Rafraîchir la page et régénérer l'audio"],
              ["Bouton audio grisé",                 "Résoudre toutes les balises [PROPOSITION] d'abord"],
              ["Mot de passe oublié",                "Contacter contact@eisf.fr"],
            ].map(([prob, sol], i, arr) => (
              <tr key={i}>
                <td style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontWeight: 600, color: C.ink, verticalAlign: 'top', lineHeight: 1.5 }}>{prob}</td>
                <td style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', color: C.ink, verticalAlign: 'top', lineHeight: 1.5 }}>{sol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
        <div style={{ width: 42, height: 42, background: C.blue, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="white" strokeWidth="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <div>
          <p style={{ fontSize: 13, color: C.gray, marginBottom: 2 }}>Problème non résolu ?</p>
          <a href="mailto:contact@eisf.fr" style={{ color: C.blue, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>contact@eisf.fr</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <StepHeader num="📷" title="Liste des captures à réaliser" subtitle="10 captures à faire dans l'outil puis à insérer dans ce guide" />
      <Alert type="info">Remplace chaque placeholder par une vraie capture — fichier <code>captures/CAPTURE_XX.png</code> dans le dossier <code>docs/captures/</code>.</Alert>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        {[
          ['CAPTURE_01', 'Page de connexion — champs + bouton Se connecter'],
          ['CAPTURE_02', 'Tableau de bord avec bouton "Nouveau projet"'],
          ['CAPTURE_03', "Zone d'import glisser-déposer .docx"],
          ['CAPTURE_04', 'Liste des chapitres détectés après import'],
          ['CAPTURE_05', 'Sélection chapitre + durée + bouton Générer'],
          ['CAPTURE_06', 'Bandeau score de fidélité (ex : 97%)'],
          ['CAPTURE_07', 'Bandeau orange propositions + boutons ◀ ▶'],
          ['CAPTURE_08', 'Éditeur avec réplique en mode édition'],
          ['CAPTURE_09', "Bouton «Générer l'audio» + lecteur audio"],
          ['CAPTURE_10', "Menu d'export avec formats disponibles"],
        ].map(([ref, desc]) => (
          <div key={ref} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ background: C.blue, color: C.white, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>{ref}</span>
            <span style={{ fontSize: 13, color: C.gray, lineHeight: 1.5 }}>{desc}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Guide() {
  const [active, setActive] = useState<SectionId>('connexion');
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: C.ink, background: C.bg, minHeight: '100vh' }}>

      {/* Tricolor */}
      <div style={{ display: 'flex', height: 4, width: '100%', position: 'fixed', top: 0, left: 0, zIndex: 100 }}>
        <div style={{ flex: 1, background: C.blue }} />
        <div style={{ flex: 1, background: C.white, borderTop: `1px solid ${C.border}` }} />
        <div style={{ flex: 1, background: C.red }} />
      </div>

      {/* Header */}
      <header style={{ position: 'fixed', top: 4, left: 0, right: 0, zIndex: 99, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}`, padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.gray, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
          <ArrowLeft size={14} /> Retour
        </button>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: C.ink }}>Studio <span style={{ color: C.blue }}>EISF</span></span>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.gray }}>Guide utilisateur</span>
        <span style={{ marginLeft: 'auto', background: C.blue, color: C.white, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.03em' }}>v1.0</span>
      </header>

      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 64 }}>

        {/* Sidebar */}
        <nav style={{ width: 240, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.border}`, position: 'fixed', top: 64, bottom: 0, overflowY: 'auto', padding: '1.5rem 0' }}>
          {['Démarrage', 'Génération', 'Finalisation', 'Support'].map(group => (
            <div key={group} style={{ padding: '0 1rem 1rem' }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.gray, padding: '0 0.75rem 0.5rem', display: 'block' }}>{group}</span>
              {NAV.filter(n => n.group === group).map(n => (
                <button key={n.id} onClick={() => setActive(n.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: 13.5, fontWeight: active === n.id ? 700 : 500, color: active === n.id ? C.blue : C.gray, background: active === n.id ? '#EDF2FA' : 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: active === n.id ? C.blue : C.border, color: active === n.id ? C.white : C.gray, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{n.num}</span>
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Main */}
        <main style={{ marginLeft: 240, flex: 1, padding: '2.5rem 3rem', maxWidth: 860 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '2rem 2.5rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#EDF2FA', color: C.blue, border: `1px solid ${C.blueBorder}` }}>Pour les formateurs EISF</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: '#F5F8E8', color: '#5A6B10', border: '1px solid #D0E08A' }}>Aucune compétence technique requise</span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: C.ink, marginBottom: '0.6rem', lineHeight: 1.3 }}>Transformez vos cours en <span style={{ color: C.blue }}>podcasts pédagogiques</span></h1>
            <p style={{ fontSize: '0.95rem', color: C.gray, lineHeight: 1.7, maxWidth: 520 }}>Ce guide vous accompagne pas à pas, de l'import de votre fichier Storyline jusqu'à l'export du podcast final.</p>
          </div>
          <SectionContent active={active} />
        </main>
      </div>

      <footer style={{ marginLeft: 240, borderTop: `1px solid ${C.border}`, padding: '1.5rem 3rem', fontSize: 12, color: C.gray, background: C.white }}>
        © 2026 EISF — École Internationale du Savoir-Faire Français. Développé par Martine Desmaroux.
      </footer>
    </div>
  );
}
