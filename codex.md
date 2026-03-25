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
- Un vrai role admin existe maintenant sur `User.isAdmin`.
- Les emails presents dans `ADMIN_EMAILS` sont promus admin automatiquement a l'inscription, au login, au callback Google et au rafraichissement de session (`auth/me`).
- Google OAuth:
  - `prompt=consent` a ete retire pour eviter de re-forcer le consentement/choix de compte.
  - le comportement Google reste depend de la session navigateur, donc un selecteur de compte peut toujours apparaitre.
  - le `state` OAuth Google n'est plus garde en memoire process ; il est maintenant porte par cookie `httpOnly` court terme
- Routes backend auth principales dans `server/src/routes/appRoutes.ts`.
- Hardening backend en cours:
  - `helmet` est actif
  - du rate limiting est pose sur auth, recherche joueur et sync
  - les erreurs 500 generiques sont masquees en production

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

## Streak quotidien

- La streak quotidienne est maintenant geree sur une fenetre glissante de 24h a partir de la derniere completion reussie.
- Le backend backfill automatiquement les completions manquantes a partir des tentatives correctes deja enregistrees sur les puzzles du daily.
- Le flux standard de tentative de puzzle credite maintenant aussi le daily challenge quand le joueur reussit effectivement le puzzle du jour.
- `getOverview()` retourne en plus `streakDeadlineAt` pour afficher l'echeance exacte de conservation de la streak.

## Migrations recentes

- migration a appliquer si besoin sur une nouvelle DB:
  - `20260325082310_riot_account_index`
  - `20260325151500_admin_backoffice_user_role`

## Backoffice admin

- Nouvelle route front: `/admin`
- Le backoffice a son propre layout et masque la navbar publique sur cette route.
- La session front recoit maintenant `user.isAdmin`.
- API admin dediee dans `server/src/routes/adminRoutes.ts`, protegee par `attachUser + requireAdmin`.
- Capacites actuelles:
  - vue d'ensemble admin
  - liste complete des champions
  - liste complete des items
  - liste complete des puzzles
  - edition rapide des metadonnees champion/item/puzzle
  - detail puzzle avec lecture des choix et du scenario
  - popup patch avec inventaire des champions/items hors patch cible
  - bouton de sync patch qui appelle `riotSyncService.syncAll()`
- Fichiers clefs:
  - `src/pages/Admin.tsx`
  - `src/api/hooks.ts`
  - `src/types/domain.ts`
  - `server/src/routes/adminRoutes.ts`
  - `server/src/services/adminService.ts`
  - `server/src/services/viewMappers.ts`
  - `server/src/middleware/authMiddleware.ts`

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
- pack `wshobson/agents` installe dans `.agents/skills`

## Audit en cours - constats structurants (2026-03-25)

- Securite:
  - les routes `POST /api/sync/champions`, `POST /api/sync/items` et `POST /api/sync/assets` sont maintenant protegees par `requireSyncAccess`
  - en dev local, le sync reste autorise depuis localhost
  - en production, il faut fournir `SYNC_ADMIN_TOKEN`
  - `.env.example` ne doit contenir que des placeholders, jamais des secrets reels
- Responsive / UX:
  - overflow horizontal corrige sur mobile pour la landing, l'auth et la page profil joueur
  - cibles tactiles critiques remontees a 44x44 min sur les ecrans audites
- Produit / SEO:
  - `index.html` et les titres de page ne doivent plus garder de metadonnees template
- Copywriting / i18n:
  - la dette de localisation reste importante
  - `src/pages/Results.tsx`, `src/pages/PlayerProfile.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Training.tsx` et `src/components/ItemIcon.tsx` ont ete refrancises sur les labels les plus visibles
  - les messages d'erreur backend publics principaux ont ete traduits dans `server/src/routes/appRoutes.ts`, `server/src/services/authService.ts`, `server/src/services/oauthService.ts` et `server/src/services/progressService.ts`
  - `src/i18n/translations/fr.ts` a ete nettoye partiellement, mais la dette i18n reste structurelle
  - `server/src/services/viewMappers.ts` normalise maintenant en francais les puzzles generes/deja stockes en base pour eviter que d'anciens contenus anglais remontent encore sur `daily` et `training`
  - plusieurs pages critiques contournent encore l'i18n et gardent du texte hardcode
  - il reste du vocabulaire produit semi-anglais a harmoniser (`dashboard`, `OTP`, `build`, etc.) selon une vraie charte lexicale
- UI training:
  - la zone `Lecture tactique` de `src/pages/Training.tsx` a ete recomposee avec cartes de details et retours a la ligne pour eviter les debordements de libelles/valeurs

## Regles de maintenance pour ce fichier

- Mettre a jour apres:
  - changement d'architecture
  - nouvelle route/backend critique
  - changement de logique auth
  - changement de logique Riot/search/autocomplete
  - ajout de migration importante
  - ajout de workflow ou commande recurrente
- Avant tout autocompact / compactage Codex, mettre a jour `codex.md` avec les informations produit ou techniques qui ne doivent pas etre oubliees.
- Garder le fichier court, pratique, et oriente execution.
