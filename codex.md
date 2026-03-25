# Codex Project Memory

Lire ce fichier au debut de chaque nouvelle conversation sur ce repo, puis le mettre a jour quand un changement important modifie le comportement produit, l'architecture ou les workflows.

## Produit

- Projet: `summoner-build-lab`
- Objet: plateforme de puzzles et d'analyse autour de l'itemisation League of Legends
- UX actuelle:
  - landing page
  - auth Google + email
  - dashboard
  - recherche de profil joueur Riot
  - page profil joueur
  - generation de serie depuis une game importee

## Stack

- Frontend: Vite + React + TypeScript + React Query + Tailwind + shadcn/ui
- Backend: Express + TypeScript
- DB: PostgreSQL + Prisma
- Data jeu: Riot API + Data Dragon

## Commandes utiles

- dev complet: `npm run dev`
- build complet: `npm run build`
- tests: `npm run test`
- regeneration Prisma: `npm run prisma:generate`
- migration locale: `npx prisma migrate dev`
- sync donnees Riot/Data Dragon:
  - `npm run sync:champions`
  - `npm run sync:items`
  - `npm run sync:assets`

## Auth

- La page d'auth est branchee a l'i18n dans `src/pages/Auth.tsx`.
- Google OAuth:
  - `prompt=consent` a ete retire pour eviter de re-forcer le consentement/choix de compte.
  - le comportement Google reste depend de la session navigateur, donc un selecteur de compte peut toujours apparaitre.
- Routes backend auth principales dans `server/src/routes/appRoutes.ts`.

## Recherche Riot

- Le composant principal est `src/components/RiotIdSearch.tsx`.
- Le dropdown d'autocomplete est rendu via portal dans `document.body`.
- UX actuelle:
  - focus champ vide: dernieres recherches locales
  - pendant la saisie: suggestions distantes de comptes connus
  - si la saisie ressemble deja a un Riot ID complet: suggestion "recherche exacte"
- Le panneau est maintenant contraint au viewport:
  - largeur clamp
  - hauteur max dynamique
  - bascule au-dessus du champ si manque de place dessous

## Logique Riot globale

- La resolution exacte d'un profil n'est plus limitee a `RIOT_REGION=europe` / `RIOT_PLATFORM=euw1`.
- Le backend cherche d'abord le compte Riot sur les clusters:
  - `americas`
  - `asia`
  - `europe`
  - `sea`
- Puis il detecte la bonne plateforme LoL:
  - `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `na1`, `oc1`, `ru`, `tr1`, `ph2`, `sg2`, `th2`, `tw2`, `vn2`
- Fichiers centraux:
  - `server/src/lib/riot/routing.ts`
  - `server/src/lib/riot/riotApiClient.ts`
  - `server/src/services/riotSyncService.ts`

## Index de comptes connus

- Table Prisma: `RiotAccountIndex`
- Raison:
  - Riot ne fournit pas d'autocomplete globale publique par texte partiel pour les Riot IDs
  - les suggestions distantes reposent donc sur notre propre index
- Sources d'indexation:
  - ouverture d'un profil exact
  - participants rencontres dans les matchs recuperes
- Proprietes importantes:
  - les comptes indexes viennent des reponses Riot, pas d'invention locale
  - l'index n'est pas exhaustif
  - un compte peut exister chez Riot sans etre encore present dans nos suggestions

## Bug important deja corrige

- Bug constate:
  - `POST /api/riot/import-matches` pouvait echouer avec `Unable to determine Riot region for this player`
- Cause:
  - l'indexation des participants de match ecrasait parfois `platform` et `region` par `null` pour un `puuid` deja connu
- Correctif:
  - `upsertIndexedAccount()` preserve maintenant les valeurs existantes si le nouvel update ne fournit pas mieux
  - `importRecentMatches()` rehydrate aussi la region/plateforme via `resolveLeagueIdentity()` si l'index est incomplet

## Migrations recentes

- migration a appliquer si besoin sur une nouvelle DB:
  - `20260325082310_riot_account_index`

## Fichiers sensibles a relire avant modifs

- `src/components/RiotIdSearch.tsx`
- `src/pages/PlayerProfile.tsx`
- `src/api/hooks.ts`
- `server/src/routes/appRoutes.ts`
- `server/src/services/riotSyncService.ts`
- `server/src/lib/riot/riotApiClient.ts`
- `prisma/schema.prisma`

## Skills installes localement

- `audit`
- `frontend-design`
- `ui-ux-pro-max`
- `playwright-skill`
- `anthropic-frontend-design`

## Audit en cours - constats structurants (2026-03-25)

- Securite:
  - les routes `POST /api/sync/champions`, `POST /api/sync/items` et `POST /api/sync/assets` sont publiques actuellement
  - `.env.example` contient encore des credentials Riot/Google reels ou realistes a retirer/rotater
  - le serveur Express n'a pas encore de `helmet`, ni de rate limiting, et renvoie encore certains messages d'erreur bruts
- Responsive / UX:
  - overflow horizontal confirme sur mobile pour la landing et la page profil joueur
  - plusieurs cibles tactiles critiques restent sous 44x44, surtout dans la navbar et les portraits de champions
- Produit / SEO:
  - `index.html` garde encore les metadonnees par defaut `Lovable App`

## Regles de maintenance pour ce fichier

- Mettre a jour apres:
  - changement d'architecture
  - nouvelle route/backend critique
  - changement de logique auth
  - changement de logique Riot/search/autocomplete
  - ajout de migration importante
  - ajout de workflow ou commande recurrente
- Garder le fichier court, pratique, et oriente execution.
