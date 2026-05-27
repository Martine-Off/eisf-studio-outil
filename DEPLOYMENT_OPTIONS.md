# DEPLOYMENT_OPTIONS.md — EISF Studio

> Document rédigé le 2026-05-26  
> Auteur : Martine Desmaroux — martine.desmaroux@gmail.com  
> Portée : déploiement du serveur EISF Studio + stockage des fichiers audio

---

## Sommaire

1. [Architecture cible](#1-architecture-cible)
2. [Option A — VPS dédié (recommandée)](#2-option-a--vps-dédié-recommandée)
3. [Option B — Hébergement Docker Compose](#3-option-b--hébergement-docker-compose)
4. [Option C — PaaS managé (Render / Railway)](#4-option-c--paas-managé-render--railway)
5. [Stockage des fichiers audio](#5-stockage-des-fichiers-audio)
6. [Base de données PostgreSQL](#6-base-de-données-postgresql)
7. [Variables d'environnement de production](#7-variables-denvironnement-de-production)
8. [Checklist de mise en production](#8-checklist-de-mise-en-production)

---

## 1. Architecture cible

```
Internet
    │
    ▼
[ Nginx — reverse proxy + TLS ]
    │
    ├─────────────────────────┐
    ▼                         ▼
[ Node.js / Express :3001 ] [ React build (servi statiquement) ]
    │
    ├──► PostgreSQL :5432
    ├──► Make Webhooks (externe)
    ├──► Gemini TTS API (externe)
    └──► Stockage fichiers audio (local ou objet cloud)
```

Le frontend React est compilé (`npm run build`) et servi statiquement par Nginx.  
L'API Express tourne en arrière-plan géré par PM2.

---

## 2. Option A — VPS dédié (recommandée)

**Pourquoi :** contrôle total, conformité RGPD plus facile, coût maîtrisé, données hébergées en France.

### Prérequis matériels minimaux

| Ressource | Développement | Production |
|-----------|--------------|------------|
| CPU       | 1 vCore      | 2 vCores   |
| RAM       | 2 Go         | 4 Go       |
| Disque    | 20 Go SSD    | 40 Go SSD + stockage audio séparé |
| OS        | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Fournisseurs recommandés (hébergement en France)

| Fournisseur | Offre exemple | Prix/mois | Datacenter FR | RGPD |
|-------------|--------------|-----------|---------------|------|
| **OVH VPS** | VPS Value 4 Go | ~6 € | Gravelines / Roubaix | Oui |
| **Scaleway** | DEV1-S (2 vCPU, 2 Go) | ~8 € | Paris | Oui |
| **Hetzner** | CX22 (2 vCPU, 4 Go) | ~4 € | Nuremberg (DE) | Oui |
| **Infomaniak** | VPS-1 | ~6 € | Genève (CH) | Oui |

> Recommandation EISF : **OVH Gravelines** pour souveraineté des données en France.

### Installation sur Ubuntu 22.04

```bash
# 1. Mise à jour système
sudo apt update && sudo apt upgrade -y

# 2. Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. PM2 — gestionnaire de processus
sudo npm install -g pm2

# 4. PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql

# 5. Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# 6. Certbot (TLS Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d studio.eisf.fr
```

### Configuration PM2

```bash
# Dans le répertoire server/
pm2 start server.js --name eisf-studio --max-memory-restart 400M
pm2 save
pm2 startup   # configure le démarrage automatique
```

Fichier `ecosystem.config.js` recommandé :
```javascript
module.exports = {
  apps: [{
    name: 'eisf-studio',
    script: 'server.js',
    cwd: '/var/www/eisf-studio/server',
    instances: 1,
    autorestart: true,
    max_memory_restart: '400M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### Configuration Nginx

```nginx
# /etc/nginx/sites-available/eisf-studio
server {
    listen 80;
    server_name studio.eisf.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name studio.eisf.fr;

    ssl_certificate     /etc/letsencrypt/live/studio.eisf.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/studio.eisf.fr/privkey.pem;

    # Sécurité TLS
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend React (build statique)
    root /var/www/eisf-studio/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 30M;
        proxy_read_timeout 180s;  # pour les générations longues
    }

    # Fichiers audio uploadés (si stockage local)
    location /uploads/ {
        alias /var/www/eisf-studio/server/uploads/;
        internal;  # accessible uniquement via proxy auth (voir V3)
    }
}
```

---

## 3. Option B — Hébergement Docker Compose

**Pourquoi :** reproductibilité, isolation, déploiement simplifié, idéal si l'équipe EISF utilise déjà Docker.

### Structure `docker-compose.yml`

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: eisf_studio
      POSTGRES_USER: eisf
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    networks:
      - internal

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - db
    env_file: .env
    ports:
      - "127.0.0.1:3001:3001"
    volumes:
      - uploads:/app/uploads
    networks:
      - internal
      - public

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./client/dist:/usr/share/nginx/html:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
    networks:
      - public

volumes:
  pgdata:
  uploads:
  certbot_www:
  certbot_conf:

networks:
  internal:
  public:
```

### Dockerfile serveur

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
USER node
CMD ["node", "server.js"]
```

---

## 4. Option C — PaaS managé (Render / Railway)

**Pourquoi :** zéro administration serveur, déploiement depuis Git. Moins adapté pour RGPD strict si données hébergées hors UE.

| Service     | Free tier | PostgreSQL inclus | Région EU | RGPD facile |
|-------------|-----------|-------------------|-----------|-------------|
| **Render**  | Oui (lent) | Oui (géré)       | Frankfurt | Partiellement |
| **Railway** | Oui       | Oui (géré)        | Non (US)  | Difficile   |
| **Fly.io**  | Non       | Oui (géré)        | Paris     | Oui         |

> Non recommandé pour EISF en production si les cours contiennent des contenus pédagogiques confidentiels.

---

## 5. Stockage des fichiers audio

Les podcasts générés par Gemini TTS peuvent représenter plusieurs centaines de Mo par cours (fichiers `.mp3` ou `.wav`).

### Option 5-A — Disque local (simple, recommandé en démarrage)

**Avantages :** zéro coût, zéro dépendance externe, performances maximales en lecture.  
**Inconvénients :** limité à la capacité du VPS, pas de CDN, backups manuels.

```
/var/www/eisf-studio/server/audio/
    └── {userId}/
        └── {podcastId}/
            └── {dialogueId}.mp3
```

```javascript
// server/utils/audioStorage.js
const AUDIO_DIR = process.env.AUDIO_DIR || path.join(__dirname, '..', 'audio');
// Nom de fichier non-devinable
const filename = `${crypto.randomBytes(16).toString('hex')}.mp3`;
```

**Backup recommandé :** `rsync` quotidien vers un second VPS ou OVH Object Storage.

---

### Option 5-B — OVH Object Storage (recommandée pour la production)

**Pourquoi EISF :** hébergement en France (Gravelines), compatible RGPD, API S3-compatible, tarif prévisible.

| Paramètre      | Valeur OVH Public Cloud Storage |
|----------------|--------------------------------|
| Région         | GRA (Gravelines, France)       |
| Prix stockage  | ~0,01 €/Go/mois               |
| Prix sortie    | ~0,01 €/Go                    |
| API compatible | S3 (AWS SDK fonctionne)        |
| SLA            | 99,9 %                        |

```bash
npm install @aws-sdk/client-s3
```

```javascript
// server/utils/audioS3.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.S3_REGION,           // ex: 'gra'
  endpoint: process.env.S3_ENDPOINT,       // ex: 'https://s3.gra.io.cloud.ovh.net'
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

async function uploadAudio(buffer, key) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,           // ex: 'audio/userId/podcastId/dialogueId.mp3'
    Body: buffer,
    ContentType: 'audio/mpeg',
  }));
}

async function getAudioStream(key) {
  const { Body } = await s3.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  }));
  return Body; // stream — pipe vers res
}
```

---

### Option 5-C — Cloudflare R2

**Avantages :** aucun coût de sortie (egress gratuit), CDN mondial intégré.  
**Inconvénients :** données sur infrastructure Cloudflare (hors EU en partie), RGPD à évaluer.

| Paramètre      | Cloudflare R2     |
|----------------|-------------------|
| Prix stockage  | ~0,015 $/Go/mois  |
| Prix sortie    | **Gratuit**       |
| API compatible | S3                |
| CDN intégré    | Oui               |

Même client `@aws-sdk/client-s3` que pour OVH, seul l'endpoint change :
```
endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`
```

