# TinyInlineEditor 2.1 — Validation de la livraison

Date : 21 octobre 2026.

## Commandes exécutées

- `node --check TinyInlineEditor.js` — réussi.
- `node --check demo.js` — réussi.
- `python -m unittest discover -s tests -v` — **21 tests réussis**, Chromium headless via Playwright, 20,606 s (dernier passage).
- Vérification démo par injection des sources locales avec `page.set_content` et `add_script_tag` dans Chromium : **5 instances** par scénario, aucun `pageerror` observé. Modes **light**, **dark** et vue mobile **390 × 844 px** contrôlés. `document.documentElement.scrollWidth <= innerWidth` pour les trois configurations. Simulation de sauvegarde manuelle de la démo passée.
- Captures `preview.png`, `preview-dark.png`, `preview-mobile.png`, `preview-toolbar.png` refaites avec la version 2.1.

## Principaux workflows réellement testés

Initialisation multiple ; alias jQuery ; thème dynamique ; mise en forme italique et titres ; format Citation imbriqué ; couleur invalide et Palette ; lien `javascript:` refusé ; collage brut ; synchronisation de textarea ; lifecycle de destruction ; sauvegarde retardée/sérialisée ; sauvegarde échouée ; autosave désactivé ; `flush()` en cours de requête et sur échec ; callback `onChange` lançant une exception ; scroll parent ; intégration hook de sanitation ; résistance à la pollution de prototype ; validation d'options invalides ; navigation Retour des panneaux.

## Non exécuté / non garanti

- Aucune compilation de `TinyInlineEditor.scss` avec Sass : CLI Sass indisponible dans l'environnement de validation ; le CSS compilé existant reste livré. La logique CSS propre à l'éditeur n'a pas été modifiée.
- Tests Firefox, WebKit/Safari, lecteur d'écran, IME/composition, sélection multi-blocs complexe, navigation clavier complète non exécutés.
- Aucun backend : pas de garantie de validation HTML côté serveur, de sécurité de flux financiers/données, de contrôle CSRF, d'authentification, ni de résolution de conflits multi-clients.
- `execCommand` demeure une API dépréciée ; pas de garantie de HTML/undo identiques entre moteurs.
- `sanitizeHTML` est un **hook d'intégration**. Aucun sanitizer éprouvé n'est fourni : le HTML de sources non fiables doit être nettoyé en amont et côté serveur.

La livraison est vérifiée pour le périmètre décrit. Ce document ne constitue pas une certification WCAG ni un audit de sécurité exhaustif.
