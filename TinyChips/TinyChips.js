/**
 * TinyChips
 * Standalone vanilla JavaScript chips/tag input component.
 *
 * Supports two mounting modes:
 * 1. Mount on a container element:
 *    new TinyChips(document.querySelector('#chips'), { data: [...] })
 *
 * 2. Mount on a real form input:
 *    new TinyChips(document.querySelector('#reservation_tags'), { valueMode: 'json' })
 *
 * In input mode, the original input remains the form source of truth.
 * TinyChips hides it visually, creates the visible chips UI after it,
 * and keeps input.value synchronized.
 */
class TinyChips {
    static defaults = {
        data: [],
        placeholder: '',
        secondaryPlaceholder: '',

        /**
         * Form/source input serialization.
         * - json: ["Frontend","Design, UX"]
         * - csv: Frontend,Security,JS
         */
        valueMode: 'json',
        separator: ',',

        /**
         * Data normalization.
         * Use valueField when your data source returns objects.
         * Example: { value: 'Frontend' } with valueField: 'value'.
         */
        valueField: 'value',
        labelField: 'label',
        tagField: 'tag',
        imageField: 'image',
        transformItem: null,
        transformData: null,

        autocompleteOptions: {
            data: [],
            url: '',
            minLength: 1,
            limit: 8,
            debounce: 0,
            queryParam: 'q',
            valueField: '',
            labelField: '',
            tagField: '',
            imageField: '',
            transformItem: null,
            transformData: null,
            transformResponse: null,
            mapResponse: null,

            /**
             * When true, url is fetched once without ?q=... and then filtered locally.
             * Use this for endpoints returning the complete suggestion list.
             */
            loadOnce: false,
            preload: false,

            onAutocomplete: null
        },

        autocompleteUrl: '',
        limit: Infinity,
        allowDuplicates: false,
        trimValue: true,
        separators: ['Enter'],

        pattern: "^[\\p{L}\\p{N}][\\p{L}\\p{N}'’‘`´ʼ._,\\-\\s]*$",
        patternFlags: 'u',

        onChipAdd: null,
        onChipSelect: null,
        onChipDelete: null,
        onChipInvalid: null,
        onAutocompleteError: null,

        /**
         * Called on add, delete, select and setData/val(value).
         * Signature: onChange(data, action, instance)
         */
        onChange: null,
        customClasses : null,
    };

    static init(target, options = {}) {
        return TinyChips.normalizeElements(target).map((element) => {
            const existing = TinyChips.getInstance(element);
            return existing || new TinyChips(element, options);
        });
    }

    static getInstance(target) {
        const element = TinyChips.normalizeElement(target);

        if (!element) {
            return null;
        }

        if (element.TinyChips) {
            return element.TinyChips;
        }

        if (element.dataset && element.dataset.tinyChipsId) {
            return TinyChips.instances.get(element.dataset.tinyChipsId) || null;
        }

        return null;
    }

    static normalizeElement(input, root = document) {
        if (!input) return null;
        if (input instanceof HTMLElement) return input;
        if (typeof input === 'string') return root.querySelector(input);
        if (input.jquery) return input[0] || null;

        if (Array.isArray(input) || input instanceof NodeList || input instanceof HTMLCollection) {
            return input[0] instanceof HTMLElement ? input[0] : null;
        }

        return null;
    }

    static normalizeElements(input, root = document) {
        if (!input) return [];

        if (typeof input === 'string') {
            return Array.from(root.querySelectorAll(input));
        }

        if (input instanceof HTMLElement) {
            return [input];
        }

        if (input instanceof NodeList || input instanceof HTMLCollection) {
            return Array.from(input).filter((element) => element instanceof HTMLElement);
        }

        if (Array.isArray(input)) {
            return input.filter((element) => element instanceof HTMLElement);
        }

        if (input.jquery) {
            return input.toArray().filter((element) => element instanceof HTMLElement);
        }

        return [];
    }