---

### Option 5-D — MinIO auto-hébergé

**Avantages :** souveraineté totale, pas de dépendance externe, API S3 complète.  
**Inconvénients :** maintenance à la charge de l'équipe EISF.

```bash
# Sur le VPS, via Docker
docker run -d \
  -p 9000:9000 -p 9001:9001 \
  -v /data/minio:/data \
  -e MINIO_ROOT_USER=eisf_admin \
  -e MINIO_ROOT_PASSWORD=${MINIO_PASSWORD} \
  quay.io/minio/minio server /data --console-address ":9001"
```

---

### Comparaison stockage audio

| Critère              | Local disk | OVH Object Storage | Cloudflare R2 | MinIO auto-hébergé |
|----------------------|------------|-------------------|---------------|-------------------|
| Coût mensuel (50 Go) | 0 €        | ~0,50 €           | ~0,75 $       | 0 € + serveur     |
| Coût sortie          | 0 €        | ~0,50 €/50 Go     | **Gratuit**   | 0 €               |
| RGPD France          | Oui        | **Oui (Gravelines)** | Partiel    | Oui               |
| CDN                  | Non        | Non               | **Oui**       | Non               |
| Maintenabilité       | Simple     | **Simple**        | Simple        | Complexe          |
| Scalabilité          | Limitée    | Illimitée         | Illimitée     | Illimitée         |
| **Recommandation**   |            | **Production EISF** |             | Avancé            |

