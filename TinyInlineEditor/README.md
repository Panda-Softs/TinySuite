# TinyInlineEditor 2.1

Éditeur HTML inline léger avec **jQuery**, barre contextuelle et interface clair/sombre. La démo complète (`demo.html`) fonctionne **hors ligne**, sans build ni CDN grâce au jQuery inclus. Le plugin historique `$.fn.inLine` reste compatible.

> **Version locale 2.1** — version de cette livraison, pas une publication officielle. Elle corrige les défauts de la revue V2 sans réécrire le moteur fondé sur `document.execCommand` (API dépréciée).

## Démarrer

Ouvrir `demo.html` directement dans le navigateur. Pour une meilleure compatibilité avec les fonctions de presse-papiers :

```bash
python -m http.server 8000
# http://localhost:8000/demo.html
```

Intégration minimale :

```html
<link rel="stylesheet" href="TinyInlineEditor.css">
<div id="editor"><p>Sélectionnez ce texte pour l'éditer.</p></div>
<script src="vendor/jquery.min.js"></script>
<script src="TinyInlineEditor.js"></script>
<script>
  $('#editor').tinyInlineEditor({ theme: 'light' });
</script>
```

Aucune dépendance au build pendant l'exécution. Le `vendor/jquery.min.js` inclus correspond à jQuery **3.6.1**, licence à consulter dans `vendor/LICENSE-jQuery.txt`.

## Fonctionnalités

- Gras, italique, souligné, barré, titres H1 à H3 et citations.
- Listes, alignements, liens validés et palette de couleurs.
- Surface `DIV`/`SPAN` ou `TEXTAREA` synchronisé.
- Plusieurs instances indépendantes, callbacks `onChange`, `onReady`, `onDestroy`, `onToolbarOpen`, `onToolbarClose`, `onSave`.
- `light`, `dark`, `purple` (expérimental). **Auto** est géré par la démo via `prefers-color-scheme`.
- Sauvegardes différées et sérialisées par instance, état `dirty`, sauvegarde explicite `flush()`.
- Collage en texte brut par défaut. Les HTML chargés par l'application nécessitent une politique de sécurité distincte.

## Options validées

```js
$('#editor').tinyInlineEditor({
  theme: 'dark',                               // 'light' | 'dark' | 'purple'
  toolbar: ['bold', 'italic', 'format', 'align', 'unorderedList', 'orderedList', 'color', 'link'],
  formats: ['bigTitle', 'mediumTitle', 'smallTitle', 'blockquote'],
  colors: ['#8b5cf6', '#f45945'],             // hexadécimal #RGB, #RGBA, #RRGGBB ou #RRGGBBAA
  autoInit: true,
  autosaveOn: true,
  pasteAsPlainText: true,
  output: false,                              // CSS selector or false
  html: false,                                // uniquement du HTML de confiance sans sanitizer
  sanitizeHTML: false,                        // hook facultatif, voir sécurité
  onReady(api) {},
  onChange(api) {},
  onDestroy(api) {},
  onToolbarOpen(api, selection) {},
  onToolbarClose(api) {},
  onSave(api, htmlSnapshot) { return Promise.resolve(true); }
});
```

L'API rejette par `TypeError` les valeurs de mauvais type, les commandes inconnues, les couleurs invalides et les thèmes inconnus. Elle ignore les propriétés inconnues et les propriétés spéciales `__proto__`, `constructor`, `prototype`. Les propriétés de traduction acceptées sont celles de `labels` par défaut.

L'API jQuery historique fonctionne toujours :

```js
$('#editor').inLine({ theme: 'light' });             // ancienne API
$('#editor').tinyInlineEditor('set', { theme: 'dark' }); // même instance, thème à chaud
const api = $('#editor').data('inLine');
api.content; // dernier HTML synchronisé
api.trigger; // élément contenteditable
```

`set()` prend en charge les options validées. Le thème et `autosaveOn` s'appliquent immédiatement ; la configuration visuelle de la barre et des formats sera prise en compte au prochain affichage de la barre. `autoInit`, `html` et `output` sont principalement des options d'initialisation ; les modifier via `set()` ne recrée pas la surface d'édition.

## Changement de contenu, événements et formulaires

`api.commitChange()` doit être appelé après une modification DOM programmée. Il synchronise le contenu vers l'output et déclenche `onChange` **uniquement si le HTML est réellement différent** du précédent. Un `textarea` ne reçoit plus d'événement `change` synthétique pendant l'initialisation ni pour un commit inchangé. Sur une modification effective, le `textarea` ou output reçoit un `change` synthétique pour la compatibilité avec les formulaires.

```js
const api = $('#editor').data('inLine');
api.setContent('<p>Un nouveau contenu <strong>fiable</strong>.</p>'); // synchronise + commit
console.log(api.content);
```