    constructor(element, options = {}) {
        const mountElement = TinyChips.normalizeElement(element);

        if (!(mountElement instanceof HTMLElement)) {
            throw new TypeError('TinyChips requires a valid HTMLElement.');
        }

        this.instanceId = `tiny-chips-${Math.random().toString(36).slice(2, 10)}`;
        this.isInputMode = mountElement instanceof HTMLInputElement;
        this.sourceInput = this.isInputMode ? mountElement : null;
        this.element = this.isInputMode ? this.createRootAfterInput(mountElement) : mountElement;

        const datasetOptions = this.getOptionsFromDataset(this.sourceInput || this.element);

        this.options = {
            ...TinyChips.defaults,
            ...datasetOptions,
            ...options,
            autocompleteOptions: {
                ...TinyChips.defaults.autocompleteOptions,
                ...(datasetOptions.autocompleteOptions || {}),
                ...(options.autocompleteOptions || {})
            }
        };

        if (options.mode && !options.valueMode) {
            this.options.valueMode = options.mode;
        }

        if (!this.options.placeholder && mountElement.getAttribute('placeholder')) {
            this.options.placeholder = mountElement.getAttribute('placeholder');
        }
        if (this.options.customClasses) {
            String(this.options.customClasses)
                .split(/\s+/)
                .map((className) => className.trim())
                .filter(Boolean)
                .forEach((className) => this.element.classList.add(className));
        }

        this.options.autocompleteUrl =
            this.options.autocompleteOptions.url ||
            this.options.autocompleteUrl ||
            '';

        this.chipsData = this.getInitialData();
        this.chipElements = [];
        this.selectedChipIndex = -1;
        this.dropdownItems = [];
        this.highlightedDropdownIndex = -1;
        this.abortController = null;
        this.debounceTimer = null;
        this.autocompleteRemoteLoaded = false;
        this.autocompleteRemoteLoading = null;
        this.patternRegex = this.createPatternRegex();

        this.bound = {
            click: this.handleRootClick.bind(this),
            keydown: this.handleRootKeydown.bind(this),
            inputKeydown: this.handleInputKeydown.bind(this),
            inputInput: this.handleInputInput.bind(this),
            inputFocus: this.handleInputFocus.bind(this),
            inputBlur: this.handleInputBlur.bind(this),
            sourceInputChange: this.handleSourceInputChange.bind(this),
            documentClick: this.handleDocumentClick.bind(this),
            dropdownPointerDown: this.handleDropdownPointerDown.bind(this),
            dropdownClick: this.handleDropdownClick.bind(this),
            resize: this.throttle(this.positionDropdown.bind(this), 100)
        };

        mountElement.TinyChips = this;
        this.element.TinyChips = this;
        this.element.dataset.tinyChipsId = this.instanceId;

        if (this.sourceInput) {
            this.sourceInput.dataset.tinyChipsId = this.instanceId;
        }

        TinyChips.instances.set(this.instanceId, this);
        this.setup();
    }

    createRootAfterInput(input) {
        const root = document.createElement('div');
        root.className = 'tiny-chips';

        if (input.classList.contains('dropdown-up')) {
            root.classList.add('dropdown-up');
        }

        input.insertAdjacentElement('afterend', root);
        input.classList.add('tiny-chips__source-input');
        input.setAttribute('aria-hidden', 'true');
        input.tabIndex = -1;

        return root;
    }

    getOptionsFromDataset(element) {
        const { dataset } = element;
        const options = {};

        if (dataset.placeholder !== undefined) options.placeholder = dataset.placeholder;
        if (dataset.secondaryPlaceholder !== undefined) options.secondaryPlaceholder = dataset.secondaryPlaceholder;
        if (dataset.autocompleteUrl !== undefined) options.autocompleteUrl = dataset.autocompleteUrl;
        if (dataset.url !== undefined) options.autocompleteUrl = dataset.url;
        if (dataset.tinyChipsUrl !== undefined) options.autocompleteUrl = dataset.tinyChipsUrl;
        if (dataset.chipsUrl !== undefined) options.autocompleteUrl = dataset.chipsUrl;

        // Semantic aliases for complete suggestion-list endpoints.
        // These are fetched once without appending ?q=...
        if (dataset.autocompleteSourceUrl !== undefined) options.autocompleteUrl = dataset.autocompleteSourceUrl;
        if (dataset.sourceUrl !== undefined) options.autocompleteUrl = dataset.sourceUrl;
        if (dataset.pattern !== undefined) options.pattern = dataset.pattern;
        if (dataset.patternFlags !== undefined) options.patternFlags = dataset.patternFlags;
        if (dataset.valueMode !== undefined) options.valueMode = dataset.valueMode;
        if (dataset.separator !== undefined) options.separator = dataset.separator;
        if (dataset.valueField !== undefined) options.valueField = dataset.valueField;
        if (dataset.labelField !== undefined) options.labelField = dataset.labelField;
        if (dataset.tagField !== undefined) options.tagField = dataset.tagField;
        if (dataset.imageField !== undefined) options.imageField = dataset.imageField;
        if (dataset.customClasses !== undefined) options.customClasses = dataset.customClasses;

        if (dataset.limit !== undefined) {
            const limit = Number(dataset.limit);
            if (Number.isFinite(limit)) options.limit = limit;
        }

        if (dataset.allowDuplicates !== undefined) {
            options.allowDuplicates = dataset.allowDuplicates === 'true';
        }

        if (dataset.trimValue !== undefined) {
            options.trimValue = dataset.trimValue !== 'false';
        }

        if (
            dataset.autocompleteMinLength !== undefined ||
            dataset.autocompleteLimit !== undefined ||
            dataset.autocompleteQueryParam !== undefined ||
            dataset.autocompleteUrl !== undefined ||
            dataset.url !== undefined ||
            dataset.tinyChipsUrl !== undefined ||
            dataset.chipsUrl !== undefined ||
            dataset.autocompleteSourceUrl !== undefined ||
            dataset.sourceUrl !== undefined ||
            dataset.autocompleteLoadOnce !== undefined ||
            dataset.autocompletePreload !== undefined ||
            dataset.autocompleteValueField !== undefined ||
            dataset.autocompleteLabelField !== undefined ||
            dataset.autocompleteTagField !== undefined ||
            dataset.autocompleteImageField !== undefined
        ) {
            options.autocompleteOptions = {};

            if (dataset.autocompleteUrl !== undefined) {
                options.autocompleteOptions.url = dataset.autocompleteUrl;
            }

            if (dataset.url !== undefined) {
                options.autocompleteOptions.url = dataset.url;
            }

            if (dataset.tinyChipsUrl !== undefined) {
                options.autocompleteOptions.url = dataset.tinyChipsUrl;
            }

            if (dataset.chipsUrl !== undefined) {
                options.autocompleteOptions.url = dataset.chipsUrl;
            }

            if (dataset.autocompleteSourceUrl !== undefined) {
                options.autocompleteOptions.url = dataset.autocompleteSourceUrl;
                options.autocompleteOptions.loadOnce = true;
            }

            if (dataset.sourceUrl !== undefined) {
                options.autocompleteOptions.url = dataset.sourceUrl;
                options.autocompleteOptions.loadOnce = true;
            }

            if (dataset.autocompleteLoadOnce !== undefined) {
                options.autocompleteOptions.loadOnce = dataset.autocompleteLoadOnce !== 'false';
            }

            if (dataset.autocompletePreload !== undefined) {
                options.autocompleteOptions.preload = dataset.autocompletePreload === 'true';
            }

            if (dataset.autocompleteMinLength !== undefined) {
                const minLength = Number(dataset.autocompleteMinLength);
                if (Number.isFinite(minLength)) options.autocompleteOptions.minLength = minLength;
            }

            if (dataset.autocompleteLimit !== undefined) {
                const limit = Number(dataset.autocompleteLimit);
                if (Number.isFinite(limit)) options.autocompleteOptions.limit = limit;
            }

            if (dataset.autocompleteQueryParam !== undefined) {
                options.autocompleteOptions.queryParam = dataset.autocompleteQueryParam;
            }

            if (dataset.autocompleteValueField !== undefined) {
                options.autocompleteOptions.valueField = dataset.autocompleteValueField;
            }

            if (dataset.autocompleteLabelField !== undefined) {
                options.autocompleteOptions.labelField = dataset.autocompleteLabelField;
            }

            if (dataset.autocompleteTagField !== undefined) {
                options.autocompleteOptions.tagField = dataset.autocompleteTagField;
            }

            if (dataset.autocompleteImageField !== undefined) {
                options.autocompleteOptions.imageField = dataset.autocompleteImageField;
            }
        }

        return options;
    }

