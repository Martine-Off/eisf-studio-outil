# Architecture d'Intégration Audio IA : Recommandations

Ce document récapitule les choix architecturaux optimaux pour connecter un outil de création audio (Text-to-Speech) à votre plateforme, en tenant compte des contraintes métiers (e-learning, podcasts longs) et des impératifs techniques.

## 1. Gestion des contenus longs (Fragmentation)
> [!IMPORTANT]  
> **Le défi** : Un épisode de podcast de 20 minutes dépasse les limites de caractères d'un seul appel API.

**La solution recommandée** :
- **Découpage intelligent (Chunking)** : Le système doit analyser le script et le découper intelligemment en segments (paragraphes ou sections) pour rester sous les quotas de l'API (souvent 5 000 ou 10 000 caractères), sans jamais couper une phrase en plein milieu.
- **Génération asynchrone** : Chaque segment est envoyé à l'API.
- **Concaténation (Stitching)** : Une fois tous les segments générés, un outil de traitement doit les "recoudre" ensemble (via des bibliothèques telles que **FFmpeg** ou un module spécifique sur un outil d'automatisation comme Make) pour fournir un fichier d'une seule traite, sans coupure audible.

## 2. Gestion des erreurs et Résilience (Retries)
> [!CAUTION]
> **Le défi** : Une erreur (timeout, micro-bug réseau) à 90% d'un fichier peut faire perdre tous les crédits générés si aucune sécurité n'est prévue.

**La solution recommandée** :
- **Sauvegarde segmentée** : En lien avec la fragmentation évoquée au point 1, le système doit sauvegarder chaque segment validé.
- **Logique de Retry (Nouvelle tentative)** : Si une erreur survient (timeout, erreur 500 API), le système ne repart pas de zéro. Il effectue une nouvelle tentative (Retry conditionnel) uniquement sur le sous-segment en échec. Ainsi, aucune perte de temps ni de crédits API sur ce qui a déjà fonctionné.

## 3. Format, Stockage et Métadonnées
> [!NOTE]
> **Le défi** : En e-learning, il est vital d'allier fluidité de chargement (compressé) et flexibilité (formats propres pour montage), tout en retrouvant la trace des paramètres IA.

**La solution recommandée** :
- **Stockage Cloud Scalable** : Tous les fichiers (temporaires et finaux) doivent atterrir dans un espace Cloud sécurisé et organisé (via des buckets type S3, Google Cloud Storage, ou une arborescence stricte via Make/Dropbox).
- **Flexibilité des Formats** : Générer et conserver le **WAV** original si le flux implique un traitement post-production poussé, mais systématiser l'export **MP3** pour la diffusion e-learning (streaming rapide).
- **Tracking des Métadonnées** : Les fichiers ne doivent pas s'appeler "audio1.mp3". Une nomenclature stricte doit être en place (ex: `date_projetID_voixID.mp3`) et ces données (Voix ID, réglages de vitesse, stabilité, etc.) doivent être associées en base de données pour assurer une reproductibilité à 100%.

## 4. Modularité (Flexibilité de l'intégration)
> [!WARNING]
> **Le défi** : Le marché évolue. Il faut pouvoir passer au "prochain ElevenLabs" sans tout recoder.

**La solution recommandée** :
- **Architecture Agnostique ("Plug & Play")** : L'appel à l'IA vocale ne doit pas être codé "en dur" et éparpillé partout dans le code. 
- Il faut encapsuler cette fonctionnalité dans un **Service ou un Module isolé**. 
- Dès lors, le "fournisseur" d'IA vocale (ElevenLabs, Cartesia, OpenAI, etc.) n'est qu'un paramètre. Si un meilleur modèle sort dans 3 mois, l'équipe technique a uniquement ce module spécifique à mettre à jour (l'URL de l'API et la structure de la requête) sans toucher à la structure métier ni à la gestion du stockage.

## 5. Contrôle Fin du Rendu (SSML vs Texte Brut)
> [!TIP]
> **Le défi** : Le rendu pédagogique nécessite des respirations, des silences forcés et une maîtrise de la prosodie.

**La solution recommandée** :
- **Orientation prioritaire vers le SSML (Speech Synthesis Markup Language)** : Il faut retenir une intégration qui permet d'envoyer du SSML et pas seulement du texte "flat". 
- Cela autorise l'usage de balises clés : `<break time="2.0s" />` pour marquer une pause après une question, ou mettre l'accent sur des concepts importants. L'outil mis à la disposition des concepteurs pédagogiques doit pouvoir transcrire leurs directives (pauses, vitesse) en langage SSML pour l'API choisie.
