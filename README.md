# Summoner Build Lab

Plateforme Vite/React + API Express/Prisma pour apprendre l'itemisation League of Legends via des puzzles interactifs. Cette version ajoute une vraie base produit: PostgreSQL, synchronisation complète champions/items depuis Data Dragon, auth, progression persistée, mode OTP, défi quotidien, génération de puzzles et socle d'emails.

## Stack

- Frontend: Vite, React, TypeScript, React Query, shadcn/ui
- Backend: Express, TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Infra locale: Docker Compose
- Sources LoL:
  - Data Dragon pour tous les champions, tous les items et les assets
  - Riot API pour les profils/matchs utilisateurs

## Fonctionnalités déjà branchées

- Synchronisation relançable de tous les champions et tous les items du patch Data Dragon courant
- URLs d'assets champions/items centralisées et refresh des images manquantes
- Schéma Prisma étendu:
  - `User`, `AuthProviderAccount`
  - `Champion`, `Item`
  - `Puzzle`, `PuzzleChoice`, `PuzzleScenario`, `PuzzleTag`
  - `PuzzleAttempt`, `UserGlobalProgress`, `UserChampionProgress`
  - `DailyChallenge`, `DailyChallengeCompletion`
  - `PlayerProfile`, `ImportedMatch`, `GeneratedPuzzleRequest`
  - `EmailReminderPreference`
- Auth email/mot de passe avec hash bcrypt
- Session persistante par cookie HTTP-only signé
- Google OAuth préparé et branché côté backend
- Riot OAuth scaffoldé côté backend, activable quand les endpoints/credentials sont disponibles
- Sauvegarde des tentatives et calcul de progression globale/champion
- Défi quotidien avec streak
- Seed enrichi:
  - sync catalogue complète
  - puzzles manuels
  - génération OTP d'un puzzle par champion importé
- Frontend:
  - landing orientée produit
  - dashboard de progression
  - mode général
  - mode OTP par champion
  - page auth
  - page daily challenge
  - puzzle view avec contexte de game, équipes et items ennemis
- Job de rappel email prêt pour cron

## Variables d'environnement

Copier `.env.example` vers `.env`.

Minimum recommandé:

```env
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
DATABASE_URL=

PORT=3001
CLIENT_URL=http://localhost:8080
APP_URL=http://localhost:8080
AUTH_SECRET=
SESSION_COOKIE_NAME=summoner_build_lab_session

RIOT_API_KEY=
RIOT_REGION=europe
RIOT_PLATFORM=euw1

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

RIOT_OAUTH_CLIENT_ID=
RIOT_OAUTH_CLIENT_SECRET=
RIOT_OAUTH_AUTHORIZE_URL=
RIOT_OAUTH_TOKEN_URL=
RIOT_OAUTH_USERINFO_URL=
RIOT_OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/riot/callback

EMAIL_PROVIDER_API_KEY=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
```

Règles:

- ne jamais hardcoder la clé Riot
- tout secret passe par `process.env`
- aucune clé n'est loggée

## Démarrage

1. Installer les dépendances

```bash
npm install
```

2. Démarrer PostgreSQL

```bash
npm run db:up
```

3. Générer Prisma puis appliquer la migration

```bash
npm run prisma:generate
npm run prisma:migrate -- --name platform_rebuild
```

4. Synchroniser le catalogue Riot/Data Dragon si besoin

```bash
npm run sync:all
```

5. Seeder la base

```bash
npm run prisma:seed
```

6. Lancer l'app

```bash
npm run dev
```

Endpoints locaux:

- Frontend: `http://localhost:8080`
- API: `http://localhost:3001/api`
- PostgreSQL: `localhost:5433`

## Scripts utiles

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run build

npm run db:up
npm run db:down

npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed

npm run sync:champions
npm run sync:items
npm run sync:assets
npm run sync:all
npm run audit:static-data

npm run jobs:daily-reminders
```

## Audit statique avant retrain / release

Commande:

```bash
npm run audit:static-data
```

Sorties:

- `reports/static-data-audit/latest.json`
- `reports/static-data-audit/latest.md`

Le script audite:

- les items synchronises:
  - coherence `item.stats` vs rendu UI parse
  - labels dupliques
  - stats manquantes
  - anomalies de parsing
  - incoherences de patch
- les champions synchronises:
  - champs obligatoires
  - types numeriques dans `stats`
  - nulls
  - coherence patch

Regle pratique:

- lancer cet audit avant un retrain ML
- lancer cet audit avant une release
- traiter les anomalies `error` avant de considerer le catalogue comme fiable

## Flux de données LoL

Catalogue:

- `server/src/lib/gameData/dataDragonClient.ts`
- `server/src/services/riotSyncService.ts`
- `scripts/syncChampions.ts`
- `scripts/syncItems.ts`
- `scripts/syncAssets.ts`
- `scripts/syncAllGameData.ts`

Le catalogue:

- prend le patch Data Dragon le plus récent
- upsert tous les champions
- upsert tous les items
- reconstruit les URLs d'images champions/items
- permet de relancer la sync sans casser la cohérence

Riot joueur/match:

- `server/src/lib/riot/riotApiClient.ts`
- `server/src/services/riotSyncService.ts`

Prévu/branché:

- récupération de compte Riot
- import de matchs par `puuid`
- stockage brut du match en base pour génération future de puzzles personnalisés

## Auth

Email/password:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

OAuth:

- Google prêt si `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REDIRECT_URI` sont configurés
- Riot OAuth scaffoldé mais dépend d'une config réelle/approbation côté Riot

## Daily challenge et emails

Défi du jour:

- généré/résolu via `server/src/services/dailyChallengeService.ts`
- streak persistée dans `UserGlobalProgress`

Emails:

- `server/src/services/emailService.ts`
- `scripts/sendDailyReminders.ts`

Pour un vrai envoi planifié:

- brancher SMTP ou votre provider
- exécuter `npm run jobs:daily-reminders` via cron/GitHub Actions/worker planifié

## Seed

Le seed:

- synchronise le catalogue complet
- crée un compte dev
- ajoute des puzzles manuels riches
- génère ensuite un puzzle OTP par champion importé
- crée des tentatives et un daily challenge de démonstration

Compte dev seedé:

- email: `demo@summonerbuildlab.dev`
- mot de passe: `Password123!`

À utiliser uniquement en local.

## Vérifications réalisées

- `npx prisma validate`
- `npm run prisma:generate`
- `npm run build`

## Limites restantes

- Riot OAuth dépend d'une configuration réelle côté Riot, donc le flux backend est préparé mais pas testable sans credentials/endpoints valides
- Les rappels email utilisent un transport JSON fallback tant que SMTP/provider n'est pas configuré
- La génération personnalisée par historique de matchs utilise aujourd'hui un fallback déterministe; le socle est prêt pour être enrichi par IA plus tard
- Le bundle frontend dépasse encore l'avertissement Vite de 500 kB