    setup() {
        this.element.classList.add('tiny-chips');
        this.element.setAttribute('role', 'application');

        this.input = this.findOrCreateInput();
        this.input.classList.add('tiny-chips__input');
        this.input.setAttribute('autocomplete', 'off');

        if (!this.input.id) {
            this.input.id = `${this.instanceId}-input`;
        }

        if (this.patternRegex && this.options.pattern) {
            this.input.setAttribute('pattern', this.options.pattern);
        }

        this.setupLabel();
        this.createDropdown();
        this.renderChips();
        this.setPlaceholder();
        this.syncSourceInput(false);

        if (this.options.autocompleteOptions.preload && this.options.autocompleteUrl && this.options.autocompleteOptions.loadOnce) {
            this.loadAutocompleteOnce().catch((error) => {
                if (typeof this.options.onAutocompleteError === 'function') {
                    this.options.onAutocompleteError.call(this, error);
                }
            });
        }

        this.bindEvents();
    }

    destroy() {
        this.unbindEvents();

        if (this.abortController) {
            this.abortController.abort();
        }

        clearTimeout(this.debounceTimer);
        this.chipElements.forEach((chipElement) => chipElement.remove());
        this.dropdown.remove();

        this.input.classList.remove('tiny-chips__input', 'tiny-chips__input--invalid');
        this.input.removeAttribute('pattern');

        if (this.isInputMode && this.sourceInput) {
            this.sourceInput.classList.remove('tiny-chips__source-input');
            this.sourceInput.removeAttribute('aria-hidden');
            this.sourceInput.removeAttribute('tabindex');
            this.sourceInput.TinyChips = null;
            this.sourceInput.removeAttribute('data-tiny-chips-id');
            this.element.remove();
        } else {
            this.element.classList.remove(
                'tiny-chips',
                'tiny-chips--focus',
                'tiny-chips--invalid',
                'tiny-chips--dropdown-open'
            );
            this.element.TinyChips = null;
            this.element.removeAttribute('data-tiny-chips-id');
        }

        TinyChips.instances.delete(this.instanceId);
    }

    bindEvents() {
        this.element.addEventListener('click', this.bound.click);
        this.element.addEventListener('keydown', this.bound.keydown);
        this.input.addEventListener('keydown', this.bound.inputKeydown);
        this.input.addEventListener('input', this.bound.inputInput);
        this.input.addEventListener('focus', this.bound.inputFocus);
        this.input.addEventListener('blur', this.bound.inputBlur);
        this.dropdown.addEventListener('pointerdown', this.bound.dropdownPointerDown);
        this.dropdown.addEventListener('click', this.bound.dropdownClick);

        if (this.sourceInput) {
            this.sourceInput.addEventListener('change', this.bound.sourceInputChange);
        }

        document.addEventListener('click', this.bound.documentClick);
        window.addEventListener('resize', this.bound.resize);
        window.addEventListener('scroll', this.bound.resize, true);
    }

