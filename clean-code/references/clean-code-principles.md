# Principes Clean Code — aide-mémoire

Synthèse opérationnelle des thèmes de *Coder proprement* de Robert C. Martin. Utilise-la pour raisonner sur un changement; n’en applique pas mécaniquement chaque préférence stylistique.

## Intention et lisibilité

- Laisse le code touché un peu plus propre qu’à ton arrivée, sans mélanger une refonte large à une correction ciblée.
- Choisis des noms révélant l’intention, prononçables, recherchables et cohérents avec le vocabulaire métier.
- Évite les abréviations obscures, les informations de type dans les noms, les nombres magiques, les associations mentales et les noms qui se distinguent trop peu.
- Utilise une mise en forme cohérente pour rendre visibles la structure, les dépendances et les unités logiques.

## Fonctions et commentaires

- Fais faire une seule chose à une fonction, à un niveau d’abstraction cohérent. Compose plusieurs fonctions plutôt que d’en écrire une longue et ramifiée.
- Réduis les paramètres; évite les paramètres booléens qui cachent deux comportements. Préfère des objets de paramètres quand ils représentent réellement un concept.
- Évite les effets de bord cachés. Sépare une requête qui répond d’une commande qui modifie l’état.
- Fais en sorte que le code porte l’explication principale. Réserve les commentaires aux décisions, contraintes, avertissements ou conséquences qui ne peuvent pas être rendus évidents dans le code.
- Supprime les commentaires redondants, obsolètes ou trompeurs, ainsi que le code commenté.

## Objets, données et dépendances

- Fais des objets qui protègent leurs invariants et des structures de données qui exposent clairement leurs données; ne les confonds pas.
- Évite de naviguer en chaîne dans des détails internes d’un autre objet. Demande un comportement à la bonne abstraction.
- Isole les bibliothèques, services externes et détails de framework derrière des adaptations locales quand ils traverseraient autrement le domaine.
- Garde l’instanciation et la configuration à la frontière de l’application; injecte les dépendances utiles au lieu de les créer au cœur de la logique métier.

## Erreurs et tests

- Signale une erreur de façon cohérente et exploitable. Ajoute le contexte nécessaire, mais ne noie pas la cause originale.
- N’utilise pas `null`, un code sentinelle ou une valeur spéciale comme contrat d’échec implicite lorsqu’une exception ou un type résultat explicite rend l’appel plus sûr.
- Écris des tests qui protègent le comportement, pas l’implémentation accidentelle. Garde-les rapides, isolés, répétables, auto-vérifiants et écrits au bon moment (FIRST).
- Un test doit rester lisible: organise préparation, action et vérification; nomme le scénario et l’effet attendu.

## Conception qui reste simple

- Donne à une classe une responsabilité cohérente et une seule raison principale de changer. Recherche la cohésion avant de multiplier les petites classes.
- Applique SOLID comme un outil de décision, non comme une excuse pour introduire des couches: responsabilités distinctes, contrats substituables, interfaces petites, dépendances dirigées vers les abstractions utiles.
- Préfère une conception qui passe les tests, exprime son intention, ne duplique pas inutilement et contient le minimum d’éléments nécessaires.
- Refactore régulièrement par petites étapes sûres. N’optimise ou ne généralise qu’après avoir une mesure ou une variation réelle.
- Dans le code concurrent, limite l’état partagé, identifie les invariants et les points de synchronisation, et teste les scénarios à risque séparément.
