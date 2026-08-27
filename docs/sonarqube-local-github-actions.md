# Installer SonarQube local avec GitHub Actions Docker

Ce guide explique comment mettre en place, depuis zero, une analyse SonarQube locale pour le repo `PoweredBySymfony/summoner-build-lab`.

Le resultat attendu:

- SonarQube Community Build tourne en Docker sur `http://localhost:9000`.
- GitHub Actions lance la CI sur un runner self-hosted Docker local.
- Les branches feature executent lint, tests avec coverage et build.
- La branche `main` execute lint, tests, build, puis publie l'analyse dans SonarQube.
- SonarQube for IDE dans VS Code est connecte au SonarQube local.

![Architecture SonarQube local](assets/sonarqube-local-architecture.svg)

## 1. Prerequis

Installer et demarrer:

- Docker Desktop
- Git
- Node.js compatible avec le projet
- Un acces owner/admin a l'organisation GitHub `PoweredBySymfony`
- Un acces admin a SonarQube local

Verifier que Docker repond:

```powershell
docker info
```

Si Docker repond:

```text
failed to connect to dockerDesktopLinuxEngine
```

demarrer Docker Desktop, puis relancer:

```powershell
docker info
```

## 2. Installer SonarQube dans Docker

Ne pas utiliser le tag generique `sonarqube:lts-community` sans verification. Lors de l'installation, ce tag pointait vers une ancienne version `9.9.8`.

Utiliser le tag explicite LTA Community Build:

```text
sonarqube:26.1.0.118079-community
```

Creer les volumes persistants:

```powershell
docker volume create sonarqube_lta_data
docker volume create sonarqube_lta_extensions
docker volume create sonarqube_lta_logs
```

Telecharger l'image:

```powershell
docker pull sonarqube:26.1.0.118079-community
```

Lancer SonarQube:

```powershell
docker run -d `
  --name sonarqube `
  -p 9000:9000 `
  -v sonarqube_lta_data:/opt/sonarqube/data `
  -v sonarqube_lta_extensions:/opt/sonarqube/extensions `
  -v sonarqube_lta_logs:/opt/sonarqube/logs `
  sonarqube:26.1.0.118079-community
```

Verifier le statut:

```powershell
Invoke-WebRequest -Uri "http://localhost:9000/api/system/status" -UseBasicParsing
```

Attendre que le statut soit:

```json
{"status":"UP"}
```

Acceder ensuite a:

```text
http://localhost:9000
```

Identifiants par defaut:

```text
admin / admin
```

Changer le mot de passe quand SonarQube le demande.

## 3. Creer le projet SonarQube

Dans SonarQube:

```text
Create project > From GitHub
```

Importer le repo:

```text
PoweredBySymfony/summoner-build-lab
```

Quand SonarQube demande la definition du New Code, choisir:

```text
Follows the instance's default
```

Puis cliquer:

```text
Create project
```

La project key finale doit etre:

```text
summoner-build-lab
```

Cette key doit correspondre au fichier `sonar-project.properties`.

## 4. Configurer la GitHub App pour l'import GitHub

Dans GitHub, la GitHub App peut appartenir a l'organisation:

```text
PoweredBySymfony
```

Cela ne change pas l'URL API GitHub. Comme ce n'est pas GitHub Enterprise, garder:

```text
https://api.github.com/
```

Ne pas mettre l'organisation dans l'URL API.

### Callback URLs

Utiliser la meme URL partout selon la facon dont SonarQube est ouvert.

Si SonarQube est ouvert avec:

```text
http://localhost:9000
```

mettre dans la GitHub App:

```text
http://localhost:9000/oauth2/callback/github
http://localhost:9000/projects/create
```

Si SonarQube est ouvert avec:

```text
http://10.10.0.53:9000
```

mettre:

```text
http://10.10.0.53:9000/oauth2/callback/github
http://10.10.0.53:9000/projects/create
```

Ne pas melanger `localhost`, `127.0.0.1` et `10.10.0.53`.

### Erreur redirect_uri

Erreur rencontree:

```text
The redirect_uri is not associated with this application
```

Cause:

GitHub compare strictement l'URL, y compris les query params.

Exemple d'URL envoyee:

