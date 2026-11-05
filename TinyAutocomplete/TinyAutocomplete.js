(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TinyAutocomplete = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const VERSION = '1.1.0';

    const CLASS = {
        ROOT: 'tac',
        CONTROL: 'tac__control',
        INPUT: 'tac__input',
        DROPDOWN: 'tac__dropdown',
        LIST: 'tac__list',
        OPTION: 'tac__option',
        OPTION_LABEL: 'tac__option-label',
        EMPTY: 'tac__empty',
        STATUS: 'tac__status',
        ACTIVE: 'is-active',
        OPEN: 'is-open',
        LOADING: 'is-loading',
        DISABLED: 'is-disabled',
        HIGHLIGHT: 'highlight'
    };

    const SELECTOR = {
        OPTION: '[data-tac-index]'
    };

    const KEY = {
        ARROW_DOWN: 'ArrowDown',
        ARROW_UP: 'ArrowUp',
        ENTER: 'Enter',
        ESCAPE: 'Escape',
        TAB: 'Tab'
    };

    const DEFAULTS = {
        data: null,
        url: null,
        sourceUrl: null,
        queryParam: 'q',
        limit: Infinity,
        minLength: 1,
        searchDelay: 150,
        valueField: 'value',
        labelField: null,
        searchFields: null,
        responsePath: null,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        method: 'GET',
        requestData: null,
        mapResponse: null,
        exclude: null,
        sortFunction: null,
        onAutocomplete: null,
        onInput: null,
        onClear: null,
        onError: null,
        renderer: null,
        showNoResults: false,
        noResultsText: 'Aucun résultat',
        loadingText: 'Chargement…',
        errorText: 'Erreur de chargement',
        highlight: true,
        autoSelectFirst: false,
        closeOnSelect: true,
        clearOnEscape: false,
        disabled: false
    };

    const isFn = value => typeof value === 'function';

    const toArray = input => Array.prototype.slice.call(input || []);

    const toStr = value => value == null ? '' : String(value);

    const escapeHtml = value => toStr(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const fold = value => toStr(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const isTextField = element => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

    const getElements = input => {
        if (!input) return [];
        if (typeof input === 'string') return toArray(document.querySelectorAll(input)).filter(isTextField);
        if (isTextField(input)) return [input];
        if (input.jquery) return input.toArray().filter(isTextField);
        if (input instanceof NodeList || input instanceof HTMLCollection || Array.isArray(input)) {
            return toArray(input).filter(isTextField);
        }
        return [];
    };

    const getElement = input => {
        if (!input) return null;
        if (typeof input === 'string') return document.querySelector(input);
        if (input.jquery) return input[0] || null;
        return input instanceof HTMLElement ? input : null;
    };

    const getPath = (source, path) => {
        if (!path) return source;
        return toStr(path).split('.').reduce((current, key) => current == null ? undefined : current[key], source);
    };

    const normalizeLimit = value => {
        const limit = Number(value);
        return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
    };

    const normalizeOptions = (input, element) => {
        const options = { ...DEFAULTS, ...(input || {}) };
        options.url = options.url || element.dataset.url || element.getAttribute('url') || null;
        options.sourceUrl = options.sourceUrl || element.dataset.sourceUrl || element.getAttribute('source-url') || null;
        options.limit = normalizeLimit(options.limit);
        options.minLength = Math.max(0, Number(options.minLength) || 0);
        options.searchDelay = Math.max(0, Number(options.searchDelay) || 0);
        options.labelField = options.labelField || options.valueField;
        return options;
    };

    const findMatchRange = (text, query) => {
        const source = toStr(text);
        const q = toStr(query).trim();
        if (!source || !q) return null;

        const foldedSource = [];
        const indexMap = [];

        for (let index = 0; index < source.length; index += 1) {
            const foldedChar = fold(source[index]);
            for (let inner = 0; inner < foldedChar.length; inner += 1) {
                foldedSource.push(foldedChar[inner]);
                indexMap.push(index);
            }
        }

        const startFolded = foldedSource.join('').indexOf(fold(q));
        if (startFolded === -1) return null;

        const endFolded = startFolded + fold(q).length - 1;
        const start = indexMap[startFolded];
        const end = indexMap[endFolded] + 1;

        return { start, end };
    };

    const highlightText = (text, query) => {
        const source = toStr(text);
        const range = findMatchRange(source, query);

        if (!range) return escapeHtml(source);

        return [
            escapeHtml(source.slice(0, range.start)),
            `<span class="${CLASS.HIGHLIGHT}">${escapeHtml(source.slice(range.start, range.end))}</span>`,
            escapeHtml(source.slice(range.end))
        ].join('');
    };

    const defaultGetValue = (item, valueField) => {
        if (item == null) return '';
        if (typeof item !== 'object') return item;
        return item[valueField];
    };

    const getSearchText = (item, options) => {
        if (item == null) return '';
        if (typeof item !== 'object') return fold(item);

        const fields = Array.isArray(options.searchFields)
            ? options.searchFields
            : [options.valueField, options.labelField].filter(Boolean);

        if (fields.length) {
            return fold(fields.map(field => item[field]).filter(value => value != null).join(' '));
        }

        return fold(Object.values(item).filter(value => value != null).join(' '));
    };

    const defaultSortFunction = (a, b, query, options) => {
        const q = fold(query).trim();
        const aText = getSearchText(a, options);
        const bText = getSearchText(b, options);
        const aIndex = q ? aText.indexOf(q) : 0;
        const bIndex = q ? bText.indexOf(q) : 0;
        const aRank = aIndex === -1 ? Number.POSITIVE_INFINITY : aIndex;
        const bRank = bIndex === -1 ? Number.POSITIVE_INFINITY : bIndex;

        if (aRank !== bRank) return aRank - bRank;

        const aValue = fold(defaultGetValue(a, options.valueField));
        const bValue = fold(defaultGetValue(b, options.valueField));

        return aValue.localeCompare(bValue);
    };

    class TinyAutocomplete {
        static version = VERSION;

        static init(selector = 'input[data-autocomplete]', options = {}) {
            return getElements(selector).map(input => TinyAutocomplete.getInstance(input) || new TinyAutocomplete(input, options));
        }

        static getInstance(input) {
            const element = getElement(input);
            return element ? element.tinyAutocomplete || null : null;
        }

        constructor(input, options = {}) {
            const element = getElement(input);

            if (!isTextField(element)) {
                throw new Error('TinyAutocomplete requires an input or textarea element.');
            }

            if (element.tinyAutocomplete) {
                throw new Error('TinyAutocomplete is already initialized on this input. Use TinyAutocomplete.getInstance(input).');
            }

            this.input = element;
            this.options = normalizeOptions(options, element);
            this.items = [];
            this.activeIndex = -1;
            this.timer = null;
            this.abortController = null;
            this.sourceLoaded = false;
            this.requestId = 0;
            this.isOpen = false;
            this.parent = element.parentElement;
            this.originalParentPosition = this.parent?.style.position || '';

            this.bound = {
                input: this.handleInput.bind(this),
                keydown: this.handleKeydown.bind(this),
                focus: this.handleFocus.bind(this),
                documentPointerDown: this.handleDocumentPointerDown.bind(this),
                dropdownMouseDown: this.handleDropdownMouseDown.bind(this)
            };

            this.build();
            this.bind();
            this.setDisabled(this.options.disabled || this.input.disabled);
            this.input.tinyAutocomplete = this;
        }

        build() {
            this.dropdown = document.createElement('div');
            this.dropdown.className = CLASS.DROPDOWN;
            this.dropdown.hidden = true;
            this.dropdown.setAttribute('role', 'listbox');
            this.dropdown.setAttribute('aria-hidden', 'true');

            this.status = document.createElement('div');
            this.status.className = CLASS.STATUS;
            this.status.hidden = true;

            this.list = document.createElement('div');
            this.list.className = CLASS.LIST;

            this.dropdown.append(this.status, this.list);
            this.input.insertAdjacentElement('afterend', this.dropdown);

            if (this.parent && getComputedStyle(this.parent).position === 'static') {
                this.parent.style.position = 'relative';
            }

            this.input.classList.add(CLASS.INPUT);
            this.input.setAttribute('role', 'combobox');
            this.input.setAttribute('aria-autocomplete', 'list');
            this.input.setAttribute('aria-expanded', 'false');
        }

        bind() {
            this.input.addEventListener('input', this.bound.input);
            this.input.addEventListener('keydown', this.bound.keydown);
            this.input.addEventListener('focus', this.bound.focus);
            this.dropdown.addEventListener('mousedown', this.bound.dropdownMouseDown);
            document.addEventListener('pointerdown', this.bound.documentPointerDown, true);
        }

        unbind() {
            this.input.removeEventListener('input', this.bound.input);
            this.input.removeEventListener('keydown', this.bound.keydown);
            this.input.removeEventListener('focus', this.bound.focus);
            this.dropdown.removeEventListener('mousedown', this.bound.dropdownMouseDown);
            document.removeEventListener('pointerdown', this.bound.documentPointerDown, true);
        }

        handleInput() {
            const query = this.input.value.trim();
            this.options.onInput?.(query, this.input, this);

            if (!query) {
                this.options.onClear?.(this.input, this);
            }

            this.scheduleSearch(query);
        }

        handleFocus() {
            const query = this.input.value.trim();
            if (query.length >= this.options.minLength) {
                this.scheduleSearch(query, 0);
            }
        }

        handleKeydown(event) {
            if (event.key === KEY.ESCAPE) {
                if (this.isOpen) {
                    event.preventDefault();
                    this.close();
                    return;
                }

                if (this.options.clearOnEscape) {
                    this.clear();
                }

                return;
            }

            if (!this.isOpen) return;

            if (event.key === KEY.ARROW_DOWN) {
                event.preventDefault();
                this.move(1);
                return;
            }

            if (event.key === KEY.ARROW_UP) {
                event.preventDefault();
                this.move(-1);
                return;
            }

            if (event.key === KEY.ENTER) {
                // Select the active option, or the only available option.
                const index = this.activeIndex >= 0 ? this.activeIndex : (this.items.length === 1 ? 0 : -1);

                if (index >= 0) {
                    event.preventDefault();
                    this.select(index);
                }

                return;
            }

            if (event.key === KEY.TAB) {
                this.close();
            }
        }

        handleDocumentPointerDown(event) {
            if (!this.isOpen || event.button !== 0) return;
            const path = event.composedPath?.() ?? [];
            if (path.includes(this.input) || path.includes(this.dropdown)) {
                return;
            }
            this.close();
        };

        handleDropdownMouseDown(event) {
            if (event.button !== 0) return;
            const option = event.target.closest(SELECTOR.OPTION);
            if (!option || !this.dropdown.contains(option)) return;
            event.preventDefault();
            this.select(Number(option.dataset.tacIndex));
        }

        scheduleSearch(query, delay = this.options.searchDelay) {
            clearTimeout(this.timer);

            if (query.length < this.options.minLength) {
                this.items = [];
                this.close();
                return;
            }

            this.timer = setTimeout(() => this.search(query), delay);
        }

        async search(query) {
            const requestId = ++this.requestId;
            this.abortController?.abort();
            this.abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

            this.setLoading(true);

            try {
                let items;
                if (this.options.url) {
                    items = await this.fetchItems(this.options.url, query, this.abortController?.signal);
                } else {
                    if (this.options.sourceUrl && !this.sourceLoaded) {
                        this.options.data = await this.fetchItems(this.options.sourceUrl, query, this.abortController?.signal, true);
                    }
                    items = this.filterLocalItems(query);
                }

                if (requestId !== this.requestId) return;

                const q = fold(query).trim();

                const matchedItems = q
                    ? items.filter(item => getSearchText(item, this.options).includes(q))
                    : items;
                const availableItems = this.applyExclude(matchedItems);

                this.items = this.sortItems(availableItems, query).slice(0, this.options.limit);
                this.activeIndex = this.options.autoSelectFirst && this.items.length ? 0 : -1;
                this.render(query);
            } catch (error) {
                if (error?.name === 'AbortError') return;
                console.error('[TinyAutocomplete] search failed', error);
                this.options.onError?.(error, this.input, this);
                this.renderError();
            } finally {
                if (requestId === this.requestId) this.setLoading(false);
            }
        }

        async fetchItems(sourceUrl, query, signal, loadOnce = false) {
            const url = new URL(sourceUrl, window.location.href);
            if (!loadOnce) {
                url.searchParams.set(this.options.queryParam, query);
                if (Number.isFinite(this.options.limit)) {
                    url.searchParams.set('limit', this.options.limit);
                }
            }

            const extraData = isFn(this.options.requestData)
                ? this.options.requestData(query, this.input, this)
                : this.options.requestData;

            if (extraData && typeof extraData === 'object') {
                Object.keys(extraData).forEach(key => {
                    const value = extraData[key];
                    if (value == null) return;
                    if (Array.isArray(value)) {
                        value.forEach(entry => url.searchParams.append(key, entry));
                    } else {
                        url.searchParams.set(key, value);
                    }
                });
            }

            const response = await fetch(url.toString(), {
                method: this.options.method || 'GET',
                headers: this.options.headers || undefined,
                credentials: this.options.credentials || 'same-origin',
                signal
            });

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
                error.status = response.status;
                throw error;
            }

            const json = await response.json();
            const mapped = isFn(this.options.mapResponse)
                ? this.options.mapResponse(json, query, this)
                : getPath(json, this.options.responsePath);

            if (Array.isArray(mapped)) return mapped;
            if (Array.isArray(mapped?.data)) return mapped.data;
            if (Array.isArray(mapped?.options)) return mapped.options;
            return [];
        }

        filterLocalItems(query) {
            const source = Array.isArray(this.options.data)
                ? this.options.data
                : Object.keys(this.options.data || {}).map(key => ({ [this.options.valueField]: key, icon: this.options.data[key] }));

            const q = fold(query);

            return source.filter(item => getSearchText(item, this.options).includes(q));
        }

        /**
         * Remove items excluded by the consumer.
         *
         * exclude accepts the same forms as TinySelectize:
         *  - an array of values matching valueField: [1, 2, 3]
         *  - a function(item, instance) => boolean
         *
         * The function form is evaluated for every search so callers can react
         * to changing UI state without rebuilding the autocomplete instance.
         */
        applyExclude(items) {
            const exclude = this.options.exclude;

            if (!exclude) return items;

            if (isFn(exclude)) {
                return items.filter(item => !exclude.call(this, item, this));
            }

            if (Array.isArray(exclude)) {
                const excluded = new Set(exclude.map(value => toStr(value)));

                return items.filter(item => !excluded.has(
                    toStr(defaultGetValue(item, this.options.valueField))
                ));
            }

            return items;
        }

        sortItems(items, query) {
            const sortFunction = isFn(this.options.sortFunction)
                ? this.options.sortFunction
                : (a, b, q) => defaultSortFunction(a, b, q, this.options);

            return items.slice().sort((a, b) => sortFunction(a, b, query));
        }

        render(query) {
            this.list.textContent = '';
            this.status.hidden = true;
            this.status.textContent = '';

            if (!this.items.length) {
                if (!this.options.showNoResults) {
                    this.close();
                    return;
                }

                this.renderEmpty();
                return;
            }

            const fragment = document.createDocumentFragment();

            this.items.forEach((item, index) => {
                const option = document.createElement('div');
                option.className = CLASS.OPTION;
                option.dataset.tacIndex = String(index);
                option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', index === this.activeIndex ? 'true' : 'false');
                option.classList.toggle(CLASS.ACTIVE, index === this.activeIndex);

                const ctx = {
                    query,
                    index,
                    input: this.input,
                    instance: this,
                    escape: escapeHtml,
                    highlight: value => this.options.highlight === false ? escapeHtml(value) : highlightText(value, query),
                    value: defaultGetValue(item, this.options.valueField)
                };

                if (isFn(this.options.renderer)) {
                    const rendered = this.options.renderer(item, ctx);
                    if (rendered instanceof Node) {
                        option.append(rendered);
                    } else {
                        option.innerHTML = toStr(rendered);
                    }
                } else {
                    const label = item?.[this.options.labelField] ?? defaultGetValue(item, this.options.valueField);
                    option.innerHTML = `<span class="${CLASS.OPTION_LABEL}">${ctx.highlight(label)}</span>`;
                }

                fragment.append(option);
            });

            this.list.append(fragment);
            this.open();
        }

        renderEmpty() {
            this.list.textContent = '';
            this.status.hidden = true;

            const empty = document.createElement('div');
            empty.className = CLASS.EMPTY;
            empty.textContent = this.options.noResultsText;
            this.list.append(empty);
            this.open();
        }

        renderError() {
            this.list.textContent = '';
            this.status.hidden = false;
            this.status.textContent = this.options.errorText;
            this.open();
        }

        setLoading(isLoading) {
            this.input.classList.toggle(CLASS.LOADING, !!isLoading);
            this.status.hidden = !isLoading;
            this.status.textContent = isLoading ? this.options.loadingText : '';

        }

        move(direction) {
            if (!this.items.length) return;
            this.activeIndex = (this.activeIndex + direction + this.items.length) % this.items.length;

            this.dropdown.querySelectorAll(`.${CLASS.OPTION}`).forEach((option, index) => {
                const active = index === this.activeIndex;
                option.classList.toggle(CLASS.ACTIVE, active);
                option.setAttribute('aria-selected', active ? 'true' : 'false');
                if (active) option.scrollIntoView({ block: 'nearest' });
            });
        }

        select(index) {
            const item = this.items[index];
            if (!item) return;

            // Re-evaluate dynamic exclusions at selection time as well. An item
            // may have become unavailable after the current result list loaded.
            if (!this.applyExclude([item]).length) {
                this.items = this.applyExclude(this.items);
                this.activeIndex = this.options.autoSelectFirst && this.items.length ? 0 : -1;
                this.render(this.input.value.trim());
                return;
            }

            const value = defaultGetValue(item, this.options.valueField);
            this.input.value = value == null ? '' : String(value);

            this.options.onAutocomplete?.(item, {
                input: this.input,
                instance: this,
                value,
                index
            });

            this.input.dispatchEvent(new Event('change', { bubbles: true }));

            if (this.options.closeOnSelect) {
                this.close();
            }
        }

        positionDropdown() {
            if (!this.parent) return;
            const inputRect = this.input.getBoundingClientRect();
            const parentRect = this.parent.getBoundingClientRect();
            this.dropdown.style.left = `${inputRect.left - parentRect.left + this.parent.scrollLeft}px`;
            this.dropdown.style.top = `${inputRect.bottom - parentRect.top + this.parent.scrollTop + 4}px`;
            this.dropdown.style.width = `${inputRect.width}px`;
        }

        open() {
            if (this.isOpen) return;
            this.isOpen = true;

            this.input.classList.toggle(CLASS.OPEN, true);
            this.parent?.classList.toggle(CLASS.OPEN, true);

            this.dropdown.hidden = false;
            this.dropdown.setAttribute('aria-hidden', 'false');
            this.input.setAttribute('aria-expanded', 'true');
            this.positionDropdown();

        }

        close() {
            if (!this.isOpen) return;
            this.isOpen = false;
            this.activeIndex = -1;
            this.input.classList.toggle(CLASS.OPEN, false);
            this.parent?.classList.toggle(CLASS.OPEN, false);
            this.dropdown.hidden = true;
            this.dropdown.setAttribute('aria-hidden', 'true');
            this.input.setAttribute('aria-expanded', 'false');
        }

        clear() {
            this.input.value = '';
            this.items = [];
            this.close();
            this.options.onClear?.(this.input, this);
            this.input.dispatchEvent(new Event('input', { bubbles: true }));
            this.input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setDisabled(disabled = true) {
            this.input.disabled = !!disabled;
            return this;
        }

        enable() {
            return this.setDisabled(false);
        }

        disable() {
            return this.setDisabled(true);
        }

        destroy() {
            clearTimeout(this.timer);
            this.abortController?.abort();
            this.unbind();
            this.close();

            this.input.classList.remove(CLASS.INPUT);
            if (this.parent) {
                this.parent.style.position = this.originalParentPosition;
            }
            this.dropdown.remove();
            delete this.input.tinyAutocomplete;
        }
    }

    TinyAutocomplete.escapeHtml = escapeHtml;
    TinyAutocomplete.highlightText = highlightText;
    TinyAutocomplete.defaultSortFunction = defaultSortFunction;

    return TinyAutocomplete;
}));