---

## 6. Base de données PostgreSQL

### En production (Option A — VPS)

```bash
# Créer la base et l'utilisateur
sudo -u postgres psql
CREATE DATABASE eisf_studio;
CREATE USER eisf_app WITH PASSWORD 'mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE eisf_studio TO eisf_app;
\q

# Appliquer le schéma
psql -U eisf_app -d eisf_studio -f server/db/schema.sql
```

Variables d'environnement PostgreSQL de production :
```env
DATABASE_URL=postgresql://eisf_app:mot_de_passe_fort@localhost:5432/eisf_studio?sslmode=disable
```

### Backups PostgreSQL automatiques

```bash
# Crontab — backup quotidien à 3 h
0 3 * * * pg_dump -U eisf_app eisf_studio | gzip > /backups/eisf_studio_$(date +%Y%m%d).sql.gz
# Garder 30 jours
find /backups/ -name "*.sql.gz" -mtime +30 -delete
```

### PostgreSQL managé (alternative)

| Fournisseur | Région FR | Prix/mois | RGPD |
|-------------|-----------|-----------|------|
| **Supabase** | Frankfurt | Gratuit / 25 $/mois | Partiellement |
| **Neon**     | Frankfurt | Gratuit / 19 $/mois | Partiellement |
| **OVH CloudDB** | France | ~6 $/mois | Oui |
| **Scaleway Managed PG** | Paris | ~11 $/mois | Oui |

---

## 7. Variables d'environnement de production

Fichier `.env` à créer sur le serveur (ne jamais commiter) :

```env
# === Général ===
NODE_ENV=production
PORT=3001

# === Authentification ===
JWT_SECRET=<chaine_aleatoire_min_64_chars>
JWT_REFRESH_SECRET=<autre_chaine_aleatoire_min_64_chars>

# === Base de données ===
DATABASE_URL=postgresql://eisf_app:<password>@localhost:5432/eisf_studio

# === IA — Make Webhooks ===
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/<votre_cle>

# === IA — Google Gemini TTS ===
GEMINI_API_KEY=<votre_cle_api>

# === CORS — origines autorisées ===
ALLOWED_ORIGINS=https://studio.eisf.fr

# === Stockage audio (si OVH S3) ===
S3_ENDPOINT=https://s3.gra.io.cloud.ovh.net
S3_REGION=gra
S3_BUCKET=eisf-audio
S3_ACCESS_KEY=<cle_acces>
S3_SECRET_KEY=<cle_secrete>

# === Logs ===
LOG_LEVEL=warn
```

Générer un secret JWT fort :
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 8. Checklist de mise en production

### Infrastructure
- [ ] VPS Ubuntu 22.04 provisionné (OVH Gravelines recommandé)
- [ ] Nom de domaine DNS `studio.eisf.fr` pointant vers l'IP du VPS
- [ ] Certificat TLS Let's Encrypt généré et renouvelé automatiquement
- [ ] Nginx configuré avec proxy vers :3001 et HSTS activé
- [ ] Pare-feu UFW : ports 22, 80, 443 uniquement

### Application
- [ ] Variables d'environnement `.env` production configurées
- [ ] `npm ci --only=production` sur le serveur
- [ ] `npm run build` exécuté côté client, dist copié dans `/var/www/`
- [ ] Schéma PostgreSQL appliqué
- [ ] PM2 démarré avec `ecosystem.config.js`
- [ ] PM2 startup configuré (survie aux redémarrages)

### Sécurité (priorité avant ouverture)
- [ ] V8 corrigé : `authMiddleware` sur les routes export
- [ ] V6 corrigé : URL webhook retirée des logs
- [ ] V7 corrigé : vérification propriété dialogues `/reorder`
- [ ] Fichier `.env` non accessible publiquement (`chmod 600`)
- [ ] Répertoire `uploads/` non servi publiquement sans authentification

### Stockage audio
- [ ] Stratégie choisie (local / OVH S3 / R2)
- [ ] Bucket S3 créé avec politique d'accès privée
- [ ] Variables `S3_*` configurées
- [ ] Tests d'upload et de lecture audio validés

### Sauvegardes
- [ ] Cron backup PostgreSQL quotidien configuré
- [ ] Backup audio configuré (rsync ou lifecycle S3)
- [ ] Restauration testée au moins une fois

---

*Document à mettre à jour lors de chaque changement d'infrastructure significatif.*
