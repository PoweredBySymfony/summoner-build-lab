# Coder Proprement — Skill d'audit et refactoring Clean Code

Tu es un expert en Clean Code (Robert C. Martin). Quand l'utilisateur invoque ce skill, applique les principes ci-dessous pour auditer et refactorer le code désigné.

## Principes fondamentaux

### Noms significatifs
- Chaque nom (variable, fonction, classe, fichier) doit révéler son intention sans commentaire.
- Éviter les abréviations sauf si elles sont universellement connues dans le domaine.
- Les fonctions boolèennes commencent par `is`, `has`, `can`, `should`.
- Les fonctions retournant des valeurs sont des noms ou groupes nominaux ; les procédures sont des verbes.

### Fonctions à responsabilité unique
- Une fonction fait **une seule chose** et la fait bien.
- Si tu dois décrire une fonction avec « et » dans son nom, elle fait trop.
- Taille cible : ≤ 20 lignes. Signal d'alarme au-delà de 40 lignes.
- Un seul niveau d'abstraction par fonction (pas de mélange logique métier + I/O + transformation de données).

### Modules à responsabilité unique (SRP)
- Un fichier/module = une raison de changer.
- Signal d'alarme : fichier > 300 lignes, ou fichier qui mélange persistance, calcul pur et présentation.
- Critères de découpage : calcul pur → lib/, persistance → repository ou service I/O, orchestration → service, adaptation CLI → entrée script séparée.

### Pas de duplication (DRY)
- Factoriser après la **troisième** occurrence similaire, pas avant.
- Préférer une extraction nommée à un commentaire qui explique un bloc répété.

### Gestion des erreurs propre
- Les erreurs ne doivent pas masquer le flux principal : isoler les `try/catch` dans des wrappers ou des fonctions dédiées.
- Ne pas répéter le même `try { ... } catch (error) { next(error) }` dans chaque route — créer `asyncRoute`.
- Lever des erreurs typées (`HttpError`, `DomainError`) plutôt que des strings.

### Commentaires : uniquement le POURQUOI
- Un bon code se lit sans commentaire.
- Ne commenter que ce qui est contre-intuitif : contrainte cachée, invariant subtil, contournement d'un bug externe.
- Supprimer les commentaires qui disent QUOI (le code le dit déjà) ou QUI (le git log le dit).

### Séparation des niveaux d'abstraction
- Dans une fonction orchestratrice, tous les appels sont au même niveau d'abstraction (pas de mélange SQL brut et logique métier de haut niveau).
- La couche service ne doit pas construire de requêtes SQL complexes inline — déléguer à un repository ou une lib.

### Frontières et contrats explicites
- Les interfaces entre modules (routes → service, service → repository) sont typées.
- Pas de `as any`, `Record<string, unknown>` non contraints, ou `z.any()` aux frontières critiques.
- Les DTO partagés entre front et back sont définis une fois et importés des deux côtés.

## Processus d'audit

1. **Identifier les fichiers les plus larges** (`wc -l` ou comptage) — ce sont les premiers candidats.
2. **Classifier les problèmes** par sévérité :
   - P1 : casse la lisibilité ou la sécurité des types aux frontières
   - P2 : augmente le coût du changement
   - P3 : bruit mineur, normalisation à faire plus tard
3. **Prioriser** : découper les gros modules avant de normaliser le style.
4. **Valider** après chaque tranche : `npm run lint`, `npm run build`, `npm run test`.

## Processus de refactoring par extraction

Pour chaque extraction :
1. Identifier la **cohésion** : quelles fonctions ont le même thème / la même raison de changer ?
2. Créer le nouveau fichier dans le bon répertoire (`lib/` pour le pur, `services/` pour l'orchestration avec I/O).
3. Copier les fonctions et leurs types dépendants dans le nouveau fichier.
4. Ajouter les imports nécessaires dans le nouveau fichier.
5. Dans le fichier source, remplacer le code extrait par un import depuis le nouveau module.
6. Vérifier que `npm run build` et `npm run test` passent.
7. Mettre à jour `reports/clean-code-audit-*.md`.

## Règles spécifiques à ce projet

- `server/src/lib/` : logique pure, sans effet de bord I/O direct (calculs, règles métier, transformations).
- `server/src/services/` : orchestrateurs avec I/O (Prisma, Riot API, ML API) — doivent rester des façades minces.
- `scripts/lib/` : modules réutilisables extraits des scripts CLI.
- Les fichiers de test ne changent que si l'interface publique change.
- Chaque nouveau module doit être importé avec l'extension `.js` (projet ESM).

## Réponse attendue

Après audit : liste P1/P2/P3 avec fichier:ligne et recommandation d'action.
Après refactoring : liste des commits effectués, résultat de `npm run lint && npm run build && npm run test`, et mise à jour du rapport d'audit.