`setContent()` applique le sanitizer optionnel (s'il existe). Sans sanitizer, ne lui passer que du HTML de confiance. Les mutations ordinaires du navigateur déclenchent `commitChange()` sur `input`, et les actions de la barre l'appellent explicitement. Les exceptions levées par `onChange` sont journalisées et n'empêchent pas la sauvegarde.

## Autosave, `flush` et destruction

```js
$('#editor').tinyInlineEditor({
  onSave(api, snapshot) {
    return fetch('/api/notes/42', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({html: snapshot})
    }).then(response => response.ok);
  }
});

const api = $('#editor').data('inLine');
console.log(api.dirty);    // true si la dernière version n'a pas été enregistrée
const saved = await api.flush(); // true seulement si la dernière révision a été enregistrée
if (saved) $('#editor').tinyInlineEditor('destroy');
```

- Autosave : 1 seconde après la dernière modification, uniquement si `autosaveOn: true` et `onSave` est défini.
- `set({autosaveOn:false})` annule le **timer non encore envoyé**, mais **ne peut pas annuler une requête déjà envoyée**.
- `api.flush()` / `api.save()` déclenche une sauvegarde immédiate même lorsque `autosaveOn` est `false`, puis attend les éventuelles requêtes déjà en vol et réenregistre si une révision plus récente est apparue. `true` indique que la dernière révision a été sauvegardée, `false` un échec ou l'absence de callback de sauvegarde.
- `$('#editor').tinyInlineEditor('flush')` renvoie une Promise résolue à `true` uniquement si **tous les éditeurs sélectionnés** ont été sauvegardés.
- `destroy()` reste **synchrone** et ne réalise **aucune sauvegarde implicite** : appeler et attendre `flush()` avant de démonter ou naviguer si les modifications doivent être conservées. Une requête HTTP en cours peut encore aboutir côté serveur après `destroy()`.
- Les sauvegardes ne sont sérialisées que **par instance** : un backend multi-clients doit gérer versionnement, erreurs, conflits et sécurité.
- Le comportement `data-url` / `data-method` / `data-id` reste disponible. Une réussite AJAX doit retourner JSON `{ "success": true }`.

## Sécurité : frontière de confiance

**TinyInlineEditor n'est pas un sanitizer HTML.** Le HTML déjà présent dans un `DIV` au montage, les valeurs initiales de `TEXTAREA`, `html` et `setContent` peuvent contenir du HTML actif. Dans cette livraison, il n'y a **aucune dépendance de sanitation intégrée** : ne charger du HTML non fiable qu'après son assainissement par un outil éprouvé, côté client et obligatoirement côté serveur avant de stocker/réafficher. Ne pas concevoir une sanitation à base de regex.

Une option d'intégration `sanitizeHTML(html)` est fournie pour transformer les contenus chargés à l'initialisation et via `setContent()`. Par exemple **si** l'application installe DOMPurify (non fourni par ce ZIP) :

```js
$('#editor').tinyInlineEditor({
  sanitizeHTML: html => DOMPurify.sanitize(html, {
    USE_PROFILES: {html: true},
    // Définir une liste autorisée adaptée aux formats réels de l'application.
  })
});
```

**Important :** ce hook ne transforme pas l'éditeur en frontière de sécurité : un `DIV` contenant déjà du HTML malveillant est dangereux **avant** l'initialisation ; le HTML introduit par d'autres scripts, les sorties et les données sauvées restent à contrôler. Privilégier l'assainissement *avant toute insertion dans le DOM*, notamment lors d'une réédition. Le collage en texte brut par défaut limite l'entrée via le presse-papiers, mais ne sécurise pas toutes les entrées possibles.

Les URL créées via la barre sont limitées à HTTP(S), `mailto:`, `tel:` ou chemins relatifs. Les URL initiales ne sont pas réécrites automatiquement. La fusion des options a été durcie contre la pollution de prototypes. Les requêtes HTTP doivent utiliser authentification, autorisation, protection CSRF si nécessaire et validation serveur.

## Accessibilité et navigateurs

L'interface utilise `role="toolbar"` et des dialogs non modaux pour les dropdowns ; touche Échap pour fermer les dropdowns ; le retour des sous-panneaux restaure le focus. **Aucune certification WCAG** : les lecteurs d'écran, IME, toute la navigation clavier et Firefox/Safari/WebKit restent à contrôler. `execCommand` est déprécié et son HTML varie suivant le navigateur ; une migration du moteur n'est pas engagée en 2.1.

## Tests et recompilation

```bash
node --check TinyInlineEditor.js
node --check demo.js
python -m unittest discover -s tests -v
# ou : scripts/check.sh
```

Tests Playwright Python, exécution Chromium. Installer Playwright et disposer de Chromium ; dans les tests fournis, le chemin de Chromium est `/usr/bin/chromium` (adapter localement au besoin). `scripts/build-css.sh` reconstruit `TinyInlineEditor.css` à partir de `TinyInlineEditor.scss` **si** l'outil `sass` est installé. Le CSS précompilé est fourni et suffit pour l'utilisation ; la compilation Sass n'a pas été exécutée pendant cette livraison.

## Fichiers

```text
TinyInlineEditor/
├── TinyInlineEditor.js / TinyInlineEditor.css / TinyInlineEditor.scss
├── demo.html / demo.css / demo.js
├── vendor/jquery.min.js / vendor/LICENSE-jQuery.txt
├── tests/test_editor.py
├── scripts/check.sh / scripts/build-css.sh
├── AUDIT.md            (audit initial, historique)
├── AUDIT_V2.md         (constats de la revue 2.0)
├── CHANGELOG.md        (statut des corrections 2.1)
├── preview*.png        (captures de la démo)
└── README.md
```
