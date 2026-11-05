# TinyGroupButton 1.1.0

Composant **Vanilla JavaScript** minimal pour piloter des groupes de `<input type="checkbox">` affichés comme des boutons. Aucune dépendance, aucun build et aucun serveur requis.

La démo fonctionne en ouvrant directement `demo/index.html` avec `file://`.

## Contenu

- `TinyGroupButton.js` : source commentée ;
- `demo/index.html` : démo interactive exhaustive ;
- `demo/demo.css` : design de démonstration ;
- `tests/index.html` : tests de comportement autonomes, exécutables en `file://`.

## Contrat

TinyGroupButton conserve les comportements utiles de l'ancien plugin jQuery `btnGroup` :

- les inputs natifs et leur propriété `checked` restent la source de vérité ;
- les choix normaux sont exposés en CSV minuscule, par exemple `foil,sup` ;
- un checkbox optionnel portant `.all` représente « tous » et n'apparaît jamais dans la valeur CSV ;
- sélectionner « tous » désélectionne les choix normaux ;
- dès qu'un choix normal est actif, « tous » est désactivé ;
- si le dernier choix normal est désactivé, « tous » redevient actif ;
- `updateValue()` synchronise le DOM sans déclencher `onChange` ;
- les valeurs demandées mais absentes du DOM sont éliminées ;
- les options ajoutées dynamiquement fonctionnent sans réinitialisation ;
- `onChange` et `afterChange` sont des `CustomEvent` natifs ;
- `destroy()` retire le listener et permet à `getInstance()` de recréer une instance propre.

## HTML

```html
<div id="categories" class="btn-group" role="checkbox-group">
    <label class="is-checked">
        <input type="checkbox" class="all" value="*" checked>
        Tous
    </label>
    <label>
        <input type="checkbox" value="FOIL">
        Foil
    </label>
    <label>
        <input type="checkbox" value="SUP">
        SUP
    </label>
</div>
```

La classe fonctionnelle `.all` doit être sur l'`input`. La classe visuelle active est `is-checked` par défaut.

## Initialisation

```html
<script src="TinyGroupButton.js"></script>
<script>
const group = TinyGroupButton.getInstance('#categories');
</script>
```

`getInstance()` fait volontairement **get-or-create**. Il n'existe pas de `getOrCreateInstance()` ni d'AutoInit global : chaque page initialise uniquement les groupes qu'elle utilise.

Un élément absent retourne `null` :

```js
TinyGroupButton.getInstance('#does-not-exist'); // null
```

Les options ne sont prises en compte qu'à la création de l'instance :

```js
const group = TinyGroupButton.getInstance('#categories', {
    activeClass: 'selected',
    onChange(value) {
        console.log(value);
    }
});
```

## API

### `TinyGroupButton.getInstance(elementOrSelector, options = {})`

Retourne l'instance existante ou la crée. Accepte un `HTMLElement` ou un sélecteur CSS.

### `buildValue()`

Lit **l'état DOM actuel** et retourne le CSV effectif :

```js
group.buildValue(); // "foil,sup"
```

### `getValue()`

Retourne la dernière valeur mémorisée par `setValue()`. Pour lire l'état réel du DOM à n'importe quel moment, utiliser `buildValue()`.

Cette distinction est volontairement conservée pour rester compatible avec le contrat historique du plugin.

### `updateValue(value)`

Applique un CSV aux checkboxes, synchronise la classe visuelle et retourne la valeur réellement applicable, sans émettre d'événement :

```js
selectedCats = group.updateValue(selectedCats);
```

Exemple avec une valeur inexistante :

```js
group.updateValue('FOIL,UNKNOWN'); // "foil" si FOIL existe
```

La comparaison avec les `value` HTML reste sensible à la casse, comme dans l'ancien plugin. La valeur retournée est normalisée en minuscules par `buildValue()`.

### `setValue(value, triggerUpdate = true)`

Met à jour la valeur interne et émet `onChange`, puis le callback optionnel, puis `afterChange` lorsque la valeur a changé. Cette méthode ne coche pas les inputs ; `updateValue()` sert à synchroniser le DOM.

### `check(checkboxes, checked)`

Helper bas niveau qui synchronise `checked` et la classe active du label parent.

### `destroy()`

Retire le listener du groupe et sa référence dans le `WeakMap` :

```js
group.destroy();
const freshGroup = TinyGroupButton.getInstance('#categories');
```

## Événements

```js
const element = document.querySelector('#categories');

element.addEventListener('onChange', event => {
    console.log(event.detail.old_value);
    console.log(event.detail.value);
});

element.addEventListener('afterChange', event => {
    console.log(event.detail.from);
    console.log(event.detail.to);
});
```

Les deux événements ont `bubbles: true`.

Le callback d'option reçoit la nouvelle valeur :

```js
TinyGroupButton.getInstance('#categories', {
    onChange(value) {
        console.log(value);
    }
});
```

## Options dynamiques

Le listener `change` est posé une seule fois sur la racine. Ajouter ou remplacer les labels internes ne nécessite donc aucun rebind :

```js
group.element.insertAdjacentHTML(
    'beforeend',
    '<label><input type="checkbox" value="SURF">Surf</label>'
);
```

C'est important pour `script_rentals_live.js`, qui reconstruit les catégories sans remplacer le conteneur du groupe.

## Migration depuis `btnGroup`

Avant :

```js
selectedCats = $catGroup.btnGroup().updateValue(selectedCats);
```

Après :

```js
const catGroup = TinyGroupButton.getInstance($catGroup[0]);
selectedCats = catGroup.updateValue(selectedCats);
```

Listener jQuery historique :

```js
$group.on('onChange.namespace', (event, data) => {
    console.log(data.value);
});
```

Listener DOM natif :

```js
const onFiltersChanged = event => {
    console.log(event.detail.value);
};

element.removeEventListener('onChange', onFiltersChanged);
element.addEventListener('onChange', onFiltersChanged);
```

Le `removeEventListener()` avant `addEventListener()` permet de conserver un câblage idempotent lorsque la fonction d'initialisation peut être rappelée.

## Design

Le JavaScript n'impose aucun CSS. La démo montre une forme proche d'un **segmented control** : un conteneur unique arrondi, des choix neutres sans bordure individuelle visible et l'élément actif posé comme une petite carte arrondie. Le design est donc réutilisable sans coupler le comportement du composant au thème de Fiddo.

## Compatibilité

Navigateurs modernes avec `WeakMap`, `CustomEvent`, `Element.closest`, `classList` et syntaxe ES2015+.
