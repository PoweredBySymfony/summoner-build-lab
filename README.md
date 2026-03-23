# Summoner Build Lab

Application Vite/React + API Node/Express pour apprendre l'itemisation sur League of Legends via des puzzles pedagogiques. Le projet tourne maintenant avec PostgreSQL, Prisma, un seed metier LoL, et une couche Riot centralisee et securisee.

## Stack

- Frontend: Vite, React, TypeScript, React Query, shadcn/ui
- Backend: Node.js, Express, TypeScript
- ORM: Prisma
- Base de donnees: PostgreSQL
- Infra locale: Docker Compose

## Variables d'environnement

Copier `.env.example` vers `.env`, puis renseigner les valeurs.

Variables attendues:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `RIOT_API_KEY`
- `RIOT_REGION`
- `RIOT_PLATFORM`
- `PORT`
- `CLIENT_URL`
- `DEMO_USER_USERNAME`

Important:

- ne jamais hardcoder la cle Riot
- toute lecture se fait via `RIOT_API_KEY`
- la cle n'est pas loggee

## Demarrage rapide

1. Installer les dependances:

```bash
npm install
```

2. Lancer PostgreSQL:

```bash
docker compose up -d
```

3. Generer Prisma, migrer et seeder:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

4. Lancer le projet en dev:

```bash
npm run dev
```

Frontend:

- `http://localhost:8080`

API:

- `http://localhost:3001/api`

PostgreSQL local:

- host `localhost`
- port `5433`

## Scripts utiles

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
npm run db:up
npm run db:down
```

## Ce qui fonctionne deja

- base PostgreSQL dockerisee avec volume persistant et healthcheck
- schema Prisma metier pour users, champions, items, puzzles, tags, attempts et relations d'items
- migration initiale Prisma
- seed metier avec 19 champions, 37 items, 11 puzzles realistes
- API Express pour `bootstrap`, `modules`, `puzzles`, `dashboard`, `profile`
- persistance d'une tentative via `POST /api/puzzles/:slug/attempts`
- frontend branche sur les vraies donnees Prisma via l'API
- liste de puzzles, detail puzzle, validation de reponse et feedback pedagogique
- client Riot centralise dans `server/src/lib/riot/riotApiClient.ts`

## Riot API

Toute integration Riot passe par:

- `server/src/lib/riot/riotApiClient.ts`
- `server/src/services/riotSyncService.ts`

Gestion prevue:

- header `X-Riot-Token`
- timeouts
- erreurs `401`, `403`, `404`, `429`
- base pour sync account/matches plus tard

Tant que `RIOT_API_KEY` est vide, les endpoints Riot renverront une erreur propre au lieu de casser l'application.

## Structure

```text
prisma/
  schema.prisma
  seed.ts
server/
  src/
    config/
    lib/
    repositories/
    routes/
    services/
src/
  api/
  components/
  pages/
  types/
```

## Verification effectuee

- `npx prisma validate`
- `npm run prisma:migrate -- --name init`
- `npm run prisma:seed`
- `npm run build`
- smoke tests API sur:
  - `GET /api/bootstrap`
  - `GET /api/puzzles`
  - `GET /api/puzzles/:slug`
  - `POST /api/puzzles/:slug/attempts`

## Notes

- le port PostgreSQL expose est `5433` car `5432` etait deja occupe sur la machine
- le frontend build actuellement avec un warning de chunk Vite > 500 kB, sans bloquer le projet
