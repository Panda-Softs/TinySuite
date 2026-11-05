(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TinySelectize = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // --------------------------------------------
    // Internal helpers (closure-scoped)
    // --------------------------------------------

    const CLASS_NAMES = Object.freeze({
        SELECT: 'tiny-selectize',
        ROOT: 'tsz',
        MULTIPLE: 'tsz-multiple',
        ARROW: 'tsz-arrow',
        DISABLED: 'tsz--disabled',
        OPEN: 'tsz--open',
        LOADING: 'tsz--loading',
        INPUT_LOCKED: 'tsz--input-locked',
        CONTROL: 'tsz__control',
        INPUT: 'tsz__input',
        INPUT_LOCKED_ELEMENT: 'tsz__input--locked',
        CLEAR: 'tsz__clear',
        DROPDOWN: 'tsz__dropdown',
        STATUS: 'tsz__status',
        LIST: 'tsz__list',
        OPTGROUP: 'tsz__optgroup',
        OPTION: 'tsz__option',
        OPTION_DISABLED: 'tsz__option--disabled',
        OPTION_ACTIVE: 'tsz__option--active',
        ITEM: 'tsz__item',
        ITEM_LABEL: 'tsz__itemLabel',
        PILL: 'tsz__pill',
        REMOVE: 'tsz__remove',
        OPTION_LABEL: 'tsz__optionLabel',
        HAS_OPTIONS: 'has-options',
        HAS_ITEMS: 'has-items',
        IS_FULL: 'is-full',
        DROPDOWN_UP: 'dropdown-up',
        NO_HIGHLIGHT: 'no-hl'
    });

    const CLASS_SELECTORS = Object.freeze({
        CLEAR: '.' + CLASS_NAMES.CLEAR,
        REMOVE: '.' + CLASS_NAMES.REMOVE,
        PILL: '.' + CLASS_NAMES.PILL,
        ITEM: '.' + CLASS_NAMES.ITEM,
        OPTION_ACTIVE: '.' + CLASS_NAMES.OPTION_ACTIVE
    });

    var __uidCounter = 0;
    function uid() { __uidCounter += 1; return __uidCounter; }

    function isFn(value) { return typeof value === 'function'; }
    function isObj(value) { return value !== null && typeof value === 'object'; }

    /** Coerce a value to a string safely (null/undefined -> ''). */
    function toStr(v) { return v == null ? '' : String(v); }

    function fold(str) {
        // Accent-insensitive + lowercase
        // NFD splits letters + diacritics; then remove diacritics
        return toStr(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function debouncePromise(fn, wait) {
        var t = null, lastReject = null;

        return function (args) {
            return new Promise(function (resolve, reject) {
                if (t) clearTimeout(t);
                if (lastReject) lastReject({ name: 'Debounced' });
                lastReject = reject;

                t = setTimeout(function () {
                    lastReject = null;
                    Promise.resolve()
                        .then(function () { return fn(args); })
                        .then(resolve)
                        .catch(reject);
                }, wait);
            });
        };
    }

    function isPlainObject(value) {
        if (!isObj(value)) return false;
        const prototype = Object.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null;
    }

    const escapeHtml = s=> String(s ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');

    function deepMerge(base, override) {
        const result = {};

        const keys = new Set([
            ...Object.keys(base || {}),
            ...Object.keys(override || {})
        ]);

        for (const key of keys) {
            const baseValue = base?.[key];
            const overrideValue = override?.[key];

            if (overrideValue === undefined) {
                if (isPlainObject(baseValue)) {
                    result[key] = deepMerge(baseValue, {});
                } else if (Array.isArray(baseValue)) {
                    result[key] = [...baseValue];
                } else {
                    result[key] = baseValue;
                }

                continue;
            }

            if (isPlainObject(overrideValue)) {
                result[key] = deepMerge(isPlainObject(baseValue) ? baseValue : {}, overrideValue);
                continue;
            }

            if (Array.isArray(overrideValue)) {
                result[key] = [...overrideValue];
                continue;
            }

            result[key] = overrideValue;
        }

        return result;
    }

    function htmlToNode(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html ?? '').trim();

        // Prefer a single root element
        if (tpl.content.childElementCount === 1) return tpl.content.firstElementChild;

        // Multiple roots (or text + elements): wrap them
        const wrap = document.createElement('span');
        wrap.appendChild(tpl.content);
        return wrap;
    }

    function looksLikeHtml(s) {
        if (typeof s !== 'string' || s.indexOf('<') === -1) return false;  // Fast path: most strings won't contain '<'
        // Now run a stricter check for an actual tag
        return /<\s*\/?\s*[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(s);
    }

    function replaceNode(oldNode, newNode) {
        if (oldNode && oldNode.parentNode) oldNode.parentNode.replaceChild(newNode, oldNode);
    }

    function escapeRegex(str) {
        return toStr(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const DEFAULT_CONFIG = {
        placeholder: '',
        minChars: 0,

        // Local data (Selectize-like)
        // If provided, TinySelectize will populate the <select> from this array.
        options: null,            // Array<object> | null
        valueField: 'value',      // field name in objects for option value
        labelField: 'label',      // field name in objects for option label
        searchField: null,        // string | string[] | null (fields on raw objects)
        sortField: null,          // string | string[] | null (fields on raw objects)

        // Load throttling (ms). Back-compat alias: debounceMs
        loadThrottle: 150,
        debounceMs: undefined,

        maxOptions: 100,
        delimiter: ',',
        cache: true,
        preload: false,
        storageKey: null,
        openOnFocus: false,
        observeSelectMutations: true,
        showClearButton: true,
        showEmptyOption: false,
        showSelectedInDropdown: true,
        showArrow: true,
        showTypeahead: true,
        showLoadingTextInDropdown: false,
        defineWrapperValue: false,
        allowEmptyOption: true,

        // Sorting: 'match' (default) or 'none'
        sort: 'match',

        // Dropdown placement
        // null / undefined → auto intelligent:
        //   - TinySwal detected → closest .tiny-swal-container
        //   - otherwise inline
        // false / 'inline' → force inline
        // 'body' → force body portal with position: fixed
        // HTMLElement / selector / closest:<selector> → container portal with position: absolute
        dropdownParent: null,
        dropdownDetachThreshold: 140,
        dropdownAutoFlip: true,
        dropdownGapPx: 6,
        dropdownZIndex: 9999,
        dropdownCloseOnScrollParent: true,
        dropdownModalRootSelector: '.tiny-swal-container',
        dropdownModalPopupSelector: '.tiny-swal-popup,[role="dialog"][aria-modal="true"]',

        // Typeahead when input hidden (single)
        typeaheadResetMs: 600,

        i18n: {
            loading: 'Loading…',
            noResults: 'No results',
            error: 'Failed to load'
        },

        // AJAX convenience (optional)
        // If `ajax.url` is set and `load` is not, a default loader is used.
        ajax: {
            url: null,
            queryParam: 'q',
            method: 'GET',
            headers: {'X-Requested-With': 'XMLHttpRequest'},                 // object
            credentials: 'same-origin',     // fetch credentials
            responsePath: null,            // e.g. 'data' if server returns {data:[...]}
            mapOption: null,               // fn(item) => { value,label,disabled?,group?, raw? }
            ajaxData: null,                // fn(instance, payload) => request parameters
            queryMinChars: null,           // override minChars for ajax mode
            byIdsParam: 's',
            byIdsDelimiter: ','
        },

        // load can be either:
        // - modern: load({ query, signal, selectEl, instance }) => Promise<{ options: [...] }> | {options:[...]} | [...]
        // - selectize-like: load(query, callback, payload) => void
        load: null,

        // Rendering
        render: {
            option: null, // ({ option, query, meta? }) => Node | string
            item: null    // ({ option, meta? }) => Node | string
        },

        optgroupField: null,        // e.g. 'manufacturer' (read from option.raw[optgroupField] if option.group missing)
        optgroupValueField: 'value',// used by optionGroupRegister return object
        optgroupLabelField: 'label',// used by optionGroupRegister return object
        optionGroupRegister: null,  // fn(groupKey, ctx) => { value,label,... } OR string label

        // Plugins: { pluginName: true|object, ... }
        plugins: {},

        highlight: {
            enabled: true,
            separateWordSearch: true,
            minTermLength: 2,
            className: ''
        },

        // Guard for user-initiated option selections. May return a boolean or Promise<boolean>.
        // Programmatic APIs deliberately bypass it so hydration/refresh keep their existing behavior.
        beforeChange: null,
        onChange: null,
        onError: null,

        value : null
    };

    function mergeConfig(user) {
        const settings = deepMerge(DEFAULT_CONFIG, user);

        if (typeof settings.loadThrottle !== 'number' || settings.loadThrottle < 0) settings.loadThrottle = DEFAULT_CONFIG.loadThrottle;
        if (typeof settings.debounceMs === 'number') settings.loadThrottle = settings.debounceMs;

        if (settings.ajax && settings.ajax.url && !settings.load) {
            settings.load = null; // The instance attaches the built-in AJAX loader.
        }

        return settings;
    }

    // --------------------------------------------
    // Plugin registry (static)
    // --------------------------------------------

    const PLUGINS = {};

    function definePlugin(name, factory) {
        if (!name || typeof name !== 'string') throw new Error('TinySelectize.definePlugin(name, factory): name is required');
        if (!isFn(factory)) throw new Error('TinySelectize.definePlugin(name, factory): factory must be a function');
        PLUGINS[name] = factory;
    }

    function getPluginFactory(name) {
        return PLUGINS[name] || null;
    }

    function createAjaxLoader(instance) {
        var cfg = instance.config;
        var ajax = cfg.ajax || {};

        function getPath(obj, path) {
            if (!path) return obj;
            var parts = String(path).split('.');
            var cur = obj;
            for (var i = 0; i < parts.length; i++) {
                if (cur == null) return undefined;
                cur = cur[parts[i]];
            }
            return cur;
        }

        function defaultMapOption(item) {
            if (isObj(item)) {
                var value = item[cfg.valueField];
                var label = item[cfg.labelField];

                return {
                    value: value != null ? String(value) : '',
                    label: label != null ? String(label) : '',
                    disabled: !!item.disabled,
                    raw: item
                };
            }

            return { value: String(item), label: String(item), raw: item };
        }

        function normalizeAjaxResponse(json, mapOpt) {
            var data = ajax.responsePath ? getPath(json, ajax.responsePath) : json;

            var arr = Array.isArray(data) ? data : (Array.isArray(json?.options) ? json.options : []);

            var options = arr.map(function (it) {
                var o = mapOpt(it);
                if (isObj(o) && !('raw' in o)) o.raw = it;
                return o;
            });

            return { options: applyExclude(options) };
        }

        /**
         * Remove options excluded by the consumer.
         *
         * exclude accepts:
         *  - an array of values: [1, 2, 3]
         *  - a function(option, instance) => boolean
         *
         * The function form is evaluated dynamically so callers can react to
         * changing UI state without rebuilding the TinySelectize instance.
         */
        function applyExclude(options) {
            var exclude = instance?.config?.exclude;

            if (!exclude) return options;

            if (isFn(exclude)) {
                return options.filter(function (option) {
                    return !exclude.call(instance, option, instance);
                });
            }

            if (Array.isArray(exclude)) {
                var excluded = new Set(exclude.map(function (value) {
                    return String(value);
                }));

                return options.filter(function (option) {
                    return !excluded.has(String(option.value));
                });
            }

            return options;
        }

        function buildUrl(params) {
            var base = String(ajax.url || '');
            if (!base) return '';

            var parts = [];
            for (var k in params) {
                if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
                var v = params[k];
                if (v == null) continue;
                parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
            }

            if (!parts.length) return base;

            return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
        }

        function requestJson(url, signal, data) {
            if (!url) return Promise.resolve(null);

            var method = (ajax.method || 'GET').toUpperCase();
            var headers = ajax.headers || null;
            var credentials = ajax.credentials || 'same-origin';

            var finalUrl = url;
            var body = null;

            // Resolve data if function
            if (isFn(data)) {
                data = data();
            }

            if (isObj(data)) {

                // GET-like → append to URL
                if (method === 'GET' || method === 'HEAD') {

                    var u = new URL(finalUrl, window.location.origin);

                    Object.keys(data).forEach(function (key) {
                        var value = data[key];
                        if (value == null) return;

                        if (Array.isArray(value)) {
                            value.forEach(function (v) {
                                u.searchParams.append(key, String(v));
                            });
                        } else {
                            u.searchParams.set(key, String(value));
                        }
                    });

                    finalUrl = u.toString();
                }
                else {
                    // POST-like → body
                    body = new URLSearchParams();

                    Object.keys(data).forEach(function (key) {
                        var value = data[key];
                        if (value == null) return;

                        if (Array.isArray(value)) {
                            value.forEach(function (v) {
                                body.append(key, String(v));
                            });
                        } else {
                            body.append(key, String(value));
                        }
                    });
                }
            }

            // Prefer fetch
            if (isFn(window.fetch)) {

                var fetchOpts = {
                    method: method,
                    headers: headers || undefined,
                    credentials: credentials,
                    signal: signal || undefined
                };

                if (body) fetchOpts.body = body;

                return window.fetch(finalUrl, fetchOpts).then(function (r) {
                    if (!r.ok) {
                        var err = new Error('HTTP ' + r.status + ' ' + (r.statusText || ''));
                        err.status = r.status;
                        throw err;
                    }
                    return r.json();
                });
            }

            // XHR fallback
            return new Promise(function (resolve, reject) {

                var xhr = new XMLHttpRequest();
                xhr.open(method, finalUrl, true);
                xhr.responseType = 'json';

                if (isObj(headers)) {
                    for (var h in headers) {
                        xhr.setRequestHeader(h, String(headers[h]));
                    }
                }

                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else {
                        var err = new Error('HTTP ' + xhr.status + ' ' + (xhr.statusText || ''));
                        err.status = xhr.status;
                        err.response = xhr.response;
                        reject(err);
                    }
                };

                xhr.onerror = function () {
                    reject(new Error('XHR error'));
                };

                if (signal) {
                    signal.addEventListener('abort', function () {
                        try { xhr.abort(); } catch (e) {}
                        reject(new DOMException('Aborted', 'AbortError'));
                    }, { once: true });
                }

                xhr.send(body || null);
            });
        }

        return function ajaxLoad(payload) {
            payload = payload || {};
            var mode = payload.mode ? String(payload.mode) : 'query';

            var url = String(ajax.url || '');
            if (!url) return Promise.resolve({ options: [] });

            const resolveAjaxData = () => {
                if (!isFn(ajax.ajaxData)) return null;

                const ajaxData = ajax.ajaxData.call(instance, instance, payload || {});
                return isPlainObject(ajaxData) ? ajaxData : null;
            };

            var mapOpt = isFn(ajax.mapOption) ? function (it) { return ajax.mapOption.call(instance, it); } : defaultMapOption;

            // ----- MODE: query (normal search) -----
            const q = payload.query ?? '';
            const ajaxData = ajax.ajaxData ? resolveAjaxData(q) : null;

            // ----- MODE: ids (hydrate selected values) -----
            if (mode === 'ids') {
                var ids = Array.isArray(payload.ids) ? payload.ids : [];
                if (!ids.length) return Promise.resolve({ options: [] });

                var fullUrlIds = buildUrl({ [ajax.byIdsParam || 's'] : ids.join(ajax.byIdsDelimiter || ',')});

                return requestJson(fullUrlIds, payload.signal, ajaxData).then(function (json) {
                    if (json == null) return { options: [] };
                    return normalizeAjaxResponse(json, mapOpt);
                });
            }

            var min = (typeof ajax.queryMinChars === 'number') ? ajax.queryMinChars : cfg.minChars;
            if (q.length < min) return Promise.resolve({ options: [] });

            var fullUrlQuery = buildUrl({[ajax.queryParam || 'q'] : q });

            return requestJson(fullUrlQuery, payload.signal, ajaxData).then(function (json) {
                if (json == null) return { options: [] };
                return normalizeAjaxResponse(json, mapOpt);
            });
        };
    }

    class MicroEvent {

        constructor() {
            this._events = {};
        }

        on(event, fn) {
            if (!this._events) this._events = {};
            (this._events[event] ||= []).push(fn);
            return this;
        }

        off(event, fn) {
            const list = this._events?.[event];
            if (!list) return this;

            const i = list.indexOf(fn);
            if (i !== -1) list.splice(i, 1);
            return this;
        }

        _emit(event, ...args) {
            const list = this._events?.[event];
            if (!list) return;

            for (const fn of list) {
                fn.apply(this, args);
            }
            return this;
        }
    }

    // --------------------------------------------
    // TinySelectize class
    // --------------------------------------------

    class TinySelectize extends MicroEvent {
        constructor(element, config) {
            super();
            this.selectEl = typeof element === 'string' ? document.querySelector(element) : element?.jquery ? element[0] : element;

            if (!(this.selectEl instanceof HTMLSelectElement)) {
                throw new Error('TinySelectize: first argument must be a <select> or selector.');
            }

            if (this.selectEl.selectize) {
                console.warn('TinySelectize: element is already initialized.');
                throw new Error('TinySelectize: element is already initialized.');
            }


            const ds = this.selectEl.dataset;
            this.isMultiple = !!this.selectEl.multiple;
            this._uid = 'tsz_' + uid();
            this.selectEl.classList.add(CLASS_NAMES.SELECT);
            this._optgroups = new Map();

            this.config = mergeConfig(config || {});

            //this._handleAutoDetachMode();

            // Attach default URL loader if configured
            if (this.config.ajax && this.config.ajax.url && !this.config.load) {
                this.config.load = createAjaxLoader(this);
            }

            if (this.selectEl.dataset?.storedKey) {
                this.config.storageKey = this.selectEl.dataset.storedKey;
            }

            if (ds.allowEmptyOption != null) this.config.allowEmptyOption = ds.allowEmptyOption !== 'false';
            if (ds.noResultsMessage != null) this.config.i18n.noResults = ds.noResultsMessage;

            this._debouncedLoad = debouncePromise((payload) => this._invokeLoad(payload), this.config.loadThrottle);

            this.state = {
                open: false,
                loading: false,
                query: '',
                activeIndex: -1,
                remoteMap: new Map(),
                cache: new Map(),
                lastRequestId: 0,
                abortController: null,
                composing: false,
                inputTypingLocked: false,
                typeahead: {buffer: '', lastTs: 0}
            };

            this.items = [];
            this._rendered = [];
            this._visibleOptions = null;
            this._activeOptionEl = null;
            this._suppressFocusRefresh = false;
            this._selectMutationObserverDepth = 0;
            this._isDispatchingSelectChange = false;
            this._changePending = false;
            this._options = Object.create(null);
            this.options = this._options;
            this._resolvedDropdownParentForOpen = null;
            this._readyPromise = Promise.resolve(this);
            this._lastValuePromise = Promise.resolve(this);

            // Plugins (instance)
            this._plugins = this._initPlugins(this.config.plugins);

            this._build();
            this._bind();

            this._readyPromise = this._initializeDataPipeline();

            this._callPlugins('onInit', this);

            this.selectEl.selectize = this;
        }

        /**
         * Synchronizes supported select variants with the dropdown element.
         */
        _syncVariantClasses() {
            const dropdownEl = this.dropdown;
            const selectEl = this.selectEl;
            const SELECT_VARIANTS = ['select-striped'];
            SELECT_VARIANTS.forEach((className) => {
                dropdownEl.classList.toggle(
                    className.replace(/^select-/, 'tsz__dropdown--'),
                    selectEl.classList.contains(className)
                );
            });
        }
        /*
        _handleAutoDetachMode() {
            if (this.config.dropdownParent == 'auto-root') {
                var dialogRoot = this.selectEl.closest('.tiny-swal-popup,[role="dialog"][aria-modal="true"]');
                if (dialogRoot) {
                    this.config.dropdownParent = 'body';
                    // Make sure it stacks above the swal overlay/popup
                    this.config.dropdownZIndex = Math.max(Number(this.config.dropdownZIndex) || 0, 999999);
                } else
                    this.config.dropdownParent = null;
            }
        }*/

        // ----- Public API -----

        /* Returns a promise with (tsz) */
        val(nextValue, silent = false) {
            if (arguments.length === 0) {
                return this._getValueFromSelect();
            }

            this._lastValuePromise = this._whenReady(() => {
                return this._setValueAndSync(nextValue, silent, true);
            });

            return this._lastValuePromise;
        }

        addOption(input) {
            if (Array.isArray(input)) return this.addOptions(input);
            this._upsertOption(input, 'local');
            this._afterOptionsMutation();
            return this;
        }

        addOptions(list) {
            this._upsertOptions(list, 'local');
            this._afterOptionsMutation();
            return this;
        }

        addItem(value, silent = false) {
            if (Array.isArray(value)) return this.addItems(value, silent);
            return this.addItems([value], silent);
        }

        addItems(values, silent = false) {
            const wanted = this._normalizeValueInput(values);
            if (!wanted.length) return Promise.resolve(this);

            return this._whenReady(() => {
                return this._materializeSelection(wanted).then((resolved) => {
                    if (!resolved.length) return this;

                    const next = this.isMultiple
                        ? this._mergeValues(this.items, resolved)
                        : [resolved[0]];

                    return this._setValueAndSync(next, silent, true).then(() => {
                        this._setQuery('');
                        if (this.state.open) this.refreshOptions(true);
                        return this;
                    });
                });
            });
        }

        clearItems(silent = false) {
            return this._whenReady(() => this._clearSelection(silent).then(() => this));
        }

        clearOptions() {
            const selectedSet = new Set(this.items);
            const toRemove = [];
            const opts = this.selectEl.options;

            for (let i = 0; i < opts.length; i++) {
                const value = toStr(opts[i].value);
                if (value === '' && this.config.allowEmptyOption) continue;
                if (selectedSet.has(value)) continue;
                toRemove.push(opts[i]);
            }

            for (let i = 0; i < toRemove.length; i++) {
                this._removeOptionByValue(toStr(toRemove[i].value));
            }

            this._cleanupEmptyOptgroups();
            this.state.cache.clear();
            this._afterOptionsMutation();
            return this;
        }

        refreshItems() {
            this._syncFromSelect(true);
            return this;
        }

        refreshOptions(triggerDropdown = false) {
            return this._whenReady(() => this._refreshOptions(this._currentQuery()).then(() => {
                if (triggerDropdown) this.open();
                return this;
            }));
        }

        refresh(triggerDropdown = false) {
            return this._whenReady(() => {
                const preserved = this._normalizeValueInput(this._getValueFromSelect());

                this._resetRemoteState();

                return this._setValueAndSync(preserved, true, true)
                    .then(() => this._refreshOptions(this._currentQuery(), {
                        forceRemote: this._isAjaxMode()
                    }))
                    .then(() => {
                        if (triggerDropdown) this.open();
                        return this;
                    });
            });
        }

        updateOptions(data, triggerDropdown = false) {
            return this._whenReady(() => {
                const preserved = this._normalizeValueInput(this._getValueFromSelect());
                const normalized = this._normalizeOptionsList(Array.isArray(data) ? data : []);

                this.config.options = Array.isArray(data) ? data.slice() : [];
                this._resetRemoteState();
                this._replaceSelectOptions(normalized, { keepEmpty: true });
                this._rebuildOptionsMap();

                return this._setValueAndSync(preserved, true, true)
                    .then(() => this._refreshOptions(this._currentQuery(), {
                        forceRemote: this._isAjaxMode()
                    }))
                    .then(() => {
                        if (triggerDropdown) this.open();
                        return this;
                    });
            });
        }

        sync() {
            this._syncFromSelect(true, { refreshOptions: true });
            return this;
        }

        _writeSelectDisabled(disabled) {
            this._writingDisabledToSelect = true;

            try {
                this._withSelectMutationObserverSuppressed(() => {
                    this.selectEl.disabled = !!disabled;
                });
            } finally {
                this._writingDisabledToSelect = false;
            }
        }

        _applyDisabledState(disabled, opts = {}) {
            disabled = !!disabled;

            const {
                syncSelect = true
            } = opts;

            if (this.state.disabled === disabled) {
                if (syncSelect && this.selectEl.disabled !== disabled) {
                    this._writeSelectDisabled(disabled);
                }
                return this;
            }

            this.state.disabled = disabled;

            this.wrapper.classList.toggle(CLASS_NAMES.DISABLED, disabled);
            this.control.toggleAttribute('aria-disabled', disabled);
            this.inputEl.disabled = disabled;
            this.clearBtn.disabled = disabled;

            if (disabled) {
                this.close();
            }

            if (syncSelect && this.selectEl.disabled !== disabled) {
                this._writeSelectDisabled(disabled);
            }

            return this;
        }

        _syncDisabledFromSelect() {
            if (this._writingDisabledToSelect) return this;
            return this._applyDisabledState(this.selectEl.disabled, {
                syncSelect: false
            });
        }

        enable() {
            return this.disable(false);
        }
        disable(disabled = true) {
            return this._applyDisabledState(disabled);
        }

        clear() {
            this.clearItems();
            this.focus();
            return this;
        }

        clearStorage() {
            if (!this.config.storageKey) return this;

            try {
                localStorage.removeItem(this.config.storageKey);
            } catch (error) {
                // Storage can be unavailable in private or restricted contexts.
            }

            return this;
        }

        /**
         * Return the currently selected raw dataset object(s).
         *
         * Single-select:
         *   returns one raw object or null
         *
         * Multi-select:
         *   returns an array of raw objects
         *
         * @returns {object|object[]|null}
         */
        getSelectedOption() {
            var selected = this._getSelectedOptionObjects();

            if (this.isMultiple) {
                return selected.map(function (opt) {
                    return (opt && opt.raw != null) ? opt.raw : opt;
                });
            }

            if (!selected.length) return null;

            var first = selected[0];
            return (first && first.raw != null) ? first.raw : first;
        }

        open() {
            // Opening an already-open dropdown must be a strict no-op. In
            // particular, keyboard navigation must never close it while an
            // asynchronous refresh temporarily has no visible rows.
            if (this.state.open) return;

            const hasVisibleOptions = Array.isArray(this._visibleOptions) &&
                this._visibleOptions.length > 0;
            const hasVisibleStatus = this.statusEl.hidden === false &&
                this.statusEl.textContent !== '';

            // Do not open a closed dropdown when there is nothing meaningful
            // to display. Existing open state is intentionally never changed.
            if (!hasVisibleOptions && !hasVisibleStatus) return;

            this._resolvedDropdownParentForOpen = undefined;
            this.state.open = true;

            this.wrapper.classList.add(CLASS_NAMES.OPEN);
            this.control.setAttribute('aria-expanded', 'true');

            this._ensureDropdownParent();

            this._setDropdownVisibility(true);

            this._bindPlacementListeners();
            this._schedulePlacement();

            // restart animation each open
            this.dropdown.classList.remove(CLASS_NAMES.OPEN);
            // force reflow so animation can restart
            void this.dropdown.offsetWidth;
            this.dropdown.classList.add(CLASS_NAMES.OPEN);
            this.focus();
        }

        close(silent = false) {
            if (!this.state.open) return;
            this.state.open = false;
            this.state.activeIndex = -1;
            this._updateActiveOptionDom(false);

            this.wrapper.classList.remove(CLASS_NAMES.OPEN);
            this.control.setAttribute('aria-expanded', 'false');

            this.dropdown.classList.remove(CLASS_NAMES.OPEN);
            this._setDropdownVisibility(false);
            this.dropdown.classList.remove(CLASS_NAMES.DROPDOWN_UP);

            this._unbindPlacementListeners();

            if (this._dropdownParentEl?.dataset.tszOriginalPointerEvents != null) {
                this._dropdownParentEl.style.pointerEvents = this._dropdownParentEl.dataset.tszOriginalPointerEvents;
                delete this._dropdownParentEl.dataset.tszOriginalPointerEvents;
            }

            this._dropdownParentEl = null;
            this._dropdownMode = 'inline';
            this._dropdownIsDetached = false;
            this._resolvedDropdownParentForOpen = undefined;

            if (!silent)
                this._renderDropdown();
        }

        destroy() {
            this._callPlugins('onDestroy', this);

            this._unbind();
            this._unbindPlacementListeners();
            this._resolvedDropdownParentForOpen = undefined;

            if (this._mo) this._mo.disconnect();
            if (this.state.abortController) this.state.abortController.abort();

            // Ensure dropdown is returned to wrapper for clean removal
            if (this.dropdown && this.dropdown.parentElement && this.dropdown.parentElement !== this.wrapper) {
                this.wrapper.appendChild(this.dropdown);
            }

            this.selectEl.hidden = false;
            this.selectEl.removeAttribute('aria-hidden');

            if (this._originalLabelFor && this._labelEl) {
                this._labelEl.setAttribute('for', this._originalLabelFor);
            }

            this.wrapper.remove();

            if (this.selectEl.selectize === this) {
                delete this.selectEl.selectize;
            }
        }

        // ----- Plugin system -----

        _initPlugins(pluginsConfig) {
            var out = [];
            var cfg = isObj(pluginsConfig) ? pluginsConfig : {};
            for (var name in cfg) {
                if (!Object.prototype.hasOwnProperty.call(cfg, name)) continue;
                var enabled = cfg[name];
                if (enabled === false || enabled == null) continue;

                var factory = getPluginFactory(name);
                if (!factory) {
                    throw new Error('TinySelectize: unknown plugin "' + name + '". Register it via TinySelectize.definePlugin().');
                }
                var pluginOptions = (enabled === true) ? {} : enabled;
                var plugin = factory(pluginOptions);

                if (!isObj(plugin)) {
                    throw new Error('TinySelectize: plugin "' + name + '" factory must return an object.');
                }
                plugin.name = plugin.name || name;
                out.push(plugin);
            }
            return out;
        }

        _pluginCtx(extra) {
            var ctx = {
                instance: this,
                selectEl: this.selectEl,
                wrapper: this.wrapper,
                control: this.control,
                dropdown: this.dropdown,
                config: this.config,
                state: this.state,
                utils: {
                    uid: uid,
                    toStr: toStr,
                    isFn: isFn,
                    isObj: isObj
                }
            };
            if (isObj(extra)) {
                const keys = Object.keys(extra);
                for (let index = 0; index < keys.length; index++) {
                    const key = keys[index];
                    ctx[key] = extra[key];
                }
            }
            return ctx;
        }

        _callPlugins(hookName, arg) {
            for (var i = 0; i < this._plugins.length; i++) {
                var p = this._plugins[i];
                var fn = p && p[hookName];
                if (isFn(fn)) {
                    try {
                        fn.call(p, arg, this._pluginCtx({ hook: hookName }));
                    } catch (e) {
                        try { console.error('TinySelectize plugin hook error:', hookName, e); } catch (_) {}
                    }
                }
            }
        }

        _applyOptionRowMeta(row, opt) {
            // let plugins post-process the row
            if (!this._plugins) return;
            for (var i = 0; i < this._plugins.length; i++) {
                var p = this._plugins[i];
                if (isFn(p.onOptionRow)) {
                    p.onOptionRow(row, opt, this);
                }
            }
        }

        _applyTransformOptions(flatOptions, ctxExtra) {
            var out = flatOptions;
            var ctx = this._pluginCtx(ctxExtra || {});
            for (var i = 0; i < this._plugins.length; i++) {
                var p = this._plugins[i];
                if (p && isFn(p.transformOptions)) {
                    var next = p.transformOptions.call(p, out, ctx);
                    if (Array.isArray(next)) out = next;
                }
            }
            return out;
        }

        _applyDecorateRenderArgs(args, ctxExtra) {
            var out = args;
            var ctx = this._pluginCtx(ctxExtra || {});
            for (var i = 0; i < this._plugins.length; i++) {
                var p = this._plugins[i];
                if (p && isFn(p.decorateRenderArgs)) {
                    var next = p.decorateRenderArgs.call(p, out, ctx);
                    if (isObj(next)) out = next;
                }
            }
            return out;
        }

        _whenReady(task) {
            const run = () => isFn(task) ? task.call(this) : this;
            return Promise.resolve(this._readyPromise).then(run);
        }

        whenValueReady() {
            return this._lastValuePromise || Promise.resolve(this);
        }

        _initializeDataPipeline() {
            var hadPreset = this._hasPresetValue();

            this._bootstrapLocalSource();

            if (this.config.value != null) {
                return this._setValueAndSync(this.config.value, false, true);
            }

            if (!hadPreset && this.config.storageKey) {
                var stored = this._storageRead();
                if (stored != null) {
                    return this._setValueAndSync(stored, false, true);
                }
            }

            if (!this.isMultiple && this.config.allowEmptyOption === true && !hadPreset) {
                this._withSelectMutationObserverSuppressed(() => {
                    this.selectEl.selectedIndex = -1;
                });
            }

            this._syncFromSelect(false);

            if (this._isAjaxPreloadEnabled()) {
                return this._refreshOptions();
            }

            return Promise.resolve(this);
        }

        _bootstrapLocalSource() {
            this._rebuildOptionsMap();

            if (Array.isArray(this.config.options)) {
                this._materializeOptions(this.config.options, 'local');
            }

            this._rebuildOptionsMap();
        }

        _isAjaxMode() {
            return !!(this.config.ajax && this.config.ajax.url && isFn(this.config.load));
        }

        _isAjaxPreloadEnabled() {
            return this._isAjaxMode() && this.config.preload === 'init';
        }

        _normalizeOptionsList(list) {
            var out = [];
            var arr = Array.isArray(list) ? list : [];

            for (var i = 0; i < arr.length; i++) {
                var normalized = this._normalizeStoredOption(arr[i]);
                if (normalized) out.push(normalized);
            }

            return out;
        }

        _replaceSelectOptions(normalizedList, opts) {
            opts = opts || {};

            return this._withSelectMutationObserverSuppressed(() => {
                var keepEmpty = opts.keepEmpty !== false;
                var emptyOpt = null;

                if (keepEmpty) {
                    for (var i = 0; i < this.selectEl.options.length; i++) {
                        if (String(this.selectEl.options[i].value) === '') {
                            emptyOpt = this.selectEl.options[i];
                            break;
                        }
                    }
                }

                this.selectEl.textContent = '';
                if (emptyOpt) this.selectEl.appendChild(emptyOpt);

                for (var j = 0; j < normalizedList.length; j++) {
                    this._ensureOptionInSelect(normalizedList[j]);
                }
            });
        }

        _collectLocalOptions() {
            var out = [];
            var opts = this.selectEl.options;

            for (var i = 0; i < opts.length; i++) {
                var opt = opts[i];
                var group = '';
                if (opt.parentElement && opt.parentElement.tagName === 'OPTGROUP') group = opt.parentElement.label || '';

                var obj = {
                    value: toStr(opt.value),
                    label: (opt.textContent != null) ? opt.textContent : toStr(opt.value),
                    disabled: !!opt.disabled || (opt.parentElement && opt.parentElement.disabled === true),
                    group: group,
                    raw: opt.__tszRaw || null
                };

                if (this.config.searchField && obj.raw) obj._searchText = this._computeSearchText(obj);
                out.push(obj);
            }

            return out;
        }

        _getSourceOptions(payload) {
            payload = payload || {};
            var mode = payload.mode ? String(payload.mode) : 'query';
            var query = toStr(payload.query == null ? '' : payload.query).trim();
            var forceRemote = payload.forceRemote === true;
            var local = this._collectLocalOptions();
            var canLoadRemote = isFn(this.config.load) && (forceRemote || mode === 'ids' || this._isAjaxPreloadEnabled() || query.length >= this.config.minChars);

            if (!forceRemote && mode === 'query' && this.config.cache === true && this.state.cache.has(query)) {
                return Promise.resolve({
                    local: local,
                    remote: this.state.cache.get(query).slice(),
                    query: query,
                    mode: mode,
                    fromCache: true
                });
            }

            if (!canLoadRemote) {
                return Promise.resolve({ local: local, remote: [], query: query, mode: mode, fromCache: false });
            }

            return this._loadRemoteOptions({
                mode: mode,
                query: query,
                ids: Array.isArray(payload.ids) ? payload.ids.slice() : [],
                signal: payload.signal || null,
                selectEl: this.selectEl,
                instance: this
            }).then((res) => {
                var remote = Array.isArray(res && res.options) ? res.options : [];
                return {
                    local: local,
                    remote: remote,
                    query: query,
                    mode: mode,
                    fromCache: false
                };
            });
        }

        _loadRemoteOptions(payload) {
            return this._debouncedLoad(payload).then((res) => {
                var remote = this._normalizeOptionsList(res && res.options);

                for (var i = 0; i < remote.length; i++) {
                    this.state.remoteMap.set(remote[i].value, remote[i]);
                }

                if (payload.mode === 'query' && this.config.cache === true) {
                    this.state.cache.set(payload.query || '', remote.slice());
                }

                return { options: remote };
            });
        }



        _build() {
            this.selectEl.hidden = true;
            this.selectEl.setAttribute('aria-hidden', 'true');

            this.wrapper = document.createElement('div');
            this.wrapper.className = CLASS_NAMES.ROOT;
            this.wrapper.tabIndex = -1; // focusable but not in tab order
            this.wrapper.dataset.tszId = this._uid;

            if (this.isMultiple) this.wrapper.classList.add(CLASS_NAMES.MULTIPLE);
            if (this.config.showArrow) this.wrapper.classList.add(CLASS_NAMES.ARROW);

            this.control = document.createElement('div');
            this.control.className = CLASS_NAMES.CONTROL;
            this.control.setAttribute('role', 'combobox');
            this.control.setAttribute('aria-haspopup', 'listbox');
            this.control.setAttribute('aria-expanded', 'false');
            this.control.tabIndex = -1;

            this.inputEl = document.createElement('input');
            this.inputEl.className = CLASS_NAMES.INPUT;
            this.inputEl.type = 'text';
            this.inputEl.autocomplete = 'off';
            this.inputEl.spellcheck = false;
            this.inputEl.setAttribute('aria-autocomplete', 'list');

            this._isTypeaheadVisible = this.isMultiple || this.config.showTypeahead !== false;
            if (!this._isTypeaheadVisible) {
                this.inputEl.style.display = 'none';
                this.inputEl.tabIndex = -1;
                this.inputEl.setAttribute('aria-hidden', 'true');
                this.control.tabIndex = 0;
            }
            this._focusTarget = this._isTypeaheadVisible ? this.inputEl : this.control;

            this.clearBtn = document.createElement('button');
            this.clearBtn.type = 'button';
            this.clearBtn.className = CLASS_NAMES.CLEAR;
            this.clearBtn.textContent = '×';
            this.clearBtn.setAttribute('aria-label', 'Clear selection');
            this.clearBtn.tabIndex = -1;


            this.dropdown = document.createElement('div');
            this.dropdown.className = CLASS_NAMES.DROPDOWN;
            this.dropdown.dataset.tszId = this._uid;
            this.dropdown.tabIndex = -1;
            this._setDropdownVisibility(false);

            this.statusEl = document.createElement('div');
            this.statusEl.className = CLASS_NAMES.STATUS;
            this.statusEl.hidden = true;

            this.listEl = document.createElement('div');
            this.listEl.className = CLASS_NAMES.LIST;
            this.listEl.setAttribute('role', 'listbox');
            this.listEl.id = 'tsz_list_' + uid();
            this.listEl.tabIndex = -1;

            this.control.setAttribute('aria-controls', this.listEl.id);
            this.inputEl.setAttribute('aria-controls', this.listEl.id);

            this.dropdown.appendChild(this.statusEl);
            this.dropdown.appendChild(this.listEl);

            this.control.appendChild(this.inputEl);
            this.control.appendChild(this.clearBtn);

            this.wrapper.appendChild(this.control);
            this.wrapper.appendChild(this.dropdown);

            this.selectEl.insertAdjacentElement('afterend', this.wrapper);

            var ph = (this.config.placeholder != null && this.config.placeholder !== '')
                ? this.config.placeholder
                : (this.selectEl.getAttribute('placeholder') || this.selectEl.dataset.placeholder);
            if (ph) this.inputEl.placeholder = ph;

            var selectId = this.selectEl.id;
            if (selectId) {
                var label = document.querySelector('label[for="' + CSS.escape(selectId) + '"]');
                if (label) {
                    // Keep the label pointing at the actual keyboard focus target.
                    const focusTarget = this._focusTarget;
                    if (!focusTarget.id) focusTarget.id = this._uid + '_focus';
                    this._labelEl = label;
                    this._originalLabelFor = label.getAttribute('for');
                    label.setAttribute('for', focusTarget.id);
                }
            }

            if (this.config.defineWrapperValue === true) {
                Object.defineProperty(this.wrapper, 'value', {
                    configurable: true,
                    enumerable: false,
                    get: () => this.value,
                    set: (v) => { this.value = v; }
                });
            }
            this._syncVariantClasses();

            this._applyDisabledState(this.selectEl.disabled, { syncSelect: false});
        }

        // ----- Events -----

        _bind() {
            this._onDocMouseDown = (e) => {
                const path = e.composedPath ? e.composedPath() : [];
                const clickedInsideControl = path.includes(this.wrapper);
                const clickedInsideDropdown = path.includes(this.dropdown);
                // Right click inside the dropdown: keep it open so DevTools/context menu works.
                if (e.button === 2 && clickedInsideDropdown) return;
                if (!clickedInsideControl && !clickedInsideDropdown) this.close();
            };

            this._onControlMouseDown = (e) => {
                if (this.state.disabled) return;

                const target = e.target;

                if (!(target instanceof Element)) return;

                if (target.closest(CLASS_SELECTORS.CLEAR)) return;
                if (target.closest(CLASS_SELECTORS.REMOVE)) return;

                // Multiple chips are passive
                if (this.isMultiple && target.closest(CLASS_SELECTORS.PILL)) return;

                e.preventDefault();

                // Focusing dispatches focusin synchronously. Suppress its refresh here
                // because this mouse handler owns the open/refresh sequence.
                this._suppressFocusRefresh = true;
                try {
                    this.focus();
                } finally {
                    this._suppressFocusRefresh = false;
                }

                if (!this.state.open) {
                    this._refreshOptions(this._currentQuery()).then(() => {
                        this.open();
                    });
                }
            };

            this._onInput = () => {
                if (this.state.composing || this.state.disabled) return;
                const q = this.inputEl.value.trim();
                this.state.query = q;
                this._refreshOptions(q).then(() => {
                    this.open();
                });
            };

            this._onKeyDown = (e) => {
                this._handleKeyDown(e);
            };

            this._onBeforeInput = (e) => {
                if (!this.state.inputTypingLocked) return;
                const inputType = e.inputType || '';
                if (inputType.startsWith('insert') || inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
                    e.preventDefault();
                }
            };

            this._onListMouseDown = (e) => {
                // Right click → keep dropdown open
                if (e.button === 2) {
                    return;
                }
                const optEl = e.target.closest('[role="option"]');
                if (!optEl) return;
                e.preventDefault();
                this._chooseByIndex(Number(optEl.dataset.index));
            };

            this._onClearClick = (e) => {
                e.preventDefault();
                this.clear();
            };

            this._onSelectChange = () => {
                // Internal changes are synchronized once by the originating
                // operation after dispatch. External native changes still sync
                // immediately through this listener.
                if (this._isDispatchingSelectChange) return;
                this._syncFromSelect(true);
            };

            this._onCompositionStart = () => { this.state.composing = true; };
            this._onCompositionEnd = () => {
                this.state.composing = false;
                this._onInput();
            };

            this._onControlFocusOut = (e) => {
                const next = e.relatedTarget;
                if (next && (this.control.contains(next) || this.dropdown.contains(next))) return;
                this._discardUnmatchedQuery();
                this.close();
            };

            document.addEventListener('mousedown', this._onDocMouseDown);
            this.control.addEventListener('mousedown', this._onControlMouseDown);

            this._onControlFocusIn = (e) => {
                if (this.state.disabled || this._suppressFocusRefresh) return;

                if (this.dropdown.contains(e.target)) return;

                // Focus already inside control:
                // ignore focus transitions caused by mouse interactions
                if (this.control.contains(e.relatedTarget)) return;

                // Single mode respects openOnFocus
                if (!this.isMultiple && this.config.openOnFocus !== true) {
                    return;
                }

                // Multiple mode:
                // only input focus opens
                if (this.isMultiple && e.target !== this.inputEl) {
                    return;
                }

                if (!this.state.open) {
                    this._refreshOptions(this._currentQuery()).then(() => {
                        this.open();
                    });
                }
            };

            this.control.addEventListener('focusin', this._onControlFocusIn);
            this.control.addEventListener('focusout', this._onControlFocusOut);

            this.inputEl.addEventListener('beforeinput', this._onBeforeInput);
            this.inputEl.addEventListener('input', this._onInput);
            this.inputEl.addEventListener('compositionstart', this._onCompositionStart);
            this.inputEl.addEventListener('compositionend', this._onCompositionEnd);

            this.control.addEventListener('keydown', this._onKeyDown, true);

            this.listEl.addEventListener('mousedown', this._onListMouseDown);
            this.clearBtn.addEventListener('click', this._onClearClick);
            this.selectEl.addEventListener('change', this._onSelectChange);

            if (this.config.observeSelectMutations && typeof MutationObserver !== 'undefined') {
                this._mo = new MutationObserver((mutations) => {
                    this._handleSelectMutations(mutations);
                });
                this._mo.observe(this.selectEl, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                    attributes: true,
                    attributeFilter: ['disabled', 'selected', 'value', 'label']
                });
            }
        }

        _withSelectMutationObserverSuppressed(callback) {
            this._selectMutationObserverDepth += 1;

            try {
                return callback();
            } finally {
                this._selectMutationObserverDepth -= 1;

                // MutationObserver callbacks run asynchronously. Draining the
                // queued records here prevents TinySelectize's own DOM writes
                // from being mistaken for external select modifications.
                if (this._selectMutationObserverDepth === 0 && this._mo) {
                    this._mo.takeRecords();
                }
            }
        }

        _handleSelectMutations(mutations) {
            if (this._selectMutationObserverDepth > 0 || !mutations.length) return;

            let disabledChanged = false;
            let selectionChanged = false;
            let optionsChanged = false;

            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];
                const target = mutation.target;

                if (
                    mutation.type === 'attributes' &&
                    target === this.selectEl &&
                    mutation.attributeName === 'disabled'
                ) {
                    disabledChanged = true;
                    continue;
                }

                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    optionsChanged = true;
                    continue;
                }

                if (mutation.type !== 'attributes') continue;

                if (
                    target instanceof HTMLOptionElement &&
                    mutation.attributeName === 'selected'
                ) {
                    selectionChanged = true;
                    continue;
                }

                if (
                    target instanceof HTMLOptionElement ||
                    target instanceof HTMLOptGroupElement
                ) {
                    optionsChanged = true;
                }
            }

            if (disabledChanged) this._syncDisabledFromSelect();
            if (!selectionChanged && !optionsChanged) return;

            const activeValue = this._getActiveOptionValue();

            // Selection rendering is synchronous and does not require another
            // data load. A real option-source mutation refreshes only when the
            // dropdown is currently open.
            this._syncFromSelect(true, { renderDropdown: false });

            if (!this.state.open) return;

            if (optionsChanged) {
                this._refreshOptions(this._currentQuery());
                return;
            }

            this._renderDropdown(activeValue);
        }

        _unbind() {
            document.removeEventListener('mousedown', this._onDocMouseDown);
            this.control.removeEventListener('mousedown', this._onControlMouseDown);
            this.control.removeEventListener('focusin', this._onControlFocusIn);
            this.control.removeEventListener('focusout', this._onControlFocusOut);

            this.inputEl.removeEventListener('beforeinput', this._onBeforeInput);
            this.inputEl.removeEventListener('input', this._onInput);
            this.inputEl.removeEventListener('compositionstart', this._onCompositionStart);
            this.inputEl.removeEventListener('compositionend', this._onCompositionEnd);

            this.control.removeEventListener('keydown', this._onKeyDown, true);

            this.listEl.removeEventListener('mousedown', this._onListMouseDown);
            this.clearBtn.removeEventListener('click', this._onClearClick);
            this.selectEl.removeEventListener('change', this._onSelectChange);
        }

        // ----- Keyboard -----

        _handleKeyDown(e) {
            if (this.state.disabled) return;
            var key = e.key;

            if (this.state.inputTypingLocked && this._isPrintableKeyEvent(e)) {
                e.preventDefault();
                return;
            }

            if (key === 'Escape') { e.preventDefault(); this.close(); return; }

            if (key === 'ArrowDown') {
                e.preventDefault();
                this._navigateDropdown(1);
                return;
            }

            if (key === 'ArrowUp') {
                e.preventDefault();
                this._navigateDropdown(-1);
                return;
            }

            if (key === 'Enter') {
                e.preventDefault();

                if (this.state.open && this.state.activeIndex >= 0) {
                    this._chooseByIndex(this.state.activeIndex);
                } else {
                    this._discardUnmatchedQuery();
                    this.close();
                }
                return;
            }

            if (key === 'Backspace') {
                var isInputEmpty = this.inputEl.value === '';
                if (!isInputEmpty) return;

                if (this.isMultiple) {
                    var values = this._getValueFromSelect();
                    if (Array.isArray(values) && values.length) {
                        e.preventDefault();
                        values.pop();
                        this._setValueAndSync(values, false, true).then(() => {
                            this.focus();
                        });
                    }
                    return;
                }

                var value = this._getValueFromSelect();
                if (value != null && value !== '') {
                    e.preventDefault();
                    this.clear();
                }
                return;
            }

            if (!this.isMultiple) {
                var inputHidden = (this.inputEl.style.display === 'none');
                if (inputHidden) this._handleTypeaheadKey(e);
            }
        }

        _handleTypeaheadKey(e) {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.length !== 1) return;

            var now = Date.now();
            var ta = this.state.typeahead;
            var gap = now - (ta.lastTs || 0);

            if (gap > this.config.typeaheadResetMs) ta.buffer = '';
            ta.lastTs = now;

            ta.buffer += e.key;

            var q = ta.buffer.trim();
            if (!q) return;
            this.state.query = q;
            this._refreshOptions(q).then(() => {
                this.open();
            });
        }



        _isPrintableKeyEvent(e) {
            return !!(
                e &&
                typeof e.key === 'string' &&
                e.key.length === 1 &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.altKey
            );
        }

        _discardUnmatchedQuery() {
            this.state.query = '';
            this.inputEl.value = '';
        }

        _getActiveOptions() {
            return Array.isArray(this._visibleOptions) ? this._visibleOptions : this._getFlatRenderedOptions();
        }

        _getActiveOptionValue() {
            const activeOptions = this._getActiveOptions();
            const activeOption = activeOptions[this.state.activeIndex];
            return activeOption ? activeOption.value : null;
        }

        _findNextEnabledIndex(startIndex, delta) {
            const activeOptions = this._getActiveOptions();
            if (!activeOptions.length) return -1;

            let index = startIndex;

            // Start outside the range when no option is active so the first
            // movement lands on the first/last enabled option.
            if (index < 0) index = delta > 0 ? -1 : activeOptions.length;

            for (;;) {
                index += delta;

                if (index < 0 || index >= activeOptions.length) return -1;

                const option = activeOptions[index];
                if (option && option.disabled !== true) return index;
            }
        }

        _updateActiveOptionDom(scrollIntoView = false) {
            const previousActiveElement = this._activeOptionEl ||
                this.listEl.querySelector(CLASS_SELECTORS.OPTION_ACTIVE);

            if (previousActiveElement) {
                previousActiveElement.classList.remove(CLASS_NAMES.OPTION_ACTIVE);
            }

            this._activeOptionEl = null;
            this.control.removeAttribute('aria-activedescendant');

            if (this.state.activeIndex < 0) return;

            const activeElement = this.listEl.querySelector(
                '[data-index="' + this.state.activeIndex + '"]'
            );

            if (!activeElement) {
                this.state.activeIndex = -1;
                return;
            }

            if (!activeElement.id) {
                activeElement.id = this.listEl.id + '_option_' + this.state.activeIndex;
            }

            activeElement.classList.add(CLASS_NAMES.OPTION_ACTIVE);
            this.control.setAttribute('aria-activedescendant', activeElement.id);
            this._activeOptionEl = activeElement;

            if (scrollIntoView) {
                activeElement.scrollIntoView({ block: 'nearest' });
            }
        }

        _navigateDropdown(delta) {
            // When already open, move immediately and do not call open().
            // This avoids any interaction with loading/status guards.
            if (this.state.open) {
                this._moveActive(delta);
                return;
            }

            const moveAfterOpen = () => {
                if (this.state.disabled) return;
                this.open();
                if (this.state.open) this._moveActive(delta);
            };

            if (this._getActiveOptions().length) {
                moveAfterOpen();
                return;
            }

            // A closed dropdown may not have been rendered yet. Load once,
            // then open and apply the original keyboard movement.
            this._refreshOptions(this._currentQuery()).then(moveAfterOpen);
        }

        _moveActive(delta) {
            if (!this._getActiveOptions().length) return;

            const nextIndex = this._findNextEnabledIndex(
                this.state.activeIndex,
                delta
            );

            // Keep the current option when there is no enabled option
            // in the requested direction.
            if (nextIndex < 0) return;

            this.state.activeIndex = nextIndex;
            this._updateActiveOptionDom(true);
        }

        // ----- Query helpers -----

        _currentQuery() {
            return this.inputEl.value.trim();
        }

        _setQuery(q) {
            this.state.query = q || '';
            this.inputEl.value = this.state.query;
        }

        // ----- Data loading -----

        _invokeLoad(payload) {
            var fn = this.config.load;
            if (!isFn(fn)) return Promise.resolve({ options: [] });

            // Selectize-like: load(query, callback, payload)
            if (fn.length >= 2) {
                return new Promise((resolve, reject) => {
                    var done = false;
                    function callback(options) {
                        if (done) return;
                        done = true;
                        resolve({ options: Array.isArray(options) ? options : [] });
                    }
                    try {
                        // allow third arg for signal/selectEl/etc
                        var ret = fn.call(this, payload.query, callback, payload);
                        // if they returned a promise too, respect it
                        if (ret && isFn(ret.then)) {
                            ret.then(function () { callback([]); }).catch(reject);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            }

            // Modern signatures
            try {
                var out = fn.call(this, payload);
                if (out && isFn(out.then)) {
                    return out.then(function (v) {
                        if (Array.isArray(v)) return { options: v };
                        if (isObj(v) && Array.isArray(v.options)) return v;
                        return { options: [] };
                    });
                }
                if (Array.isArray(out)) return Promise.resolve({ options: out });
                if (isObj(out) && Array.isArray(out.options)) return Promise.resolve(out);
                return Promise.resolve({ options: [] });
            } catch (e) {
                return Promise.reject(e);
            }
        }

        /**
         * Normalize any option-like input into the canonical TinySelectize option shape.
         *
         * @param {object|string|number} input
         * @returns {object|null}
         */
        _normalizeStoredOption(input) {
            if (input == null) return null;

            var base = isObj(input)
                ? Object.assign({}, input)
                : { value: input, label: input };

            var vf = this.config.valueField || 'value';
            var lf = this.config.labelField || 'label';

            if (base.value == null && base[vf] != null) base.value = base[vf];
            if (base.label == null && base[lf] != null) base.label = base[lf];

            var value = toStr(base.value);
            if (value === '') return null;

            base.value = value;
            base.label = toStr(base.label != null ? base.label : base.value);
            base.disabled = !!base.disabled;
            base.group = (base.group != null) ? toStr(base.group) : '';

            if (!('raw' in base)) {
                base.raw = isObj(input) ? input : null;
            }

            if (this.config.searchField && base.raw) {
                base._searchText = this._computeSearchText(base);
            }

            return base;
        }

        /**
         * Store one normalized option in the canonical option map.
         *
         * @param {object|string|number} input
         * @returns {object|null}
         */
        _storeOptionEntry(input) {
            var normalized = this._normalizeStoredOption(input);
            if (!normalized) return null;

            this._options[normalized.value] = normalized;
            return normalized;
        }

        /**
         * Store a list of options in the canonical option map.
         *
         * @param {Array} list
         * @returns {Array<object>}
         */
        _storeOptionsList(list) {
            var out = [];
            var arr = Array.isArray(list) ? list : [];

            for (var i = 0; i < arr.length; i++) {
                var normalized = this._storeOptionEntry(arr[i]);
                if (normalized) out.push(normalized);
            }

            return out;
        }

        /**
         * Rebuild the canonical option map from current local DOM options and
         * already loaded remote options. Remote entries overwrite local ones
         * for the same value so richer hydrated data wins.
         */
        _rebuildOptionsMap() {
            this._options = Object.create(null);
            this.options = this._options;

            this._storeOptionsList(this._collectLocalOptions());

            this.state.remoteMap.forEach((opt) => {
                this._storeOptionEntry(opt);
            });
        }

        /**
         * Process flat options and update rendered dropdown items.
         *
         * @param {Array<object>} flatOptions
         * @param {string} query
         */
        _setRenderedFromFlat(flatOptions, query) {
            var prepared = this._prepareFlatOptions(flatOptions, query);
            this._setRenderedOptions(this._withGroups(prepared));
        }

        _refreshOptions(query = '', opts) {
            opts = opts || {};

            let normalizedQuery = this._normalizeSearchQuery(
                typeof query === 'string' ? query : this._currentQuery()
            );
            normalizedQuery = toStr(normalizedQuery).trim();

            if (this.state.abortController) {
                try {
                    this.state.abortController.abort();
                } catch (error) {
                    // Some custom AbortController implementations may throw
                    // after completion; a new request can still proceed.
                }
            }

            const abortController = typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;
            this.state.abortController = abortController;

            const requestId = ++this.state.lastRequestId;
            let loadError = null;

            this._setLoading(true);

            return this._getSourceOptions({
                mode: 'query',
                query: normalizedQuery,
                signal: abortController ? abortController.signal : null,
                forceRemote: opts.forceRemote === true
            })
                .then((sourceOptions) => {
                    if (requestId !== this.state.lastRequestId) return;

                    const mergedOptions = this._mergeByValue(
                        sourceOptions.local,
                        sourceOptions.remote
                    );
                    this._setRenderedFromFlat(mergedOptions, normalizedQuery);
                })
                .catch((error) => {
                    if (requestId !== this.state.lastRequestId) return;
                    if (
                        error &&
                        (error.name === 'AbortError' || error.name === 'Debounced')
                    ) {
                        return;
                    }

                    loadError = error;
                    this._setRenderedFromFlat(
                        this._collectLocalOptions(),
                        normalizedQuery
                    );

                    if (isFn(this.config.onError)) {
                        this.config.onError(error);
                    }
                })
                .finally(() => {
                    if (requestId !== this.state.lastRequestId) return;

                    this.state.abortController = null;
                    this._setLoading(false);

                    // Loading cleanup normally hides the status when options
                    // exist, so restore the actual error message afterwards.
                    if (loadError) {
                        this._setStatus(this.config.i18n.error);
                    }
                });
        }

        _computeSearchText(opt) {
            // Build searchable text from configured searchField(s) on raw objects.
            // Stored on opt._searchText to keep filtering fast.
            if (!isObj(opt)) return '';

            var sf = this.config.searchField;
            if (!sf) return '';

            var raw = opt.raw;
            if (!isObj(raw)) return '';

            var fields = Array.isArray(sf) ? sf : [sf];
            var parts = [];
            for (var i = 0; i < fields.length; i++) {
                var key = fields[i];
                if (!key) continue;
                var v = raw[key];
                if (v == null) continue;
                parts.push(String(v));
            }

            return parts.join(' ');
        }

        _normalizeOption(option) {
            const label = fold(option && option.label != null ? option.label : '');
            const value = fold(option && option.value != null ? option.value : '');
            const search = fold(option && option._searchText != null ? option._searchText : '');

            return {
                label,
                value,
                search,
                haystack: label + ' ' + value + ' ' + search
            };
        }

        _getFoldedSearchTokens(query) {
            // Search filtering must accept single-character queries. Highlight
            // thresholds only control visual markup and must not alter results.
            const tokens = this._getSearchTokens(query, {
                separateWordSearch: true,
                minTermLength: 1
            });
            if (!tokens.length) return [];

            return tokens.map(function (token) {
                return fold(token);
            });
        }



        /**
         * Decorate options once for the whole search pipeline.
         *
         * Each entry keeps:
         * - raw: original option object
         * - normalized: folded searchable fields
         *
         * This avoids recomputing fold()/haystack in both filter and sort.
         */
        _prepareSearchEntries(options) {
            const list = Array.isArray(options) ? options : [];

            return list.map((option) => {
                return {
                    raw: option,
                    normalized: this._normalizeOption(option)
                };
            });
        }

        _filterPreparedOptions(entries, foldedTokens) {
            if (!foldedTokens.length) return entries;

            return entries.filter(function (entry) {
                const haystack = entry.normalized.haystack;

                for (let i = 0; i < foldedTokens.length; i++) {
                    if (haystack.indexOf(foldedTokens[i]) === -1) {
                        return false;
                    }
                }

                return true;
            });
        }

        _sortPreparedByMatch(entries, foldedTokens) {
            if (!foldedTokens.length) return entries;

            function getMatchScore(normalized) {
                let score = 0;

                for (let i = 0; i < foldedTokens.length; i++) {
                    const token = foldedTokens[i];

                    if (normalized.label.indexOf(token) === 0) score += 8;
                    else if (normalized.label.indexOf(token) !== -1) score += 4;
                    else if (normalized.search.indexOf(token) !== -1) score += 2;
                    else if (normalized.value.indexOf(token) !== -1) score += 1;
                }

                return score;
            }

            return entries
                .map(function (entry) {
                    return {
                        raw: entry.raw,
                        normalized: entry.normalized,
                        score: getMatchScore(entry.normalized)
                    };
                })
                .sort(function (a, b) {
                    if (a.score !== b.score) {
                        return b.score - a.score;
                    }

                    return a.normalized.label.localeCompare(b.normalized.label);
                })
                .map(function (entry) {
                    return {
                        raw: entry.raw,
                        normalized: entry.normalized
                    };
                });
        }

        _prepareFlatOptions(flatOptions, q) {
            let out = Array.isArray(flatOptions) ? flatOptions : [];

            out = this._applyTransformOptions(out, { query: q });

            const hasLocalSearch = Array.isArray(this.config.searchField) ? this.config.searchField.length > 0 : !!this.config.searchField;

            if (!hasLocalSearch) {
                if (this.config.sortField) {
                    out = this._sortByFields(out);
                }
                return this._limitFlat(out);
            }

            if (!q) {
                if (this.config.sortField) {
                    out = this._sortByFields(out);
                }
                return this._limitFlat(out);
            }

            const foldedTokens = this._getFoldedSearchTokens(q);

            if (!foldedTokens.length) {
                if (this.config.sortField) {
                    out = this._sortByFields(out);
                }

                return this._limitFlat(out);
            }

            let entries = this._prepareSearchEntries(out);
            entries = this._filterPreparedOptions(entries, foldedTokens);

            if (this.config.sort === 'match') {
                entries = this._sortPreparedByMatch(entries, foldedTokens);
                out = entries.map(entry => entry.raw);
            } else {
                out = entries.map(entry => entry.raw);

                if (this.config.sortField) {
                    out = this._sortByFields(out);
                }
            }

            return this._limitFlat(out);
        }

        _sortByFields(options) {
            var sf = this.config.sortField;
            if (!sf) return options;

            var fields = Array.isArray(sf) ? sf : [sf];

            // stable: decorate with original index
            var decorated = options.map(function (o, idx) { return { o: o, i: idx }; });

            decorated.sort(function (a, b) {
                var ao = a.o, bo = b.o;

                for (var fi = 0; fi < fields.length; fi++) {
                    var key = fields[fi];
                    if (!key) continue;

                    // Prefer raw field, fallback to option object
                    var av = (ao && ao.raw && ao.raw[key] != null) ? ao.raw[key] : (ao && ao[key] != null ? ao[key] : null);
                    var bv = (bo && bo.raw && bo.raw[key] != null) ? bo.raw[key] : (bo && bo[key] != null ? bo[key] : null);

                    var na = Number(av);
                    var nb = Number(bv);
                    if (Number.isFinite(na) && Number.isFinite(nb) && na != nb) return na - nb;

                    var sa = toStr(av).toLowerCase();
                    var sb = toStr(bv).toLowerCase();
                    if (sa !== sb) return sa.localeCompare(sb);
                }

                return a.i - b.i;
            });

            return decorated.map(function (d) { return d.o; });
        }


        _mergeByValue(primary, secondary) {
            var seen = new Set(primary.map(function (o) { return o.value; }));
            var merged = primary.slice();
            for (var i = 0; i < secondary.length; i++) {
                var o = secondary[i];
                if (!seen.has(o.value)) {
                    merged.push(o);
                    seen.add(o.value);
                }
            }
            return merged;
        }

        _limitFlat(flatOptions) { return flatOptions.slice(0, this.config.maxOptions); }

        _resolveGroupKey(opt) {
            // Prefer explicit `opt.group`
            if (opt && opt.group != null && opt.group !== '') return String(opt.group);

            // Otherwise use raw + optgroupField
            var f = this.config.optgroupField;
            if (!f) return '';
            if (!opt || !isObj(opt.raw)) return '';

            var v = opt.raw[f];
            return (v == null || v === '') ? '' : String(v);
        }

        registerOptgroup(groupKey) {
            this._getOrCreateOptgroup(groupKey);
            return this;
        }

        _getOrCreateOptgroup(groupKey) {
            var key = (groupKey == null) ? '' : String(groupKey);
            if (!key) return null;

            if (this._optgroups.has(key)) return this._optgroups.get(key);

            var reg = this.config.optionGroupRegister;
            var g;

            if (isFn(reg)) {
                // allow string or object return
                var out = reg.call(this, key, { selectEl: this.selectEl, instance: this, config: this.config });
                if (isObj(out)) {
                    g = out;
                } else {
                    g = {};
                    g[this.config.optgroupValueField] = key;
                    g[this.config.optgroupLabelField] = String(out == null ? key : out);
                }
            } else {
                // default label = groupKey
                g = {};
                g[this.config.optgroupValueField] = key;
                g[this.config.optgroupLabelField] = key;
            }

            // Ensure required fields exist
            if (g[this.config.optgroupValueField] == null) g[this.config.optgroupValueField] = key;
            if (g[this.config.optgroupLabelField] == null) g[this.config.optgroupLabelField] = key;

            this._optgroups.set(key, g);
            return g;
        }

        _withGroups(flatOptions) {
            var items = [];
            var lastGroupKey = null;

            for (var i = 0; i < flatOptions.length; i++) {
                var o = flatOptions[i];

                var groupKey = this._resolveGroupKey(o); // '' means no group

                if (groupKey !== lastGroupKey) {
                    if (groupKey) {
                        var grp = this._getOrCreateOptgroup(groupKey);
                        var label = grp ? String(grp[this.config.optgroupLabelField]) : String(groupKey);
                        items.push({ type: 'group', key: groupKey, label: label });
                    }
                    lastGroupKey = groupKey;
                }

                items.push({ type: 'option', option: o });
            }

            return items;
        }

        _setRenderedOptions(renderItems) {
            // Preserve the keyboard target by value because an asynchronous
            // refresh may reorder the list while the user is navigating it.
            const activeValue = this.state.open
                ? this._getActiveOptionValue()
                : null;

            this._rendered = Array.isArray(renderItems) ? renderItems : [];
            this.state.activeIndex = -1;
            this._visibleOptions = null;
            this.wrapper.classList.remove(CLASS_NAMES.IS_FULL);
            this.wrapper.classList.toggle(
                CLASS_NAMES.HAS_OPTIONS,
                this._rendered.length > 0
            );
            this._renderDropdown(activeValue);
        }

        _getFlatRenderedOptions() {
            var out = [];
            for (var i = 0; i < this._rendered.length; i++) {
                if (this._rendered[i].type === 'option') out.push(this._rendered[i].option);
            }
            return out;
        }

        // ----- Status -----

        _setLoading(isLoading) {
            const loading = isLoading === true;

            this.state.loading = loading;
            this.wrapper.classList.toggle(CLASS_NAMES.LOADING, loading);
            this.control.setAttribute('aria-busy', String(loading));

            if (loading && this.config.showLoadingTextInDropdown === true) {
                this._setStatus(this.config.i18n.loading);
                return;
            }

            if (loading) {
                this.statusEl.hidden = true;
                this.statusEl.textContent = '';
                return;
            }

            this._clearStatusIfNeeded();
        }

        _setStatus(text) {
            this.statusEl.textContent = text;
            this.statusEl.hidden = false;
        }

        _clearStatusIfNeeded() {
            var flat = this._getActiveOptions();
            if (!flat.length) this._setStatus(this.config.i18n.noResults);
            else {
                this.statusEl.hidden = true;
                this.statusEl.textContent = '';
            }
        }

        // ----- Render -----

        _renderDropdown(preferredActiveValue) {
            const activeValue = preferredActiveValue === undefined
                ? this._getActiveOptionValue()
                : preferredActiveValue;

            this.listEl.textContent = '';
            this._activeOptionEl = null;
            this._visibleOptions = [];

            if (this.state.loading) {
                if (this.config.showLoadingTextInDropdown === true) {
                    this._setStatus(this.config.i18n.loading);
                } else {
                    this.statusEl.hidden = true;
                    this.statusEl.textContent = '';
                }
            } else {
                this.statusEl.hidden = true;
                this.statusEl.textContent = '';
            }

            const selected = this._getValueFromSelect();
            const selectedValues = Array.isArray(selected)
                ? selected
                : (selected ? [selected] : []);
            const selectedSet = new Set(selectedValues);
            const fragment = document.createDocumentFragment();

            // A group header is appended only when its first visible option
            // is appended, preventing empty optgroups in the dropdown.
            let pendingGroupElement = null;

            for (let index = 0; index < this._rendered.length; index++) {
                const renderItem = this._rendered[index];

                if (renderItem.type === 'group') {
                    pendingGroupElement = document.createElement('div');
                    pendingGroupElement.className = CLASS_NAMES.OPTGROUP;
                    pendingGroupElement.setAttribute('role', 'presentation');
                    pendingGroupElement.textContent = renderItem.label;
                    continue;
                }

                const option = renderItem.option;

                if (option.value === '' && !this.config.showEmptyOption) continue;
                if (
                    !this.config.showSelectedInDropdown &&
                    selectedSet.has(option.value) &&
                    option.value !== ''
                ) {
                    continue;
                }

                if (pendingGroupElement) {
                    fragment.appendChild(pendingGroupElement);
                    pendingGroupElement = null;
                }

                const optionIndex = this._visibleOptions.length;
                this._visibleOptions.push(option);

                const optionElement = document.createElement('div');
                optionElement.className = CLASS_NAMES.OPTION;
                optionElement.setAttribute('role', 'option');
                optionElement.setAttribute('data-index', String(optionIndex));
                optionElement.setAttribute(
                    'aria-selected',
                    selectedSet.has(option.value) ? 'true' : 'false'
                );

                if (option.disabled === true) {
                    optionElement.classList.add(CLASS_NAMES.OPTION_DISABLED);
                    optionElement.setAttribute('aria-disabled', 'true');
                }

                optionElement.appendChild(
                    this._renderOptionNode(option, this.state.query)
                );

                this._applyOptionRowMeta(optionElement, option);
                fragment.appendChild(optionElement);
            }

            this.listEl.appendChild(fragment);

            // Filtering can hide every rendered option (for example when
            // selected values are excluded), so status depends on the final
            // visible list rather than the pre-filtered source list.
            if (!this.state.loading && this._visibleOptions.length === 0) {
                this._setStatus(this.config.i18n.noResults);
            }

            let restoredActiveIndex = -1;

            if (activeValue !== null) {
                for (let index = 0; index < this._visibleOptions.length; index++) {
                    const option = this._visibleOptions[index];
                    if (
                        option.value === activeValue &&
                        option.disabled !== true
                    ) {
                        restoredActiveIndex = index;
                        break;
                    }
                }
            }

            // With exactly one selectable result, make it active so Enter
            // validates the only possible choice without selecting it silently.
            if (restoredActiveIndex < 0) {
                let onlySelectableIndex = -1;

                for (let index = 0; index < this._visibleOptions.length; index++) {
                    if (this._visibleOptions[index].disabled === true) continue;

                    if (onlySelectableIndex >= 0) {
                        onlySelectableIndex = -1;
                        break;
                    }

                    onlySelectableIndex = index;
                }

                restoredActiveIndex = onlySelectableIndex;
            }

            this.state.activeIndex = restoredActiveIndex;
            this._updateActiveOptionDom(false);

            this.wrapper.classList.toggle(
                CLASS_NAMES.IS_FULL,
                this.isMultiple &&
                !this.state.loading &&
                this._visibleOptions.length === 0
            );

            if (this.state.open) this._schedulePlacement();
        }

        _renderSelection() {
            var selectedObjs = this._getSelectedOptionObjects();

            // remove old pills
            var existing = this.control.querySelectorAll(this.isMultiple ? CLASS_SELECTORS.PILL : CLASS_SELECTORS.ITEM);
            for (var i = 0; i < existing.length; i++) existing[i].remove();

            var beforeNode = this.inputEl; // insert pills before input
            if (!this.isMultiple) {
                var one = selectedObjs[0];
                if (one) {
                    var item = this._renderItemNode(one);
                    // wrap in a pill-like container if you want consistent styling
                    var pill = document.createElement('span');
                    pill.className = CLASS_NAMES.ITEM;
                    pill.appendChild(item);
                    this.control.insertBefore(pill, beforeNode);
                }
            } else {
                for (var j = 0; j < selectedObjs.length; j++) {
                    var opt = selectedObjs[j];

                    var pill2 = document.createElement('span');
                    pill2.className = CLASS_NAMES.PILL;

                    pill2.appendChild(this._renderItemNode(opt));

                    var rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = CLASS_NAMES.REMOVE;
                    rm.textContent = '×';
                    rm.setAttribute('aria-label', 'Remove ' + opt.label);

                    var self = this;
                    (function (value) {
                        rm.addEventListener('mousedown', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        });
                        rm.addEventListener('click', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            self._removeValue(value);
                        });
                    }(opt.value));

                    pill2.appendChild(rm);
                    this.control.insertBefore(pill2, beforeNode);
                }
            }

            var hasSelection = selectedObjs.length > 0;
            this.wrapper.classList.toggle(CLASS_NAMES.HAS_ITEMS, hasSelection);
            this.clearBtn.hidden = !hasSelection || this.config.showClearButton === false;
        }

        _normalizeSearchQuery(query) {
            return toStr(query).trim().replace(/^#\s*(\d+)$/, '$1').replace(/\s+/g, ' ');
        }

        _getSearchTokens(query, options = {}) {
            const normalized = toStr(query);
            if (!normalized) return [];

            const separateWordSearch = options.separateWordSearch !== false;
            const minTermLength = Number(options.minTermLength || 1);

            let parts = separateWordSearch ? normalized.split(' ') : [normalized];

            const seen = new Set();
            const tokens = [];

            for (let i = 0; i < parts.length; i++) {
                const token = toStr(parts[i]).trim();
                if (!token || token.length < minTermLength) continue;

                const folded = fold(token);
                if (seen.has(folded)) continue;

                seen.add(folded);
                tokens.push(token);
            }

            tokens.sort((a, b) => b.length - a.length);
            return tokens;
        }

        _buildHighlightRegexFromTokens(tokens) {
            if (!Array.isArray(tokens) || !tokens.length) return null;
            return new RegExp('(' + tokens.map(escapeRegex).join('|') + ')', 'gi');
        }

        _getHighlightRegex(query) {
            const cfg = this.config.highlight || {};
            const tokens = this._getSearchTokens(query, cfg);
            return this._buildHighlightRegexFromTokens(tokens);
        }

        _applyInternalHighlight(element, query) {
            if (!(element instanceof Element)) return element;

            const cfg = this.config.highlight || {};
            if (cfg.enabled === false) return element;

            const tokens = this._getSearchTokens(query, cfg);
            if (!tokens.length) return element;

            this._highlightElementTextNodes(element, tokens, cfg.className);

            return element;
        }

        _highlightElementTextNodes(root, tokens, className) {
            if (!(root instanceof Element) || !Array.isArray(tokens) || !tokens.length) {
                return root;
            }

            const foldedTokens = tokens
                .map(token => fold(token))
                .filter(Boolean)
                .sort((a, b) => b.length - a.length);

            if (!foldedTokens.length) {
                return root;
            }

            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {
                        const parent = node.parentNode;

                        if (!parent || !node.nodeValue || !node.nodeValue.trim()) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        if (parent.nodeType !== 1) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        if (parent.classList && (
                            parent.classList.contains(className) ||
                            parent.classList.contains(CLASS_NAMES.NO_HIGHLIGHT)
                        )) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        const foldedText = fold(node.nodeValue);

                        for (let i = 0; i < foldedTokens.length; i++) {
                            if (foldedText.indexOf(foldedTokens[i]) !== -1) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }

                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );

            const textNodes = [];
            let currentNode = null;

            while ((currentNode = walker.nextNode())) {
                textNodes.push(currentNode);
            }

            for (let i = 0; i < textNodes.length; i++) {
                const textNode = textNodes[i];
                const text = textNode.nodeValue;

                const matches = this._getFoldedTextMatches(text, foldedTokens);
                if (!matches.length) {
                    continue;
                }

                const fragment = document.createDocumentFragment();
                let lastIndex = 0;

                for (let j = 0; j < matches.length; j++) {
                    const match = matches[j];
                    const start = match.start;
                    const end = match.end;

                    if (start > lastIndex) {
                        fragment.appendChild(
                            document.createTextNode(text.slice(lastIndex, start))
                        );
                    }

                    const span = document.createElement('mark');
                    if (className) span.className = className;
                    span.textContent = text.slice(start, end);
                    fragment.appendChild(span);

                    lastIndex = end;
                }

                if (lastIndex < text.length) {
                    fragment.appendChild(
                        document.createTextNode(text.slice(lastIndex))
                    );
                }

                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            }

            return root;
        }

        _getFoldedIndexMap(text) {
            const original = toStr(text);
            const map = [];
            let foldedText = '';

            for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                const foldedChar = ch
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase();

                for (let j = 0; j < foldedChar.length; j++) {
                    foldedText += foldedChar[j];
                    map.push(i);
                }
            }

            return {
                original,
                foldedText,
                map
            };
        }

        _getFoldedTextMatches(text, foldedTokens) {
            const data = this._getFoldedIndexMap(text);
            const foldedText = data.foldedText;
            const map = data.map;

            const ranges = [];

            for (let i = 0; i < foldedTokens.length; i++) {
                const token = foldedTokens[i];
                if (!token) continue;

                let fromIndex = 0;

                while (fromIndex < foldedText.length) {
                    const idx = foldedText.indexOf(token, fromIndex);
                    if (idx === -1) break;

                    const start = map[idx];
                    const endFoldedIndex = idx + token.length - 1;
                    const end = map[endFoldedIndex] + 1;

                    ranges.push({ start, end });
                    fromIndex = idx + token.length;
                }
            }

            if (!ranges.length) {
                return [];
            }

            ranges.sort((a, b) => a.start - b.start || a.end - b.end);

            const merged = [ranges[0]];

            for (let i = 1; i < ranges.length; i++) {
                const prev = merged[merged.length - 1];
                const cur = ranges[i];

                if (cur.start <= prev.end) {
                    prev.end = Math.max(prev.end, cur.end);
                } else {
                    merged.push(cur);
                }
            }

            return merged;
        }

        /**
         * Common base for rendering option/item nodes.
         * Keeps the same control-flow style as your original code:
         * - build `node`
         * - normalize Node|string
         * - return `node` at the end (no early returns)
         *
         * @param {object} opt - normalized option { value,label,raw,_meta,... }
         * @param {object} args - render args already decorated
         * @param {Function|null|undefined} renderer - render function (raw, escape, args) => Node|string
         * @param {string} fallbackClass - span class when renderer missing or string fallback
         * @param {string} fallbackText - text when renderer missing
         */
        _renderNodeBase(opt, args, renderer, fallbackClass, fallbackText, query) {
            const highlightEnabled = this.config.highlight?.enabled !== false;
            const hasQuery = !!toStr(query).trim();

            let node;

            if (isFn(renderer)) {
                node = renderer.call(this, opt?.raw, escapeHtml, args);

                if (!(node instanceof Node)) {
                    const s = toStr(node);

                    // Auto-detect HTML strings
                    if (looksLikeHtml(s)) {
                        node = htmlToNode(s);
                    } else {
                        node = document.createElement('span');
                        node.className = fallbackClass;
                        node.textContent = s;
                    }
                }
            } else {
                node = document.createElement('span');
                node.className = fallbackClass;
                node.textContent = toStr(fallbackText);
            }

            if (highlightEnabled && hasQuery && node instanceof Element) {
                this._applyInternalHighlight(node, query);
            }

            return node;
        }

        _renderCommonNode(opt, renderer, fallbackClass, query) {
            const { raw, _meta, _searchText, isRemote, ...option } = opt;
            let args = { option, query, meta: _meta, raw };
            args = this._applyDecorateRenderArgs(args, query != null ? { query } : {});

            return this._renderNodeBase(
                opt,
                args,
                renderer,
                fallbackClass,
                opt?.label,
                query
            );
        }

        _renderOptionNode(opt, query) {
            return this._renderCommonNode(
                opt,
                this.config.render?.option,
                CLASS_NAMES.OPTION_LABEL,
                query
            );
        }

        _renderItemNode(opt) {
            return this._renderCommonNode(
                opt,
                this.config.render?.item,
                CLASS_NAMES.ITEM_LABEL
            );
        }

        // ----- Sync -----


        _syncItemsState() {
            const current = this._getValueFromSelect();
            this.items = this.isMultiple
                ? current
                : ((current != null && current !== '') ? [current] : []);
        }

        _syncInputTypingLockedState() {
            const shouldLock = !this.isMultiple && this.items.length > 0;
            this.state.inputTypingLocked = shouldLock;
            this.wrapper.classList.toggle(CLASS_NAMES.INPUT_LOCKED, shouldLock);
            this.inputEl.classList.toggle(CLASS_NAMES.INPUT_LOCKED_ELEMENT, shouldLock);
            if (shouldLock) this._discardUnmatchedQuery();
        }

        _syncFromSelect(preserveQuery, options = {}) {
            const activeValue = this._getActiveOptionValue();
            const shouldRenderDropdown = options.renderDropdown !== false;
            const shouldRefreshOptions = options.refreshOptions === true;

            this._rebuildOptionsMap();
            this._syncItemsState();
            this._renderSelection();
            this._syncInputTypingLockedState();

            if (!preserveQuery) this._setQuery('');
            if (!this.state.open) return;

            if (shouldRefreshOptions) {
                this._refreshOptions(this._currentQuery());
                return;
            }

            if (shouldRenderDropdown) this._renderDropdown(activeValue);
        }

        _getValueFromSelect() {
            if (this.isMultiple) {
                var out = [];
                var selected = this.selectEl.selectedOptions;
                for (var i = 0; i < selected.length; i++) {
                    if (selected[i].value !== '') out.push(toStr(selected[i].value));
                }
                return out;
            }

            if (this.selectEl.selectedIndex < 0) return null;

            var v = this.selectEl.value;
            return v === '' ? null : toStr(v);
        }

        _normalizeValueInput(nextValue) {
            if (this.isMultiple) {
                if (Array.isArray(nextValue)) {
                    return nextValue.map(toStr).filter(Boolean);
                }

                return toStr(nextValue == null ? '' : nextValue)
                    .split(this.config.delimiter)
                    .map((s) => s.trim())
                    .filter(Boolean);
            }

            const v = (nextValue == null) ? '' : toStr(nextValue);
            return v ? [v] : [];
        }

        _mergeValues(baseValues, additionalValues) {
            const next = Array.isArray(baseValues) ? baseValues.slice() : [];
            const add = Array.isArray(additionalValues) ? additionalValues : [];

            for (let i = 0; i < add.length; i++) {
                if (!next.includes(add[i])) next.push(add[i]);
            }

            return next;
        }

        _setValueAndSync(nextValue, silent = false, preserveQuery = true) {
            return this._materializeSelection(nextValue).then((values) => {
                return this._applySelectionToSelect(values, { silent: silent });
            }).then(() => {
                this._syncFromSelect(preserveQuery);
                return this;
            });
        }



        _clearSelection(silent = false, preserveQuery = false) {
            if (this.isMultiple) {
                return this._setValueToSelect([], silent).then(() => {
                    this._setQuery('');
                    this.close();
                    this._syncFromSelect(preserveQuery);
                    return this;
                });
            }

            this._clearSingleSelection();
            if (!silent) this._dispatchSelectChange();
            this._setQuery('');
            this.close();
            this._syncFromSelect(preserveQuery);
            return Promise.resolve(this);
        }

        _setValueToSelect(nextValue, silent = false) {
            return this._materializeSelection(nextValue)
                .then((values) => this._applySelectionToSelect(values, { silent: silent }));
        }

        _clearSingleSelection() {
            this._withSelectMutationObserverSuppressed(() => {
                // Force a "no selection" state without creating an <option value="">
                var opts = this.selectEl.options;
                for (var i = 0; i < opts.length; i++) {
                    opts[i].selected = false;
                }

                // selectedIndex=-1 is the only real DOM representation of "nothing selected"
                this.selectEl.selectedIndex = -1;

                // Defensive: ensure value reads as empty in some UAs
                try { this.selectEl.value = ''; } catch (e) {}
            });
        }

        _loadByIds(ids, signal) {
            return this._loadRemoteOptions({
                mode: 'ids',
                ids: Array.isArray(ids) ? ids.map(String) : [],
                query: '',
                signal: signal || null,
                selectEl: this.selectEl,
                instance: this
            });
        }

        _materializeSelection(nextValue) {
            const wanted = this._normalizeValueInput(nextValue);
            if (!wanted.length) return Promise.resolve([]);

            const missing = [];
            for (let i = 0; i < wanted.length; i++) {
                const value = wanted[i];
                if (!this._hasOptionValue(value) && !this.state.remoteMap.has(value)) {
                    missing.push(value);
                }
            }

            if (missing.length && this._isAjaxMode()) {
                return this._loadByIds(missing, null).then((res) => {
                    var hydrated = Array.isArray(res && res.options) ? res.options : [];
                    this._materializeOptions(hydrated, 'remote');
                    return this._ensureMaterializedValues(wanted);
                });
            }

            return Promise.resolve(this._ensureMaterializedValues(wanted));
        }

        _applySelectionToSelect(valuesArray, opts) {
            opts = opts || {};
            const silent = opts.silent === true;
            const wantedArr = Array.isArray(valuesArray) ? valuesArray.map(toStr) : [];
            const wanted = new Set(wantedArr);
            const optionEls = this.selectEl.options;

            this._withSelectMutationObserverSuppressed(() => {
                for (let i = 0; i < optionEls.length; i++) {
                    optionEls[i].selected = wanted.has(toStr(optionEls[i].value));
                }

                if (!this.isMultiple && wantedArr.length === 0) {
                    this.selectEl.selectedIndex = -1;
                }
            });

            if (!silent) this._dispatchSelectChange();
            return Promise.resolve({ silent: silent });
        }

        _ensureMaterializedValues(values) {
            const wanted = Array.isArray(values) ? values.map(toStr) : [];
            const resolved = [];
            let didInsert = false;

            for (let i = 0; i < wanted.length; i++) {
                const value = wanted[i];
                if (this._hasOptionValue(value)) {
                    resolved.push(value);
                    continue;
                }

                const remote = this.state.remoteMap.get(value);
                if (!remote) continue;

                this._ensureOptionInSelect(remote, 'remote');
                didInsert = true;
                resolved.push(value);
            }

            if (didInsert) this._rebuildOptionsMap();
            return resolved;
        }

        _materializeOptions(list, source = 'local') {
            var normalizedList = this._normalizeOptionsList(list);
            for (var i = 0; i < normalizedList.length; i++) {
                this._ensureOptionInSelect(normalizedList[i], source);
            }
            this._rebuildOptionsMap();
            return normalizedList;
        }

        _hasPresetValue() {
            var v = this._getValueFromSelect();
            if (this.isMultiple) return Array.isArray(v) && v.length > 0;
            return v != null && v !== '';
        }

        _resetRemoteState() {
            this.state.cache.clear();
            this.state.remoteMap.clear();

            if (this.state.abortController) {
                try {
                    this.state.abortController.abort();
                } catch (e) {}
            }

            this.state.abortController = null;
        }

        _storageRead() {
            try {
                var raw = localStorage.getItem(this.config.storageKey);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        }

        _storageWrite(v) {
            try {
                // If empty → remove
                var isEmpty = this.isMultiple ? (!Array.isArray(v) || v.length === 0) : (v == null || v === '');
                if (isEmpty) {
                    localStorage.removeItem(this.config.storageKey);
                    return;
                }
                localStorage.setItem(this.config.storageKey, JSON.stringify(v));
            } catch (e) {
                // ignore quota/security errors
            }
        }

        _dispatchSelectChange() {
            this._isDispatchingSelectChange = true;

            try {
                this.selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            } finally {
                this._isDispatchingSelectChange = false;
            }

            const value = this._getValueFromSelect();
            this._emit('change', value);
            if (isFn(this.config.onChange)) {
                this.config.onChange.call(this, value, this.selectEl);
            }
            if (this.config.storageKey) {
                this._storageWrite(value);
            }
        }

        /**
         * Focus the TinySelectize control.
         *
         * @param {boolean} [open=false] Open the dropdown after focusing.
         * @returns {TinySelectize}
         */
        focus(open = false) {
            const focusTarget = this._focusTarget || this.inputEl;

            focusTarget.focus();

            if (focusTarget === this.inputEl && this.inputEl.setSelectionRange) {
                const len = this.inputEl.value.length;
                this.inputEl.setSelectionRange(len, len);
            }

            if (open) {
                this.open();
            }

            return this;
        }

        _hasOptionValue(value) {
            var v = toStr(value);
            var opts = this.selectEl.options;
            for (var i = 0; i < opts.length; i++) {
                if (toStr(opts[i].value) === v) return true;
            }
            return false;
        }

        _findOptionElByValue(value) {
            var v = toStr(value);
            var opts = this.selectEl.options;
            for (var i = 0; i < opts.length; i++) {
                if (toStr(opts[i].value) === v) return opts[i];
            }
            return null;
        }

        _ensureSelectOptgroup(groupKey) {
            if (!groupKey) return null;

            var groupObj = this._getOrCreateOptgroup(groupKey);
            var label = groupObj ? String(groupObj[this.config.optgroupLabelField] || groupKey) : String(groupKey);
            var groups = this.selectEl.querySelectorAll('optgroup');

            for (var i = 0; i < groups.length; i++) {
                if (groups[i].label === label) return groups[i];
            }

            var groupEl = document.createElement('optgroup');
            groupEl.label = label;
            this.selectEl.appendChild(groupEl);
            return groupEl;
        }

        _ensureOptionInSelect(input, source = 'local') {
            var normalized = this._normalizeStoredOption(input);
            if (!normalized) return null;

            return this._withSelectMutationObserverSuppressed(() => {
                this._options[normalized.value] = normalized;
                if (source === 'remote') this.state.remoteMap.set(normalized.value, normalized);

                var optionEl = this._findOptionElByValue(normalized.value);
                if (!optionEl) {
                    optionEl = document.createElement('option');
                    optionEl.value = normalized.value;

                    if (normalized.group) {
                        var groupEl = this._ensureSelectOptgroup(normalized.group);
                        groupEl.appendChild(optionEl);
                    } else {
                        this.selectEl.appendChild(optionEl);
                    }
                }

                const nextLabel = toStr(normalized.label == null ? normalized.value : normalized.label);
                const nextDisabled = !!normalized.disabled;

                // Avoid emitting needless MutationObserver records when the
                // materialized option already contains the same data.
                if (optionEl.textContent !== nextLabel) optionEl.textContent = nextLabel;
                if (optionEl.disabled !== nextDisabled) optionEl.disabled = nextDisabled;
                optionEl.__tszRaw = normalized.raw;

                return normalized;
            });
        }

        _upsertOption(input, source = 'local') {
            return this._ensureOptionInSelect(input, source);
        }

        _upsertOptions(list, source = 'local') {
            return this._materializeOptions(list, source);
        }

        _removeOptionByValue(value) {
            var v = toStr(value);
            delete this._options[v];
            this.state.remoteMap.delete(v);

            this._withSelectMutationObserverSuppressed(() => {
                var optionEl = this._findOptionElByValue(v);
                if (optionEl) optionEl.remove();
            });
        }

        _afterOptionsMutation() {
            this._rebuildOptionsMap();
            if (this.state.open) {
                this._refreshOptions(this._currentQuery());
            } else {
                this._renderDropdown();
            }
        }

        _cleanupEmptyOptgroups() {
            this._withSelectMutationObserverSuppressed(() => {
                var groups = this.selectEl.querySelectorAll('optgroup');
                for (var i = 0; i < groups.length; i++) {
                    if (!groups[i].children.length) groups[i].remove();
                }
            });
        }

        _getSelectedOptionObjects() {
            var out = [];
            var selected = this.selectEl.selectedOptions;

            for (var i = 0; i < selected.length; i++) {
                var opt = selected[i];
                var value = toStr(opt.value);
                if (value === '') continue;

                var stored = this._options && this._options[value];
                if (stored) {
                    out.push(stored);
                    continue;
                }

                var group = '';
                if (opt.parentElement && opt.parentElement.tagName === 'OPTGROUP') group = opt.parentElement.label || '';

                out.push({
                    value: value,
                    label: (opt.textContent != null) ? opt.textContent : value,
                    disabled: !!opt.disabled,
                    group: group,
                    raw: opt.__tszRaw || null
                });
            }
            return out;
        }

        _removeValue(value) {
            var current = this._getValueFromSelect();
            if (!Array.isArray(current)) return;

            var v = toStr(value);
            var next = current.filter(function (x) { return x !== v; });
            this._setValueAndSync(next, false, true).then(() => {
                this._renderDropdown();
                this.focus();
            });
        }

        // ----- Choose -----

        _requestUserChange(nextValue, context, applyChange) {
            if (!isFn(this.config.beforeChange)) {
                return Promise.resolve(applyChange()).then(() => true);
            }

            if (this._changePending) return Promise.resolve(false);

            const previousValue = this._getValueFromSelect();
            this._changePending = true;

            return Promise.resolve()
                .then(() => this.config.beforeChange.call(this, {
                    value: nextValue,
                    previousValue,
                    option: context?.option || null,
                    action: context?.action || 'select',
                    selectEl: this.selectEl,
                    instance: this
                }))
                .then((allowed) => {
                    if (allowed === false) return false;
                    return Promise.resolve(applyChange()).then(() => true);
                })
                .catch((error) => {
                    console.error('TinySelectize beforeChange error:', error);
                    return false;
                })
                .finally(() => {
                    this._changePending = false;
                });
        }

        _chooseByIndex(idx) {
            var flat = this._getActiveOptions();
            var opt = flat[idx];
            if (!opt || opt.disabled) return;

            if (this.isMultiple) {
                var current = this._getValueFromSelect();
                var curArr = Array.isArray(current) ? current.slice() : [];
                if (curArr.indexOf(opt.value) === -1) curArr.push(opt.value);

                this._requestUserChange(curArr, {
                    action: 'select',
                    option: opt.raw || opt
                }, () => this._setValueAndSync(curArr, false, true)).then((changed) => {
                    if (!changed) return;
                    this._setQuery('');
                    this.open();
                });
            } else {
                this._requestUserChange(opt.value, {
                    action: 'select',
                    option: opt.raw || opt
                }, () => this._setValueAndSync(opt.value, false, false)).then((changed) => {
                    if (!changed) return;
                    this._setQuery('');
                    this.close();
                });
            }
        }

        // ----- Dropdown placement (auto flip + optional portal container) -----

        _resolveDropdownParent() {
            var p = this.config.dropdownParent;

            // Explicit inline mode.
            if (p === false || p === 'inline') return null;

            // Forced body portal.
            if (p === 'body') return document.body;

            // Forced HTMLElement portal.
            if (p instanceof HTMLElement) return p;

            // Forced selector / closest selector portal.
            if (typeof p === 'string') {
                if (p.indexOf('closest:') === 0) {
                    var selector = p.slice('closest:'.length).trim();
                    var closest = this.selectEl.closest(selector);
                    return closest instanceof HTMLElement ? closest : null;
                }

                var el = document.querySelector(p);
                return el instanceof HTMLElement ? el : null;
            }

            // Auto mode: null / undefined.
            // If inside TinySwal, keep the dropdown inside the modal root.
            var modalRoot = this._resolveClosestModalRoot();
            if (modalRoot) {
                this.config.dropdownZIndex = Math.max(Number(this.config.dropdownZIndex) || 0, 999999);
                return modalRoot;
            }

            // Otherwise stay inline by default.
            // Do not auto-detach to body unless you explicitly want that behavior later.
            return null;
        }

        _resolveClosestModalRoot() {
            var rootSelector = this.config.dropdownModalRootSelector;
            var popupSelector = this.config.dropdownModalPopupSelector;

            if (this.config.dropdownModalRootSelector) {
                var root = this.selectEl.closest(this.config.dropdownModalRootSelector);
                if (root instanceof HTMLElement) {
                    return root;
                }
            }

            if (this.config.dropdownModalPopupSelector) {
                var popup = this.selectEl.closest(this.config.dropdownModalPopupSelector);
                if (popup instanceof HTMLElement) {
                    var popupRoot = popup.closest(this.config.dropdownModalRootSelector);
                    return popupRoot instanceof HTMLElement ? popupRoot : popup;
                }
            }

            return null;
        }

        /**
         * Resolve the dropdown parent once per open cycle.
         * This prevents the dropdown from switching between inline and detached
         * while already open and being repositioned.
         *
         * @returns {HTMLElement|null}
         */
        _decideDropdownParentForOpen() {
            if (this._resolvedDropdownParentForOpen !== undefined) {
                return this._resolvedDropdownParentForOpen;
            }
            this._resolvedDropdownParentForOpen = this._resolveDropdownParent();
            return this._resolvedDropdownParentForOpen;
        }

        _ensureDropdownParent() {
            const parent = this._decideDropdownParentForOpen();

            this._dropdownParentEl = parent;

            if (!parent) {
                if (this.dropdown.parentElement !== this.wrapper) {
                    this.wrapper.appendChild(this.dropdown);
                }

                this._dropdownMode = 'inline';
                this._dropdownIsDetached = false;

                this.dropdown.style.removeProperty('position');
                this.dropdown.style.removeProperty('left');
                this.dropdown.style.removeProperty('top');
                this.dropdown.style.removeProperty('right');
                this.dropdown.style.removeProperty('bottom');
                this.dropdown.style.removeProperty('width');
                this.dropdown.style.removeProperty('z-index');

                return;
            }

            if (this.dropdown.parentElement !== parent) {
                parent.appendChild(this.dropdown);
            }

            const style = window.getComputedStyle(parent);
            if (style.pointerEvents === 'none') {
                parent.dataset.tszOriginalPointerEvents = parent.style.pointerEvents || '';
                parent.style.pointerEvents = 'auto';
            }

            this._dropdownIsDetached = true;
            this._dropdownMode = parent === document.body ? 'body' : 'container';
            this.dropdown.style.position = this._dropdownMode === 'body' ? 'fixed' : 'absolute';
            this.dropdown.style.zIndex = String(this.config.dropdownZIndex);

        }

        _shouldAutoDetach(metrics) {
            var threshold = Number(this.config.dropdownDetachThreshold) || 140;
            return Math.max(metrics.spaceAbove, metrics.spaceBelow) < threshold;
        }

        _measureInlineSpace() {
            var rect = this.wrapper.getBoundingClientRect();
            var gap = Number(this.config.dropdownGapPx) || 0;
            var clipParent = this._findClippingParent(this.wrapper);

            var spaceBelow;
            var spaceAbove;

            if (clipParent) {
                var parentRect = clipParent.getBoundingClientRect();
                spaceBelow = parentRect.bottom - rect.bottom - gap;
                spaceAbove = rect.top - parentRect.top - gap;
            } else {
                var viewportH = window.innerHeight || document.documentElement.clientHeight;
                spaceBelow = viewportH - rect.bottom - gap;
                spaceAbove = rect.top - gap;
            }

            return {
                clipParent: clipParent,
                spaceBelow: Math.max(0, Math.floor(spaceBelow)),
                spaceAbove: Math.max(0, Math.floor(spaceAbove))
            };
        }

        /**
         * Return true when the element can clip descendants vertically.
         * This includes scroll containers and hidden/clip overflow containers.
         *
         * @param {HTMLElement} el
         * @returns {boolean}
         */
        _isClippingContainer(el) {
            if (!(el instanceof HTMLElement)) return false;

            var style = window.getComputedStyle(el);
            var overflowY = style.overflowY;
            var overflow = style.overflow;

            return (
                overflowY === 'auto' ||
                overflowY === 'scroll' ||
                overflowY === 'hidden' ||
                overflowY === 'clip' ||
                overflow === 'hidden' ||
                overflow === 'clip'
            );
        }

        /**
         * Find the nearest ancestor that can visually clip the dropdown.
         * This is more important than "scrollable parent" because hidden/clip
         * can crop even when the ancestor itself does not scroll.
         *
         * @param {HTMLElement} startEl
         * @returns {HTMLElement|null}
         */
        _findClippingParent(startEl) {
            var el = startEl ? startEl.parentElement : null;

            while (el && el !== document.body && el !== document.documentElement) {
                if (this._isClippingContainer(el)) return el;
                el = el.parentElement;
            }

            return null;
        }

        /**
         * Read the configured CSS max-height of the dropdown, if any.
         *
         * @returns {number} pixels, 0 when unlimited/invalid
         */
        _getConfiguredDropdownMaxHeight() {
            try {
                var cs = window.getComputedStyle(this.dropdown);
                var maxH = parseFloat(cs.maxHeight);
                var maxHeight =  Number.isFinite(maxH) ? maxH : 0;
                return maxHeight;
            } catch (e) {
                return 0;
            }
        }

        _isDropdownVisible() {
            return this.dropdown.style.display !== 'none';
        }

        _setDropdownVisibility(visible) {
            this.dropdown.style.display = visible ? 'block' : 'none';
            this.dropdown.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }

        /**
         * Measure natural dropdown content height.
         *
         * @returns {number}
         */
        _getDropdownContentHeight() {
            if (!this.dropdown) return 0;

            const wasVisible = this._isDropdownVisible();

            const prevVisibility = this.dropdown.style.visibility;
            const prevPointerEvents = this.dropdown.style.pointerEvents;

            if (!wasVisible) {
                this._setDropdownVisibility(true);
                this.dropdown.style.visibility = 'hidden';
                this.dropdown.style.pointerEvents = 'none';
            }

            const height = this.dropdown.scrollHeight || this.dropdown.offsetHeight || 0;

            if (!wasVisible) {
                this._setDropdownVisibility(false);
                this.dropdown.style.visibility = prevVisibility;
                this.dropdown.style.pointerEvents = prevPointerEvents;
            }

            return height;
        }

        /**
         * Apply an inline max-height to the dropdown.
         * Clears the inline style when maxHeightPx is falsy.
         *
         * @param {number} maxHeightPx
         */
        _applyDropdownMaxHeight(maxHeightPx) {
            if (!maxHeightPx || maxHeightPx <= 0) {
                this.dropdown.style.removeProperty('max-height');
                return;
            }

            this.dropdown.style.maxHeight = Math.max(32, Math.floor(maxHeightPx)) + 'px';
            this.dropdown.style.overflowY = 'auto';
        }

        _schedulePlacement() {
            if (this._placementRaf) cancelAnimationFrame(this._placementRaf);
            this._placementRaf = requestAnimationFrame(() => {
                this._placementRaf = 0;
                if (!this.state.open) return;
                this._updateDropdownPlacement();
            });
        }


        /**
         * Update dropdown direction and geometry.
         *
         * Rules:
         * - Detached dropdown: place against viewport/page coordinates.
         * - Non-detached dropdown: constrain against nearest clipping ancestor
         *   so the dropdown does not get cropped by a scroll/overflow parent.
         */
        _updateDropdownPlacement() {
            this._ensureDropdownParent();

            const rect = this.wrapper.getBoundingClientRect();
            const gap = Number(this.config.dropdownGapPx) || 0;

            const configuredMaxH = this._getConfiguredDropdownMaxHeight();
            const contentH = this._getDropdownContentHeight();
            const wantedH = configuredMaxH > 0
                ? Math.min(contentH, configuredMaxH)
                : contentH;

            if (this._dropdownMode === 'body') {
                this._placeDropdownInBody(
                    rect,
                    gap,
                    configuredMaxH,
                    contentH,
                    wantedH
                );
                return;
            }

            if (this._dropdownMode === 'container') {
                this._placeDropdownInContainer(
                    rect,
                    gap,
                    configuredMaxH,
                    contentH,
                    wantedH
                );
                return;
            }

            this._placeDropdownInline(
                rect,
                gap,
                configuredMaxH,
                wantedH
            );
        }

        _placeDropdownInline(rect, gap, configuredMaxH, wantedH) {
            const clipParent = this._findClippingParent(this.wrapper);

            let spaceBelow;
            let spaceAbove;

            if (clipParent) {
                const parentRect = clipParent.getBoundingClientRect();

                spaceBelow = parentRect.bottom - rect.bottom - gap;
                spaceAbove = rect.top - parentRect.top - gap;
            } else {
                const viewportH =
                    window.innerHeight ||
                    document.documentElement.clientHeight;

                spaceBelow = viewportH - rect.bottom - gap;
                spaceAbove = rect.top - gap;
            }

            spaceBelow = Math.max(0, Math.floor(spaceBelow));
            spaceAbove = Math.max(0, Math.floor(spaceAbove));

            const dropUp =
                this.config.dropdownAutoFlip &&
                spaceBelow < wantedH &&
                spaceAbove > spaceBelow;

            this.dropdown.classList.toggle(CLASS_NAMES.DROPDOWN_UP, dropUp);

            const availableH = dropUp
                ? spaceAbove
                : spaceBelow;

            const appliedMaxH = configuredMaxH > 0
                ? Math.min(configuredMaxH, availableH)
                : availableH;

            this._applyDropdownMaxHeight(appliedMaxH);
        }

        _placeDropdownInBody(
            rect,
            gap,
            configuredMaxH,
            contentH,
            wantedH
        ) {
            const viewportH = window.innerHeight || document.documentElement.clientHeight;

            const spaceBelow = Math.max(0, Math.floor(viewportH - rect.bottom - gap));

            const spaceAbove = Math.max(0, Math.floor(rect.top - gap));

            const dropUp = this.config.dropdownAutoFlip && spaceBelow < wantedH && spaceAbove > spaceBelow;

            this.dropdown.classList.toggle(CLASS_NAMES.DROPDOWN_UP, dropUp);

            const availableH = dropUp ? spaceAbove : spaceBelow;

            const appliedMaxH = configuredMaxH > 0 ? Math.min(configuredMaxH, availableH) : availableH;

            this._applyDropdownMaxHeight(appliedMaxH);

            const renderedH = appliedMaxH > 0 ? Math.min(contentH, appliedMaxH) : wantedH;
            const top = dropUp ? rect.top - renderedH - gap : rect.bottom + gap;

            this.dropdown.style.position = 'fixed';
            this.dropdown.style.left = Math.round(rect.left) + 'px';
            this.dropdown.style.top = Math.max(0, Math.floor(top)) + 'px';
            this.dropdown.style.width = Math.round(rect.width) + 'px';
            this.dropdown.style.right = 'auto';
            this.dropdown.style.bottom = 'auto';
        }

        _placeDropdownInContainer(
            rect,
            gap,
            configuredMaxH,
            contentH,
            wantedH
        ) {
            const parent = this._dropdownParentEl;

            if (!(parent instanceof HTMLElement)) {
                return;
            }

            if (
                window.getComputedStyle(parent).position === 'static'
            ) {
                parent.style.position = 'relative';
            }

            const parentRect =
                parent.getBoundingClientRect();

            const spaceBelow = Math.max(
                0,
                Math.floor(parentRect.bottom - rect.bottom - gap)
            );

            const spaceAbove = Math.max(
                0,
                Math.floor(rect.top - parentRect.top - gap)
            );

            const dropUp =
                this.config.dropdownAutoFlip &&
                spaceBelow < wantedH &&
                spaceAbove > spaceBelow;

            this.dropdown.classList.toggle(
                CLASS_NAMES.DROPDOWN_UP,
                dropUp
            );

            const availableH = dropUp
                ? spaceAbove
                : spaceBelow;

            const appliedMaxH = configuredMaxH > 0
                ? Math.min(configuredMaxH, availableH)
                : availableH;

            this._applyDropdownMaxHeight(appliedMaxH);

            const renderedH = appliedMaxH > 0
                ? Math.min(contentH, appliedMaxH)
                : wantedH;

            const left =
                rect.left -
                parentRect.left +
                parent.scrollLeft;

            const top = dropUp
                ? rect.top -
                parentRect.top +
                parent.scrollTop -
                renderedH -
                gap
                : rect.bottom -
                parentRect.top +
                parent.scrollTop +
                gap;

            this.dropdown.style.position = 'absolute';

            this.dropdown.style.left =
                Math.round(left) + 'px';

            this.dropdown.style.top =
                Math.max(0, Math.floor(top)) + 'px';

            this.dropdown.style.width =
                Math.round(rect.width) + 'px';

            this.dropdown.style.right = 'auto';
            this.dropdown.style.bottom = 'auto';
        }

        _bindPlacementListeners() {
            if (this._onWindowResize || this._onWindowScroll) return;
            this._onWindowResize = () => this._schedulePlacement();
            const _isEventInsideDropdown = (event) => {
                const target = event.target;
                const path = event.composedPath ? event.composedPath() : [];

                return (
                    target === this.dropdown ||
                    target === this.listEl ||
                    this.dropdown.contains(target) ||
                    path.includes(this.dropdown) ||
                    path.includes(this.listEl)
                );
            }

            this._onWindowScroll = (event) => {
                if (_isEventInsideDropdown(event)) return;
                if (this.config.dropdownCloseOnScrollParent !== false) {
                    this.close(true);
                    return;
                }
                this._schedulePlacement();
            };

            window.addEventListener('resize', this._onWindowResize);
            window.addEventListener('scroll', this._onWindowScroll, true);
        }

        _unbindPlacementListeners() {
            if (this._onWindowResize) {
                window.removeEventListener('resize', this._onWindowResize);
                this._onWindowResize = null;
            }
            if (this._onWindowScroll) {
                window.removeEventListener('scroll', this._onWindowScroll, true);
                this._onWindowScroll = null;
            }
            if (this._placementRaf) {
                cancelAnimationFrame(this._placementRaf);
                this._placementRaf = 0;
            }
        }
    }

    // value property (Selectize-like)
    Object.defineProperty(TinySelectize.prototype, 'value', {
        configurable: true,
        enumerable: false,
        get: function () {
            var v = this.val();
            if (Array.isArray(v)) return v;
            return v == null ? '' : v;
        },
        set: function (nextValue) {
            this.val(nextValue);
        }
    });

    TinySelectize._resolveInstances = function (input) {
        const entries = typeof input === 'string'
            ? document.querySelectorAll(input)
            : input == null ? []
                : (
                    input instanceof TinySelectize ||
                    input instanceof HTMLSelectElement ||
                    input.jquery
                )
                    ? [input]
                    : input;

        return Array.from(entries, (entry) => {
            if (entry instanceof TinySelectize) {
                return entry;
            }

            if (entry && entry.jquery) {
                entry = entry[0];
            }

            if (entry instanceof HTMLSelectElement && entry.selectize instanceof TinySelectize) {
                return entry.selectize;
            }

            throw new Error(
                'TinySelectize: expected selector, <select>, jQuery <select>, TinySelectize instance, or array of those.'
            );
        });
    };

    TinySelectize.whenValuesReady = function (input) {
        return Promise.all(TinySelectize._resolveInstances(input).map((instance) => instance.whenValueReady()));
    };

    TinySelectize.isInstanciate = el => el?.selectize instanceof TinySelectize;

    // Static API
    TinySelectize.VERSION = '2.0.9';
    TinySelectize.definePlugin = definePlugin;
    TinySelectize.plugins = PLUGINS;

    return TinySelectize;
}));