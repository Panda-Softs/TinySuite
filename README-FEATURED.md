# TinySuite — Featured Components par catégorie

## Contenu
Modification ciblée de **Featured Components** dans la page d'accueil TinySuite.
Six catégories avec leurs composants empilés verticalement (20 au total), fonctionnalités détaillées dans `website/catalog.json`, et 20 illustrations SVG distinctes à fond transparent.
Le hero, les autres sections, les composants Tiny* et leurs démos ne sont pas modifiés.

Un lien « Panda-Softs ↗ » est ajouté à la navigation TinySuite, pointant vers https://panda-softs.github.io/.

Les textes détaillés des fonctionnalités restent en anglais, comme la version actuelle du site.

## Application du fichier .patch
Depuis la racine du dépôt TinySuite :

```bash
git apply --check /chemin/TinySuite_Featured_Categories.patch
git apply /chemin/TinySuite_Featured_Categories.patch
python3 scripts/build-site.py
open .build/site/index.html
```

## Alternative ZIP
Le ZIP contient uniquement les fichiers ajoutés ou modifiés, sous leurs chemins d'origine. Copie ses dossiers `scripts/` et `website/` **dans** le dossier TinySuite, sans supprimer les fichiers déjà présents ; remplace seulement ceux de mêmes noms. L'archive ne contient pas de CSS compilé : le build régénère `website/assets/site.css` automatiquement depuis les SCSS.

## Validation
Le patch a été testé contre ton `WS(1).zip` et contre la version incluant le correctif du site précédent. `python3 scripts/build-site.py` et `python3 scripts/verify_site.py` ont réussi sur les deux bases.
Les 20 nouveaux SVG ont été analysés et un contrôle visuel des cartes a été effectué en desktop et mobile avec le HTML/CSS injecté dans Chromium. La navigation directe `file://` dans Chromium est bloquée dans cet environnement ; elle reste à vérifier sur ton poste.