```text
http://localhost:9000/projects/create?mode=github&dopSetting=...
```

Solution:

Ajouter exactement l'URL complete envoyee par SonarQube dans les Callback URLs de la GitHub App.

### Webhook

Pour une instance SonarQube locale, laisser:

```text
Webhook: disabled
Webhook Secret: empty
```

Pourquoi:

GitHub ne peut pas appeler `localhost` ou une IP locale comme `10.10.0.53` depuis Internet.

## 5. Creer le token SonarQube pour GitHub Actions

Dans SonarQube:

```text
My Account > Security
```

Creer un token:

```text
Name: docker
Type: User
```

Copier le token. Il doit ressembler a:

```text
squ_...
```

Ne pas utiliser ce token dans le depot. Ne pas le mettre dans un fichier.

## 6. Creer les secrets GitHub

Dans GitHub:

```text
PoweredBySymfony/summoner-build-lab
Settings > Secrets and variables > Actions
```

Creer ou mettre a jour:

```text
SONAR_TOKEN
SONAR_HOST_URL
```

Valeur de `SONAR_TOKEN`:

```text
le token User SonarQube cree a l'etape precedente
```

Important:

- Coller le token sur une seule ligne.
- Ne pas ajouter de guillemets.
- Ne pas ajouter d'espace.
- Ne pas ajouter de retour a la ligne.

Valeur de `SONAR_HOST_URL`:

```text
http://host.docker.internal:9000
```

Ne pas mettre:

```text
http://localhost:9000
```

dans GitHub Secrets, car le workflow tourne dans le conteneur runner Docker. Dans ce conteneur, `localhost` designerait le conteneur lui-meme, pas SonarQube.

## 7. Ajouter la configuration SonarQube au repo

Fichier:

```text
sonar-project.properties
```

Contenu:

```properties
sonar.projectKey=summoner-build-lab

sonar.sourceEncoding=UTF-8

sonar.sources=api,ml,prisma,scripts,server,src,vite.config.ts,vitest.config.ts,playwright.config.ts,prisma.config.ts
sonar.tests=ml/tests,src/test,e2e

sonar.exclusions=**/node_modules/**,**/dist/**,**/dist-server/**,**/coverage/**,**/.venv/**,**/.mypy_cache/**,**/.pytest_cache/**,**/.ruff_cache/**,**/__pycache__/**,**/*.pyc,ml/artifacts/**,ml/data/raw/**,ml/data/interim/**,ml/data/processed/**,data/runtime/**
sonar.test.inclusions=ml/tests/**/*.py,src/test/**/*.ts,src/test/**/*.tsx,e2e/**/*.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverage.exclusions=**/*.config.*,**/*.d.ts,**/test/**,**/tests/**,**/components/ui/**,prisma/migrations/**,scripts/**
```

Point critique:

```properties
sonar.projectKey=summoner-build-lab
```

doit correspondre exactement a la key du projet SonarQube.

Erreur rencontree:

```properties
sonar.projectKey=PoweredBySymfony_summoner-build-lab
```

Cette key ne correspondait pas au projet local et a provoque une erreur d'autorisation.

## 8. Ajouter la coverage Vitest

Installer le provider coverage:

```powershell
npm install --save-dev @vitest/coverage-v8
```

Ajouter le script dans `package.json`:

```json
"test:coverage": "vitest run --coverage"
```