    unbindEvents() {
        this.element.removeEventListener('click', this.bound.click);
        this.element.removeEventListener('keydown', this.bound.keydown);
        this.input.removeEventListener('keydown', this.bound.inputKeydown);
        this.input.removeEventListener('input', this.bound.inputInput);
        this.input.removeEventListener('focus', this.bound.inputFocus);
        this.input.removeEventListener('blur', this.bound.inputBlur);
        this.dropdown.removeEventListener('pointerdown', this.bound.dropdownPointerDown);
        this.dropdown.removeEventListener('click', this.bound.dropdownClick);

        if (this.sourceInput) {
            this.sourceInput.removeEventListener('change', this.bound.sourceInputChange);
        }

        document.removeEventListener('click', this.bound.documentClick);
        window.removeEventListener('resize', this.bound.resize);
        window.removeEventListener('scroll', this.bound.resize, true);
    }

    findOrCreateInput() {
        const existingInput = this.isInputMode
            ? null
            : this.element.querySelector('input:not(.tiny-chips__source-input)');

        if (existingInput) {
            return existingInput;
        }

        const input = document.createElement('input');
        input.type = 'text';
        this.element.append(input);
        return input;
    }

    setupLabel() {
        const label = this.element.querySelector('label');

        if (label) {
            label.setAttribute('for', this.input.id);
        }
    }

    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'tiny-chips__dropdown tiny-chips__autocomplete';
        this.dropdown.setAttribute('role', 'listbox');
        this.dropdown.hidden = true;
        this.element.append(this.dropdown);
    }

    createPatternRegex() {
        if (!this.options.pattern) {
            return null;
        }

        if (this.options.pattern instanceof RegExp) {
            return this.options.pattern;
        }

        try {
            return new RegExp(this.options.pattern, this.options.patternFlags || '');
        } catch (error) {
            console.warn('[TinyChips] Invalid pattern option:', error);
            return null;
        }
    }

    getInitialData() {
        if (this.sourceInput && this.sourceInput.value) {
            return this.deserializeValue(this.sourceInput.value);
        }

        return this.normalizeData(this.options.data);
    }

    normalizeData(data, context = 'data') {
        const source = typeof this.options.transformData === 'function'
            ? this.options.transformData(data, context)
            : data;

        if (!source) {
            return [];
        }

        if (Array.isArray(source)) {
            return source
                .map((item) => this.normalizeChip(item, context))
                .filter(Boolean);
        }

        if (typeof source === 'object') {
            return Object.keys(source)
                .map((key) => this.normalizeChip(key, context))
                .filter(Boolean);
        }

        if (typeof source === 'string') {
            return this.deserializeValue(source);
        }

        return [];
    }

    normalizeChip(item, context = 'data') {
        const transformItem = context === 'autocomplete'
            ? this.options.autocompleteOptions.transformItem || this.options.transformItem
            : this.options.transformItem;

        const source = typeof transformItem === 'function'
            ? transformItem(item, context)
            : item;

        if (source == null) {
            return null;
        }

        if (typeof source === 'string' || typeof source === 'number') {
            const tag = this.prepareTagValue(String(source));

            return tag ? { tag } : null;
        }

        if (typeof source !== 'object') {
            return null;
        }

        const fields = this.getFieldsForContext(context);
        const rawTag =
            this.readField(source, fields.tagField) ??
            this.readField(source, fields.valueField) ??
            this.readField(source, fields.labelField);

        const tag = this.prepareTagValue(rawTag == null ? '' : String(rawTag));

        if (!tag) {
            return null;
        }

        const labelValue = this.readField(source, fields.labelField);
        const imageValue = this.readField(source, fields.imageField);

        return {
            ...source,
            tag,
            label: labelValue == null ? tag : String(labelValue),
            image: imageValue == null ? source.image : imageValue
        };
    }

    getFieldsForContext(context) {
        if (context === 'autocomplete') {
            return {
                valueField: this.options.autocompleteOptions.valueField || this.options.valueField,
                labelField: this.options.autocompleteOptions.labelField || this.options.labelField,
                tagField: this.options.autocompleteOptions.tagField || this.options.tagField,
                imageField: this.options.autocompleteOptions.imageField || this.options.imageField
            };
        }

        return {
            valueField: this.options.valueField,
            labelField: this.options.labelField,
            tagField: this.options.tagField,
            imageField: this.options.imageField
        };
    }

    readField(source, field) {
        if (!field || typeof source !== 'object') {
            return undefined;
        }

        return field.split('.').reduce((value, key) => {
            if (value == null) {
                return undefined;
            }

            return value[key];
        }, source);
    }

    prepareTagValue(value) {
        const text = String(value);

        return this.options.trimValue ? text.trim() : text;
    }

    deserializeValue(value) {
        if (value == null) {
            return [];
        }

        if (Array.isArray(value)) {
            return this.normalizeData(value);
        }

        if (typeof value === 'object') {
            return this.normalizeData(value);
        }

        const rawValue = String(value).trim();

        if (!rawValue) {
            return [];
        }

        if (this.options.valueMode === 'json') {
            try {
                const parsed = JSON.parse(rawValue);

                if (Array.isArray(parsed)) {
                    return this.normalizeData(parsed);
                }

                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.tags)) {
                        return this.normalizeData(parsed.tags);
                    }

                    if (Array.isArray(parsed.items)) {
                        return this.normalizeData(parsed.items);
                    }

                    if (Array.isArray(parsed.results)) {
                        return this.normalizeData(parsed.results);
                    }

                    if (Array.isArray(parsed.data)) {
                        return this.normalizeData(parsed.data);
                    }

                    return this.normalizeData(parsed);
                }

                if (typeof parsed === 'string' || typeof parsed === 'number') {
                    return this.normalizeData([String(parsed)]);
                }
            } catch (error) {
                console.warn('[TinyChips] Invalid JSON value. Falling back to CSV parsing:', error);
            }
        }

        return rawValue
            .split(this.options.separator)
            .map((tag) => this.normalizeChip(tag, 'data'))
            .filter(Boolean);
    }


    serializeValue(data = this.chipsData) {
        const chips = this.normalizeData(data);
        const values = chips
            .map((chip) => chip && chip.tag)
            .filter((tag) => tag != null && String(tag) !== '')
            .map((tag) => String(tag));

        if (this.options.valueMode === 'json') {
            return JSON.stringify(values);
        }

        return values.join(this.options.separator);
    }

    syncSourceInput(triggerChange = true) {
        if (!this.sourceInput) {
            return;
        }

        const nextValue = this.serializeValue();

        if (this.sourceInput.value === nextValue) {
            return;
        }

        this.isSyncingSourceInput = true;
        this.sourceInput.value = nextValue;

        if (triggerChange) {
            this.sourceInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this.isSyncingSourceInput = false;
    }

    handleSourceInputChange() {
        if (this.isSyncingSourceInput) {
            return;
        }

        this.setData(this.deserializeValue(this.sourceInput.value), {
            silent: false,
            syncSource: false,
            action: 'external'
        });
    }

    val(nextValue) {
        if (arguments.length === 0) {
            return this.sourceInput ? this.sourceInput.value : this.serializeValue();
        }

        this.setData(this.deserializeValue(nextValue), {
            silent: false,
            syncSource: true,
            action: 'val'
        });

        return this;
    }

    getData() {
        return this.chipsData.map((chip) => ({ ...chip }));
    }

    setData(data, options = {}) {
        const settings = {
            silent: false,
            syncSource: true,
            action: 'setData',
            ...options
        };

        this.chipsData = this.normalizeData(data);
        this.clearSelectedChip();
        this.renderChips();
        this.setPlaceholder();
        this.closeDropdown();
        this.clearInvalidState();

        if (settings.syncSource) {
            this.syncSourceInput(true);
        }

        if (!settings.silent) {
            this.emitChange(settings.action);
        }

        return this;
    }

    addChip(chip) {
        const normalizedChip = this.normalizeChip(chip, 'data');
        const validation = this.validateChip(normalizedChip);

        if (!validation.valid) {
            this.handleInvalidChip(validation, normalizedChip);
            return false;
        }

        this.chipsData.push(normalizedChip);

        const chipElement = this.renderChip(normalizedChip, this.chipsData.length - 1);
        this.chipElements.push(chipElement);
        this.input.before(chipElement);

        this.input.value = '';
        this.closeDropdown();
        this.setPlaceholder();
        this.clearInvalidState();
        this.syncSourceInput(true);

        if (typeof this.options.onChipAdd === 'function') {
            this.options.onChipAdd.call(this, this.element, chipElement, normalizedChip);
        }

        this.emitChange('add');

        return true;
    }

    validateChip(chip) {
        if (!chip || typeof chip.tag !== 'string') {
            return { valid: false, reason: 'empty' };
        }

        const tag = chip.tag.trim();

        if (!tag) {
            return { valid: false, reason: 'empty' };
        }

        if (!this.options.allowDuplicates) {
            const duplicate = this.chipsData.some((item) => {
                return item.tag.toLocaleLowerCase() === tag.toLocaleLowerCase();
            });

            if (duplicate) {
                return { valid: false, reason: 'duplicate' };
            }
        }

        if (this.chipsData.length >= this.options.limit) {
            return { valid: false, reason: 'limit' };
        }

        if (this.patternRegex && !this.patternRegex.test(tag)) {
            return { valid: false, reason: 'pattern' };
        }

        return { valid: true, reason: null };
    }

    handleInvalidChip(validation, chip) {
        const value = chip && typeof chip.tag === 'string' ? chip.tag : '';

        if (validation.reason === 'duplicate') {
            this.input.value = '';
            this.closeDropdown();
            this.clearInvalidState();
        } else {
            this.markInputInvalid();
        }

        if (typeof this.options.onChipInvalid === 'function') {
            this.options.onChipInvalid.call(this, {
                value,
                reason: validation.reason
            });
        }
    }

    markInputInvalid() {
        this.element.classList.add('tiny-chips--invalid', 'is-invalid');
        this.input.classList.add('tiny-chips__input--invalid', 'is-invalid');
        this.input.setAttribute('aria-invalid', 'true');
    }

    clearInvalidState() {
        this.element.classList.remove('tiny-chips--invalid', 'is-invalid');
        this.input.classList.remove('tiny-chips__input--invalid', 'is-invalid');
        this.input.removeAttribute('aria-invalid');
    }

    deleteChip(index) {
        if (index < 0 || index >= this.chipsData.length) return false;

        const [removedChip] = this.chipsData.splice(index, 1);
        const [removedElement] = this.chipElements.splice(index, 1);

        if (removedElement) removedElement.remove();

        this.selectedChipIndex = -1;
        this.setPlaceholder();
        this.updateChipIndexes();
        this.syncSourceInput(true);

        if (typeof this.options.onChipDelete === 'function') {
            this.options.onChipDelete.call(this, this.element, removedElement, removedChip);
        }

        this.emitChange('delete');

        return true;
    }

    selectChip(index) {
        if (index < 0 || index >= this.chipElements.length) {
            this.clearSelectedChip();
            return;
        }

        this.clearSelectedChip();

        const chipElement = this.chipElements[index];
        this.selectedChipIndex = index;
        chipElement.classList.add('tiny-chips__chip--selected', 'selected');
        chipElement.focus();

        if (typeof this.options.onChipSelect === 'function') {
            this.options.onChipSelect.call(this, this.element, chipElement, this.chipsData[index]);
        }

        this.emitChange('select');
    }

    emitChange(action) {
        if (typeof this.options.onChange === 'function') {
            this.options.onChange.call(this, this.getData(), action, this);
        }
    }

    clearSelectedChip() {
        if (this.selectedChipIndex >= 0 && this.chipElements[this.selectedChipIndex]) {
            this.chipElements[this.selectedChipIndex].classList.remove('tiny-chips__chip--selected', 'selected');
        }

        this.selectedChipIndex = -1;
    }

    renderChips() {
        this.chipElements.forEach((chipElement) => chipElement.remove());
        this.chipElements = [];

        this.chipsData.forEach((chip, index) => {
            const chipElement = this.renderChip(chip, index);
            this.chipElements.push(chipElement);
            this.input.before(chipElement);
        });
    }

    renderChip(chip, index) {
        const chipElement = document.createElement('span');
        chipElement.className = 'chip tiny-chips__chip';
        chipElement.tabIndex = 0;
        chipElement.dataset.index = String(index);

        if (chip.image) {
            const image = document.createElement('img');
            image.className = 'tiny-chips__chip-image';
            image.src = chip.image;
            image.alt = '';
            chipElement.append(image);
        }

        const text = document.createElement('span');
        text.className = 'tiny-chips__chip-text';
        text.textContent = chip.label || chip.tag;
        chipElement.append(text);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'tiny-chips__chip-close close';
        closeButton.setAttribute('aria-label', `Remove ${chip.label || chip.tag}`);
        closeButton.textContent = '×';
        chipElement.append(closeButton);

        return chipElement;
    }

    updateChipIndexes() {
        this.chipElements.forEach((chipElement, index) => {
            chipElement.dataset.index = String(index);
        });
    }

    setPlaceholder() {
        if (!this.chipsData.length && this.options.placeholder) {
            this.input.placeholder = this.options.placeholder;
            return;
        }

        if (this.chipsData.length && this.options.secondaryPlaceholder) {
            this.input.placeholder = this.options.secondaryPlaceholder;
            return;
        }

        this.input.placeholder = '';
    }

    handleRootClick(event) {
        const closeButton = event.target.closest('.tiny-chips__chip-close, .close');
        const chipElement = event.target.closest('.tiny-chips__chip, .chip');

        if (closeButton && chipElement && this.element.contains(chipElement)) {
            event.preventDefault();
            this.deleteChip(Number(chipElement.dataset.index));
            this.input.focus();
            return;
        }

        if (chipElement && this.element.contains(chipElement)) {
            this.selectChip(Number(chipElement.dataset.index));
            return;
        }

        this.input.focus();
    }

    handleRootKeydown(event) {
        if (event.target === this.input) return;

        const chipElement = event.target.closest('.tiny-chips__chip, .chip');
        if (!chipElement || !this.element.contains(chipElement)) return;

        const index = Number(chipElement.dataset.index);

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            this.deleteChip(index);

            if (this.chipsData.length) {
                this.selectChip(Math.max(index - 1, 0));
            } else {
                this.input.focus();
            }
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (index > 0) this.selectChip(index - 1);
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            if (index < this.chipsData.length - 1) {
                this.selectChip(index + 1);
            } else {
                this.input.focus();
            }
        }
    }

    handleInputKeydown(event) {
        if (this.options.separators.includes(event.key)) {
            if (this.isDropdownOpen() && this.highlightedDropdownIndex >= 0) {
                event.preventDefault();
                this.chooseDropdownItem(this.highlightedDropdownIndex);
                return;
            }

            event.preventDefault();
            this.addChip({ tag: this.input.value });
            return;
        }

        if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && this.input.value === '' && this.chipsData.length) {
            event.preventDefault();
            this.selectChip(this.chipsData.length - 1);
            return;
        }

        if (event.key === 'ArrowDown' && this.isDropdownOpen()) {
            event.preventDefault();
            this.highlightDropdownItem(this.highlightedDropdownIndex + 1);
        }

        if (event.key === 'ArrowUp' && this.isDropdownOpen()) {
            event.preventDefault();
            this.highlightDropdownItem(this.highlightedDropdownIndex - 1);
        }

        if (event.key === 'Escape') {
            this.closeDropdown();
        }
    }

    handleInputInput() {
        this.clearSelectedChip();
        this.clearInvalidState();

        const query = this.input.value.trim();

        if (!query || query.length < this.options.autocompleteOptions.minLength) {
            this.closeDropdown();
            return;
        }

        this.scheduleAutocomplete(query);
    }

    handleInputFocus() {
        this.element.classList.add('tiny-chips--focus', 'focus');

        if (this.input.value.trim()) {
            this.scheduleAutocomplete(this.input.value.trim());
        }
    }

    handleInputBlur() {
        this.element.classList.remove('tiny-chips--focus', 'focus');
    }

    handleDocumentClick(event) {
        if (!this.element.contains(event.target)) {
            this.clearSelectedChip();
            this.closeDropdown();
        }
    }

    handleDropdownPointerDown(event) {
        event.preventDefault();
    }

    handleDropdownClick(event) {
        const option = event.target.closest('.tiny-chips__dropdown-option');
        if (!option || !this.dropdown.contains(option)) return;
        this.chooseDropdownItem(Number(option.dataset.index));
    }

    scheduleAutocomplete(query) {
        clearTimeout(this.debounceTimer);

        const delay = Number(this.options.autocompleteOptions.debounce) || 0;

        if (!delay) {
            this.updateAutocomplete(query);
            return;
        }

        this.debounceTimer = setTimeout(() => {
            this.updateAutocomplete(query);
        }, delay);
    }

    async updateAutocomplete(query) {
        if (this.options.autocompleteUrl && this.options.autocompleteOptions.loadOnce) {
            try {
                await this.loadAutocompleteOnce();
            } catch (error) {
                if (error.name === 'AbortError') return;

                if (typeof this.options.onAutocompleteError === 'function') {
                    this.options.onAutocompleteError.call(this, error);
                }
            }

            this.openDropdown(this.getLocalAutocompleteResults(query));
            return;
        }

        const localResults = this.getLocalAutocompleteResults(query);

        if (this.options.autocompleteUrl) {
            try {
                const remoteResults = await this.fetchAutocompleteResults(query);
                this.openDropdown(this.mergeAutocompleteResults(localResults, remoteResults));
            } catch (error) {
                if (error.name === 'AbortError') return;

                if (typeof this.options.onAutocompleteError === 'function') {
                    this.options.onAutocompleteError.call(this, error);
                }

                this.openDropdown(localResults);
            }

            return;
        }

        this.openDropdown(localResults);
    }

    getLocalAutocompleteResults(query) {
        const source = this.options.autocompleteOptions.data || [];
        const normalizedQuery = query.toLocaleLowerCase();

        return this.normalizeAutocompleteData(source, 'local')
            .filter((item) => (item.label || item.tag).toLocaleLowerCase().includes(normalizedQuery))
            .filter((item) => this.options.allowDuplicates || !this.chipsData.some((chip) => chip.tag.toLocaleLowerCase() === item.tag.toLocaleLowerCase()))
            .slice(0, this.options.autocompleteOptions.limit);
    }

    normalizeAutocompleteData(data, sourceType = 'local') {
        const transformData = this.options.autocompleteOptions.transformData;

        const source = typeof transformData === 'function'
            ? transformData(data, sourceType)
            : data;

        if (!source) {
            return [];
        }

        if (Array.isArray(source)) {
            return source
                .map((item) => this.normalizeChip(item, 'autocomplete'))
                .filter(Boolean);
        }

        if (typeof source === 'object') {
            return Object.keys(source)
                .map((key) => this.normalizeChip(key, 'autocomplete'))
                .filter(Boolean);
        }

        return [];
    }

    async loadAutocompleteOnce() {
        if (this.autocompleteRemoteLoaded) {
            return this.options.autocompleteOptions.data;
        }

        if (this.autocompleteRemoteLoading) {
            return this.autocompleteRemoteLoading;
        }

        this.autocompleteRemoteLoading = this.fetchAutocompleteList()
            .then((items) => {
                const currentData = this.normalizeAutocompleteData(
                    this.options.autocompleteOptions.data || [],
                    'local'
                );

                const seen = new Set();
                const mergedData = [...currentData, ...items].filter((item) => {
                    const key = item.tag.toLocaleLowerCase();

                    if (seen.has(key)) {
                        return false;
                    }

                    seen.add(key);
                    return true;
                });

                this.options.autocompleteOptions.data = mergedData;
                this.autocompleteRemoteLoaded = true;

                return mergedData;
            })
            .finally(() => {
                this.autocompleteRemoteLoading = null;
            });

        return this.autocompleteRemoteLoading;
    }

    async fetchAutocompleteList() {
        if (this.abortController) this.abortController.abort();

        this.abortController = new AbortController();

        const response = await fetch(new URL(this.options.autocompleteUrl, window.location.href).toString(), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            signal: this.abortController.signal
        });

        if (!response.ok) {
            throw new Error(`TinyChips autocomplete preload request failed with status ${response.status}.`);
        }

        const payload = await response.json();
        const list = this.extractResponseList(payload);

        return this.normalizeAutocompleteData(list, 'remote')
            .filter((item) => this.options.allowDuplicates || !this.chipsData.some((chip) => chip.tag.toLocaleLowerCase() === item.tag.toLocaleLowerCase()))
            .slice(0, this.options.autocompleteOptions.limit);
    }


    async fetchAutocompleteResults(query) {
        if (this.abortController) this.abortController.abort();

        this.abortController = new AbortController();

        const url = new URL(this.options.autocompleteUrl, window.location.href);
        url.searchParams.set(this.options.autocompleteOptions.queryParam || 'q', query);

        const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json','X-Requested-With': 'XMLHttpRequest'},
            signal: this.abortController.signal
        });

        if (!response.ok) {
            throw new Error(`TinyChips autocomplete request failed with status ${response.status}.`);
        }

        const payload = await response.json();

        const list = this.extractResponseList(payload);

        return this.normalizeAutocompleteData(list, 'remote')
            .filter((item) => this.options.allowDuplicates || !this.chipsData.some((chip) => chip.tag.toLocaleLowerCase() === item.tag.toLocaleLowerCase()))
            .slice(0, this.options.autocompleteOptions.limit);
    }

    extractResponseList(payload) {
        const transformer =
            this.options.autocompleteOptions.transformResponse ||
            this.options.autocompleteOptions.mapResponse;

        if (typeof transformer === 'function') {
            return transformer(payload);
        }

        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload.results)) {
            return payload.results;
        }

        if (Array.isArray(payload.items)) {
            return payload.items;
        }

        if (Array.isArray(payload.data)) {
            return payload.data;
        }

        return [];
    }

    mergeAutocompleteResults(localResults, remoteResults) {
        const seen = new Set();

        return [...localResults, ...remoteResults]
            .filter((item) => {
                const key = item.tag.toLocaleLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, this.options.autocompleteOptions.limit);
    }

    openDropdown(items) {
        this.dropdownItems = items;

        if (!items.length) {
            this.closeDropdown();
            return;
        }

        this.dropdown.innerHTML = '';

        items.forEach((item, index) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'tiny-chips__dropdown-option tiny-chips__autocomplete-option';
            option.setAttribute('role', 'option');
            option.dataset.index = String(index);

            if (item.image) {
                const image = document.createElement('img');
                image.className = 'tiny-chips__dropdown-image';
                image.src = item.image;
                image.alt = '';
                option.append(image);
            }

            const text = document.createElement('span');
            text.textContent = item.label || item.tag;
            option.append(text);

            this.dropdown.append(option);
        });

        this.dropdown.hidden = false;
        this.element.classList.add('tiny-chips--dropdown-open');
        this.highlightDropdownItem(0);
        this.positionDropdown();
    }

    closeDropdown() {
        this.dropdown.hidden = true;
        this.dropdown.innerHTML = '';
        this.dropdownItems = [];
        this.highlightedDropdownIndex = -1;
        this.element.classList.remove('tiny-chips--dropdown-open');
    }

    isDropdownOpen() {
        return !this.dropdown.hidden;
    }

    highlightDropdownItem(index) {
        if (!this.dropdownItems.length) {
            this.highlightedDropdownIndex = -1;
            return;
        }

        const nextIndex = ((index % this.dropdownItems.length) + this.dropdownItems.length) % this.dropdownItems.length;
        this.highlightedDropdownIndex = nextIndex;

        Array.from(this.dropdown.children).forEach((option, optionIndex) => {
            const active = optionIndex === nextIndex;
            option.classList.toggle('tiny-chips__dropdown-option--active', active);
            option.classList.toggle('is-active', active);
            option.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    chooseDropdownItem(index) {
        const item = this.dropdownItems[index];
        if (!item) return;

        const added = this.addChip(item);

        if (added && typeof this.options.autocompleteOptions.onAutocomplete === 'function') {
            this.options.autocompleteOptions.onAutocomplete.call(this, item.tag, item);
        }

        this.input.focus();
    }

    positionDropdown() {
        if (this.dropdown.hidden) return;

        this.dropdown.classList.remove(
            'tiny-chips__dropdown--top',
            'tiny-chips__dropdown--bottom',
            'is-top',
            'is-bottom'
        );
        this.element.classList.remove('has-autocomplete-top', 'has-autocomplete-bottom');

        const rootRect = this.element.getBoundingClientRect();
        const dropdownHeight = this.dropdown.offsetHeight || 240;
        const spaceBelow = window.innerHeight - rootRect.bottom;
        const spaceAbove = rootRect.top;
        const forcedUp = this.element.classList.contains('dropdown-up');
        const shouldOpenTop = forcedUp || (spaceBelow < dropdownHeight && spaceAbove > spaceBelow);

        this.dropdown.classList.toggle('tiny-chips__dropdown--top', shouldOpenTop);
        this.dropdown.classList.toggle('tiny-chips__dropdown--bottom', !shouldOpenTop);
        this.dropdown.classList.toggle('is-top', shouldOpenTop);
        this.dropdown.classList.toggle('is-bottom', !shouldOpenTop);
        this.element.classList.toggle('has-autocomplete-top', shouldOpenTop);
        this.element.classList.toggle('has-autocomplete-bottom', !shouldOpenTop);
    }

    throttle(callback, delay) {
        let timeoutId = null;
        let lastRun = 0;

        return (...args) => {
            const now = Date.now();
            const remaining = delay - (now - lastRun);

            clearTimeout(timeoutId);

            if (remaining <= 0) {
                lastRun = now;
                callback(...args);
                return;
            }

            timeoutId = setTimeout(() => {
                lastRun = Date.now();
                callback(...args);
            }, remaining);
        };
    }
}

TinyChips.instances = new Map();
window.TinyChips = TinyChips;
