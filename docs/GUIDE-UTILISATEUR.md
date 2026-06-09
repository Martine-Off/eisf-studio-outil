# Guide utilisateur — Studio EISF

> **Pour qui ?** Les formateurs EISF qui souhaitent transformer leurs cours Storyline en podcasts pédagogiques.
> **Prérequis :** Avoir un export `.docx` Articulate Storyline. Aucune compétence technique requise.
> **URL de l'outil :** https://en.eisf.fr/studio

---

## Table des matières

1. [Se connecter](#1-se-connecter)
2. [Créer un projet](#2-créer-un-projet)
3. [Importer votre cours Storyline](#3-importer-votre-cours-storyline)
4. [Générer le dialogue IA](#4-générer-le-dialogue-ia)
5. [Vérifier la fidélité au contenu](#5-vérifier-la-fidélité-au-contenu)
6. [Éditer le dialogue](#6-éditer-le-dialogue)
7. [Générer l'audio](#7-générer-laudio)
8. [Exporter le podcast](#8-exporter-le-podcast)
9. [Problèmes fréquents](#9-problèmes-fréquents)

---

## 1. Se connecter

[CAPTURE_01 — Page de connexion : champs identifiant + mot de passe + bouton "Se connecter"]

1. Ouvrir **https://en.eisf.fr/studio** dans votre navigateur
2. Saisir l'identifiant et le mot de passe fournis par votre administrateur
3. Cliquer sur **Se connecter**

> 💡 Identifiant et mot de passe fournis par votre administrateur EISF.
> En cas de perte : contacter **contact@eisf.fr**

---

## 2. Créer un projet

[CAPTURE_02 — Tableau de bord avec bouton "Nouveau projet" en évidence]

1. Sur le tableau de bord, cliquer sur **Nouveau projet**
2. Donner un nom au projet (ex : *"La panification — Module 1"*)
3. Cliquer sur **Créer**

> 💡 Les personnages sont prédéfinis : **Inès** (experte, 70% du temps de parole) et **Yannick** (apprenant curieux, 30%).

---

## 3. Importer votre cours Storyline

[CAPTURE_03 — Zone d'import avec glisser-déposer du fichier .docx]

1. Dans le projet, cliquer sur **Importer un fichier**
2. Glisser votre fichier `.docx` dans la zone prévue, ou cliquer pour le sélectionner
3. L'outil détecte automatiquement les chapitres — vérifier la liste affichée

[CAPTURE_04 — Liste des chapitres détectés après import]

> ⚠️ **Prérequis fichier :** Le fichier doit être un **export Word d'Articulate Storyline** (tableau 4 colonnes : ID, Type, Texte d'origine, Traduction).
> Un export PDF ou un document Word classique ne fonctionnera pas.

---

## 4. Générer le dialogue IA

[CAPTURE_05 — Sélection d'un chapitre + choix de durée + bouton "Générer le dialogue"]

1. Sélectionner un chapitre dans la liste
2. Choisir la durée cible : **4, 5, 6 ou 7 minutes**
3. Cliquer sur **Générer le dialogue**
4. Attendre la génération (30 à 60 secondes selon la longueur du chapitre)

> 💡 Le dialogue généré contient automatiquement :
> - Une **accroche** (45 secondes)
> - Le **contenu pédagogique** avec un quiz intégré
> - Une **conclusion** + annonce du prochain épisode
> - L'**intro et l'outro EISF** fixes

---

## 5. Vérifier la fidélité au contenu

[CAPTURE_06 — Bandeau de score de fidélité (ex : 97%) affiché en haut de l'éditeur]

Après génération, l'IA vérifie automatiquement que le dialogue respecte votre cours source.

| Score | Signification | Action |
|---|---|---|
| ✅ ≥ 95% | Fidèle au contenu source | Vous pouvez générer l'audio |
| ⚠️ < 95% | Des écarts ont été détectés | Corriger dans l'éditeur, relancer la vérification |

### Les balises [PROPOSITION]

Quand l'IA ajoute du contenu **absent de votre cours source**, elle le signale :

```
[PROPOSITION: exemple concret que j'ajoute pour illustrer]
```

[CAPTURE_07 — Bandeau orange "Propositions en attente" avec boutons ◀ ▶ Garder / Supprimer]

- Cliquer **Garder** → l'ajout est validé et intégré au dialogue
- Cliquer **Supprimer** → l'ajout est retiré

> ⚠️ La génération audio est **bloquée** tant qu'il reste des propositions non résolues.
> Utiliser les boutons **◀ ▶** pour naviguer entre elles.

---

## 6. Éditer le dialogue

[CAPTURE_08 — Éditeur avec une réplique sélectionnée en mode édition]

1. Cliquer sur une réplique pour la modifier directement
2. Les modifications sont sauvegardées automatiquement
3. Relancer la vérification après toute modification importante

---

## 7. Générer l'audio

[CAPTURE_09 — Bouton "Générer l'audio" actif + lecteur audio intégré avec waveform]

1. Vérifier que toutes les propositions sont résolues et le score ≥ 95%
2. Cliquer sur **Générer l'audio**
3. Attendre la synthèse vocale (1 à 3 minutes selon la durée du podcast)
4. Écouter l'aperçu dans le lecteur intégré

> 💡 Les voix utilisées sont celles d'**Inès** et **Yannick**, synthétisées par ElevenLabs.

---

## 8. Exporter le podcast

[CAPTURE_10 — Menu d'export avec les différents formats disponibles]

| Format | Usage |
|---|---|
| **MP3** | Podcast final à diffuser aux apprenants |
| **Word Studio** | Dialogue avec indications de jeu (usage interne) |
| **Word Lecture** | Texte seul, sans instructions (version apprenant) |
| **PDF** | Version imprimable |
| **JSON** | Données complètes (usage technique) |

---

## 9. Problèmes fréquents

| Problème | Solution |
|---|---|
| Le fichier `.docx` n'est pas reconnu | Vérifier que c'est un export Storyline, pas un Word classique |
| La génération échoue | Vérifier la connexion internet et relancer |
| Le score de fidélité est bas | Corriger les passages inventés dans l'éditeur, relancer la vérification |
| L'audio est coupé | Rafraîchir la page et régénérer l'audio |
| Le bouton audio est grisé | Résoudre toutes les balises [PROPOSITION] d'abord |
| Je ne me souviens plus de mon mot de passe | Contacter contact@eisf.fr |

---

## Contact & support

Problème non résolu ? **contact@eisf.fr**

---

*© 2026 EISF — École Internationale du Savoir-Faire Français. Développé par Martine Desmaroux.*

---

## Liste des captures à réaliser

| Référence | Ce qu'il faut capturer |
|---|---|
| CAPTURE_01 | Page de connexion (champs + bouton) |
| CAPTURE_02 | Tableau de bord avec bouton "Nouveau projet" |
| CAPTURE_03 | Zone d'import glisser-déposer |
| CAPTURE_04 | Liste des chapitres détectés après import |
| CAPTURE_05 | Sélection chapitre + durée + bouton Générer |
| CAPTURE_06 | Bandeau score de fidélité (≥ 95%) |
| CAPTURE_07 | Bandeau orange propositions + boutons ◀ ▶ |
| CAPTURE_08 | Éditeur avec réplique en mode édition |
| CAPTURE_09 | Bouton "Générer l'audio" + lecteur |
| CAPTURE_10 | Menu d'export avec formats |