Configurer `vitest.config.ts`:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  reportsDirectory: "./coverage",
  include: ["src/**/*.{ts,tsx}", "server/src/**/*.ts"],
  exclude: [
    "src/test/**",
    "src/**/*.d.ts",
    "src/main.tsx",
    "src/vite-env.d.ts",
    "src/components/ui/**",
    "server/src/types/**",
  ],
}
```

Verifier localement:

```powershell
npm run test:coverage
```

Le fichier attendu pour SonarQube:

```text
coverage/lcov.info
```

## 9. Ajouter le runner GitHub Actions Docker

Ajouter ces fichiers:

```text
.github/runner/Dockerfile
.github/runner/entrypoint.sh
docker-compose.github-runner.yml
```

Le runner doit:

- telecharger GitHub Actions Runner Linux x64;
- avoir Docker CLI;
- monter `/var/run/docker.sock`;
- persister `/home/runner/actions-runner`;
- appliquer les permissions sur `_work` et `_tool`;
- avoir le label `local-sonarqube`.

Le fichier `docker-compose.github-runner.yml` doit contenir:

```yaml
services:
  github-runner:
    build:
      context: ./.github/runner
      args:
        RUNNER_VERSION: 2.334.0
    container_name: summoner-build-lab-github-runner
    restart: unless-stopped
    environment:
      RUNNER_URL: ${GITHUB_RUNNER_URL:-https://github.com/PoweredBySymfony}
      RUNNER_TOKEN: ${GITHUB_RUNNER_TOKEN}
      RUNNER_NAME: ${GITHUB_RUNNER_NAME:-summoner-build-lab-docker}
      RUNNER_LABELS: self-hosted,linux,x64,local-sonarqube
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - github-runner-data:/home/runner/actions-runner

volumes:
  github-runner-data:
```

## 10. Enregistrer le runner dans GitHub

Dans GitHub:

```text
PoweredBySymfony > Settings > Actions > Runners > New runner
```

Choisir:

```text
Linux
x64
```

GitHub affiche une commande:

```bash
./config.sh --url https://github.com/PoweredBySymfony --token A4...
```

Copier uniquement la valeur apres `--token`.

Puis lancer:

```powershell
$env:GITHUB_RUNNER_TOKEN="TOKEN_GITHUB_RUNNER"
docker compose -f docker-compose.github-runner.yml up -d --build github-runner
```

Le token d'enregistrement:

- ne va pas dans GitHub Secrets;
- ne va pas dans le depot;
- sert seulement a inscrire le runner;
- expire rapidement;
- n'est plus necessaire une fois le runner inscrit et persiste dans le volume Docker.

Verifier les logs:

```powershell
docker logs --tail 80 summoner-build-lab-github-runner
```

Resultat attendu:

```text
Runner successfully added
Listening for Jobs
```

## 11. Autoriser le runner d'organisation

Dans GitHub:

```text
PoweredBySymfony > Settings > Actions > Runner groups > Default
```

Configurer:

```text
Repository access: All repositories
Workflow access: All workflows
Allow public repositories: checked
```

Pourquoi cocher `Allow public repositories`:

Le repo est public. Sans cette case, GitHub voit le runner mais n'envoie pas les jobs dessus.

Erreur observee:

```text
Waiting for a runner to pick up this job
Requested labels: self-hosted, local-sonarqube
```

![Depannage SonarQube](assets/sonarqube-troubleshooting.svg)

## 12. Ajouter le workflow GitHub Actions

Fichier:

```text
.github/workflows/sonarqube.yml
```

Workflow:

```yaml
name: SonarQube Server

on:
  push:
    branches:
      - "**"
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: sonarqube-${{ github.ref }}
  cancel-in-progress: true

jobs:
  scan:
    name: Build, test, and scan main
    runs-on: [self-hosted, local-sonarqube]
    env:
      NODE_ENV: test
      POSTGRES_DB: summoner_build_lab
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      DATABASE_URL: postgresql://postgres:postgres@host.docker.internal:5433/summoner_build_lab?schema=public
      AUTH_SECRET: ci-only-auth-secret-change-me
      CLIENT_URL: http://localhost:8080
      APP_URL: http://localhost:8080
      MONGODB_URI: mongodb://host.docker.internal:27017/summoner_build_lab
      MONGODB_DB_NAME: summoner_build_lab
      ML_ENABLED: "false"

    steps:
      - name: Checkout
        uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Start local services
        run: docker compose up -d postgres mongo

      - name: Generate Prisma client
        run: npm run prisma:generate

      - name: Apply database migrations
        run: npx prisma migrate deploy

      - name: Seed test database
        run: npm run prisma:seed

      - name: Lint
        run: npm run lint

      - name: Test with coverage
        run: npm run test:coverage

      - name: Build
        run: npm run build

      - name: SonarQube Server scan
        if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        uses: SonarSource/sonarqube-scan-action@v7
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

![Flux CI](assets/sonarqube-ci-flow.svg)

## 13. Comprendre la regle des branches

SonarQube Community Build local ne gere pas les analyses branches/PR comme SonarQube Cloud ou Developer Edition.

Pour eviter de polluer `main`, on applique cette regle:

- Push sur une branche feature: lint, tests coverage, build.
- Pull request vers `main`: lint, tests coverage, build.
- Push ou merge sur `main`: lint, tests coverage, build, puis scan SonarQube.

![Politique de branches](assets/sonarqube-branch-policy.svg)

La condition qui controle cela:

```yaml
if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
```

## 14. Lancer la premiere analyse

Pousser une branche feature:

```powershell
git add .github/runner docker-compose.github-runner.yml .github/workflows/sonarqube.yml sonar-project.properties vitest.config.ts package.json package-lock.json
git commit -m "Configure local SonarQube GitHub Actions runner"
git push
```

Sur une branche feature, le workflow doit passer, mais l'etape suivante est ignoree:

```text
SonarQube Server scan
```

C'est normal.

Ensuite merger sur `main`.

Sur `main`, l'etape `SonarQube Server scan` doit s'executer.

Une fois le workflow vert, retourner dans SonarQube:

```text
http://localhost:9000
```

Aller dans le projet:

```text
summoner-build-lab
```

Les onglets utiles:

```text
Overview
Issues
Security Hotspots
Measures
Activity
```

## 15. Verifier l'analyse via API

Creer un token User dans SonarQube:

```text
My Account > Security
```

Puis interroger l'API:

```powershell
$token = "TON_TOKEN_USER"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($token + ":"))
Invoke-RestMethod `
  -Uri "http://localhost:9000/api/measures/component?component=summoner-build-lab&metricKeys=bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density,security_hotspots,ncloc" `
  -Headers @{ Authorization = "Basic $auth" } `
  -UseBasicParsing
```

Resultat obtenu lors de la validation:

```text
Branch: main
Quality Gate: OK
Lines of Code: 37,409
Coverage: 27.3%
Duplications: 3.6%
Bugs: 12
Vulnerabilities: 0
Security Hotspots: 27
Code Smells: 522
Security rating: A
Reliability rating: D
Maintainability rating: A
```

## 16. Connecter SonarQube for IDE dans VS Code

Dans VS Code:

```text
SonarQube Setup > Connected Mode > Connect to SonarQube Server
```

Choisir:

```text
Connect to SonarQube Server
```

Ne pas choisir:

```text
Connect to SonarQube Cloud
```

Configuration:

```text
Server URL: http://localhost:9000
Project key: summoner-build-lab
```

Si deux projets apparaissent, choisir:

```text
summoner-build-lab    summoner-build-lab
```

Le projet avec une key du type:

```text
PoweredBySymfony_summoner-build-lab_...
```

vient des essais et peut etre supprime plus tard.

## 17. Depannage complet

### Docker daemon indisponible

Erreur:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

Cause:

Docker Desktop n'est pas demarre.

Solution:

```powershell
Start-Process "$Env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
docker info
```

### Mauvaise version SonarQube

Probleme:

```text
sonarqube:lts-community
```

a installe `9.9.8`.

Solution:

Utiliser:

```text
sonarqube:26.1.0.118079-community
```

### GitHub callback refusee

Erreur:

```text
The redirect_uri is not associated with this application
```

Solution:

Copier la valeur exacte de `redirect_uri` dans la barre d'adresse GitHub, la decoder, puis l'ajouter dans les Callback URLs de la GitHub App.

Exemple:

```text
http://localhost:9000/projects/create?mode=github&dopSetting=...
```

### Runner en attente

Erreur:

```text
Waiting for a runner to pick up this job
```

Solutions:

1. Verifier que le runner est `Idle` dans GitHub.
2. Verifier les labels:

```text
self-hosted
local-sonarqube
```

3. Verifier:

```text
Runner groups > Default > All repositories
Runner groups > Default > All workflows
Runner groups > Default > Allow public repositories
```

### Permission `_work/_tool`

Erreur:

```text
Access to the path '/home/runner/actions-runner/_work/_tool' is denied
```

Cause:

Volume Docker possede par `root`.

Solution dans `entrypoint.sh`:

```bash
sudo mkdir -p "${RUNNER_WORKDIR}" "${RUNNER_WORKDIR}/_tool"
sudo chown -R runner:runner "${RUNNER_WORKDIR}"
```

### Docker socket refuse

Erreur:

```text
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

Solution:

Monter le socket Docker:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

Puis donner l'acces dans l'entrypoint:

```bash
if [[ -S /var/run/docker.sock ]]; then
  sudo chmod 666 /var/run/docker.sock
fi
```

### Session runner en conflit

Erreur:

```text
A session for this runner already exists
Runner connect error: Error: Conflict
```

Solutions:

1. Attendre que GitHub libere la session.
2. Redemarrer le runner:

```powershell
docker compose -f docker-compose.github-runner.yml restart github-runner
```

3. Si le conflit reste bloque, supprimer le runner dans GitHub, creer un nouveau token via `New runner`, puis relancer:

```powershell
$env:GITHUB_RUNNER_TOKEN="NOUVEAU_TOKEN"
docker compose -f docker-compose.github-runner.yml up -d --build github-runner
```

### Token avec retour ligne

Erreur:

```text
Failed to query server version: invalid header value: "***\n"
```

Cause:

Le secret GitHub `SONAR_TOKEN` contient un retour a la ligne.

Solution:

Remplacer le secret par le token sur une seule ligne.

### Non autorise a analyser le projet

Erreur:

```text
You're not authorized to analyze this project
or the project doesn't exist on SonarQube
and you're not authorized to create it.
```

Causes rencontrees:

- token Project trop restrictif;
- token lie a une mauvaise project key;
- `sonar.projectKey` different du projet SonarQube.

Solution finale:

```properties
sonar.projectKey=summoner-build-lab
```

et utiliser un token SonarQube de type User dans le secret GitHub:

```text
SONAR_TOKEN
```

### Warning baseline-browser-mapping

Warning:

```text
[baseline-browser-mapping] The data in this module is over two months old.
```

Ce warning n'est pas bloquant.

Correction optionnelle:

```powershell
npm i baseline-browser-mapping@latest -D
```

## 18. Commandes utiles

Voir les conteneurs:

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Voir SonarQube:

```powershell
Invoke-WebRequest -Uri "http://localhost:9000/api/system/status" -UseBasicParsing
```

Voir le runner:

```powershell
docker compose -f docker-compose.github-runner.yml ps
```

Logs du runner:

```powershell
docker logs --tail 100 summoner-build-lab-github-runner
```

Verifier Docker depuis le runner:

```powershell
docker exec summoner-build-lab-github-runner docker ps
```

Redemarrer le runner:

```powershell
docker compose -f docker-compose.github-runner.yml restart github-runner
```

Arreter le runner:

```powershell
docker compose -f docker-compose.github-runner.yml stop github-runner
```

## 19. Securite

Ne jamais committer:

- token SonarQube;
- token d'enregistrement GitHub runner;
- private key GitHub App;
- secrets GitHub.

Attention:

Le runner monte:

```text
/var/run/docker.sock
```

Cela donne au workflow un controle fort sur Docker local. Ne pas executer de code non fiable sur ce runner, surtout depuis des PR externes.

## 20. Nettoyage possible

Supprimer dans SonarQube les projets crees pendant les essais, par exemple:

```text
PoweredBySymfony_summoner-build-lab_...
```

Garder le projet final:

```text
summoner-build-lab
```

Supprimer les anciennes images Docker si besoin:

```powershell
docker images
docker rmi IMAGE_ID
```

Ne pas supprimer les volumes `sonarqube_lta_*` si l'on veut garder les analyses.

## 21. Checklist finale

Avant de considerer l'installation terminee:

1. Docker Desktop demarre.
2. `sonarqube` est `Up`.
3. `summoner-build-lab-github-runner` est `Up`.
4. GitHub voit le runner `summoner-build-lab-docker` en `Idle`.
5. GitHub Secrets contient:

```text
SONAR_TOKEN
SONAR_HOST_URL=http://host.docker.internal:9000
```

6. Un push sur branche feature passe lint, tests et build.
7. Un merge sur `main` execute le scan SonarQube.
8. SonarQube affiche `Last analysis` sur `main`.
9. Quality Gate affiche `Passed`.

