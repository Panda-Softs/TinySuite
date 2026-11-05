/*!
 * TinyColorPicker
 * Dependency-free ES6 color picker inspired by ColorPick.js.
 * MIT License
 */
(function (global) {
    'use strict';

    const DEFAULT_PALETTE = [
        '#1ABC9C', '#16A085', '#2ECC71', '#27AE60',
        '#3498DB', '#2980B9', '#9B59B6', '#8E44AD',
        '#34495E', '#2C3E50', '#F1C40F', '#F39C12',
        '#E67E22', '#D35400', '#E74C3C', '#C0392B',
        '#ECF0F1', '#BDC3C7', '#95A5A6', '#7F8C8D'
    ];

    const DEFAULT_OPTIONS = Object.freeze({
        initialColor: '#3498DB',
        paletteLabel: 'Default palette:',
        recentLabel: 'Recent:',
        customColorLabel: '',
        customPickerLabel: 'Custom color',
        allowRecent: true,
        recentMax: 5,
        allowCustomColor: false,
        allowClearColor: false,
        palette: DEFAULT_PALETTE,
        parentContainer: null,
        direction: 'auto', // auto | down | up
        storageKey: 'colorPickRecentItems',
        closeOnSelect: true,
        onColorSelected: null
    });

    const pickerInstances = new WeakMap();
    let activePicker = null;
    let pickerCounter = 0;
    let globalListenersBound = false;

    function isHexColor(value) {
        return typeof value === 'string' && /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/i.test(value || '');
    }

    function normalizeColor(value) {
        const rawValue = String(value ?? '').trim();
        if (!rawValue) return '';

        const valueWithHash = rawValue.startsWith('#') ? rawValue : `#${rawValue}`;
        return isHexColor(valueWithHash) ? valueWithHash.toUpperCase() : '';
    }

    function getContrastColor(color) {
        if (!color) return 'currentColor';

        let hex = color.slice(1);
        if (hex.length === 3) {
            hex = [...hex].map(character => character + character).join('');
        }

        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);
        const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

        return luminance > 160 ? '#172033' : '#FFFFFF';
    }

    function createElement(tagName, className, attributes = {}) {
        const element = document.createElement(tagName);
        if (className) element.className = className;

        Object.entries(attributes).forEach(([name, value]) => {
            if (value !== null && value !== undefined) {
                element.setAttribute(name, String(value));
            }
        });

        return element;
    }

    class TinyColorPicker {

        static create(target, options = {}) {
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            return element ? new TinyColorPicker(element, options) : null;
        }

        static init(targets, options = {}) {
            const elements = typeof targets === 'string'
                ? document.querySelectorAll(targets)
                : targets instanceof Element
                    ? [targets]
                    : targets;

            return Array.from(elements || [], element => new TinyColorPicker(element, options));
        }

        static getInstance(target) {
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            return element ? pickerInstances.get(element) || null : null;
        }

        constructor(element, options = {}) {
            if (!(element instanceof HTMLInputElement)) {
                throw new TypeError('TinyColorPicker expects an HTMLInputElement.');
            }

            const existingInstance = pickerInstances.get(element);
            if (existingInstance) return existingInstance;

            this.id = `tcp-${++pickerCounter}`;
            this.element = element;
            this.options = { ...DEFAULT_OPTIONS, ...options };
            this.palette = this.normalizePalette(this.options.palette);
            this.color = this.resolveInitialColor();
            this.parentContainer = null;
            this.usesCustomParent = false;
            this.picker = null;
            this.customInput = null;
            this.nativeColorInput = null;
            this.recentColorsContainer = null;
            this.isOpen = false;
            this.positionFrame = null;

            // Stable handlers avoid creating new functions whenever the picker opens.
            this.handleTriggerClick = event => this.onTriggerClick(event);
            this.handleTriggerKeydown = event => this.onTriggerKeydown(event);
            this.handleExternalChange = () => this.onExternalChange();
            this.handlePickerClick = event => this.onPickerClick(event);
            this.handlePickerKeydown = event => this.onPickerKeydown(event);
            this.handleCustomInput = () => this.onCustomInput();
            this.handleCustomKeydown = event => this.onCustomKeydown(event);
            this.handleNativeColorInput = event => this.onNativeColorInput(event);
            this.handleNativeColorChange = event => this.onNativeColorChange(event);
            this.handlePositionChange = () => this.schedulePositionUpdate();

            pickerInstances.set(element, this);
            this.initialize();
            TinyColorPicker.bindGlobalListeners();
        }

        getValue() {
            return this.color;
        }

        setValue(value) {
            const resolvedColor = this.resolveValue(value);
            if (resolvedColor === null) return this;

            this.applyColor(resolvedColor, { storeRecent: true, notify: true });
            return this;
        }

        clear() {
            if (!this.options.allowClearColor) return this;
            return this.setValue('');
        }

        show() {
            if (this.isOpen) return this;
            if (activePicker && activePicker !== this) activePicker.hide();

            activePicker = this;
            this.isOpen = true;

            this.refreshRecentColors();

            // Position first, then only animate opacity/translateY.
            // left/top are never part of the CSS transition.
            this.updatePosition();
            this.bindPositionListeners();

            this.element.setAttribute('aria-expanded', 'true');
            this.picker.classList.add('tcp-picker--open');

            return this;
        }

        hide() {
            if (!this.isOpen) return this;

            this.isOpen = false;
            this.picker.classList.remove('tcp-picker--open');
            this.element.setAttribute('aria-expanded', 'false');
            this.unbindPositionListeners();

            if (activePicker === this) activePicker = null;
            return this;
        }

        toggle() {
            return this.isOpen ? this.hide() : this.show();
        }

        destroy() {
            this.hide();
            this.element.removeEventListener('click', this.handleTriggerClick);
            this.element.removeEventListener('keydown', this.handleTriggerKeydown);
            this.element.removeEventListener('change', this.handleExternalChange);
            this.element.classList.remove('tcp-input', 'tcp-input--empty');
            this.element.removeAttribute('aria-haspopup');
            this.element.removeAttribute('aria-expanded');
            this.element.removeAttribute('aria-controls');
            this.element.style.removeProperty('--tcp-color');
            this.element.style.removeProperty('--tcp-color-contrast');
            this.element.readOnly = false;
            this.picker?.remove();

            pickerInstances.delete(this.element);
            return null;
        }

        initialize() {
            this.element.readOnly = true;
            this.element.classList.add('tcp-input');
            this.element.setAttribute('aria-haspopup', 'dialog');
            this.element.setAttribute('aria-expanded', 'false');
            this.element.setAttribute('aria-controls', `${this.id}-picker`);
            this.element.value = this.color;

            this.element.addEventListener('click', this.handleTriggerClick);
            this.element.addEventListener('keydown', this.handleTriggerKeydown);
            this.element.addEventListener('change', this.handleExternalChange);

            this.syncInputColorVariables();
            this.renderPicker();
            this.notifyColorSelected(false);
        }

        resolveInitialColor() {
            const inputValue = String(this.element.value || '').trim();

            if (inputValue) {
                return normalizeColor(inputValue)
                    || normalizeColor(this.options.initialColor)
                    || DEFAULT_OPTIONS.initialColor;
            }

            // Empty is a real value when clearing is allowed.
            if (this.options.allowClearColor) return '';

            const dataInitialColor = this.element.dataset.initialColor
                ?? this.element.getAttribute('data-initialcolor');

            return normalizeColor(dataInitialColor ?? this.options.initialColor)
                || DEFAULT_OPTIONS.initialColor;
        }

        resolveValue(value) {
            const rawValue = String(value ?? '').trim();
            if (!rawValue) return this.options.allowClearColor ? '' : null;

            return normalizeColor(rawValue) || null;
        }

        normalizePalette(palette) {
            const uniqueColors = new Set();

            (Array.isArray(palette) ? palette : []).forEach(color => {
                const normalizedColor = normalizeColor(color);
                if (normalizedColor) uniqueColors.add(normalizedColor);
            });

            return [...uniqueColors];
        }

        onTriggerClick(event) {
            if (event.target !== this.element) return;

            event.preventDefault();
            event.stopPropagation();
            this.toggle();
        }

        onTriggerKeydown(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.toggle();
                return;
            }

            if (event.key === 'Escape') this.hide();
        }

        onExternalChange() {
            const resolvedColor = this.resolveValue(this.element.value);
            if (resolvedColor !== null && resolvedColor !== this.color) {
                this.applyColor(resolvedColor, { storeRecent: false, notify: true });
            }
        }

        renderPicker() {
            this.parentContainer = this.resolveParentContainer();
            this.usesCustomParent = this.parentContainer !== document.body
                && this.parentContainer !== document.documentElement;

            this.picker = createElement('div', 'tcp-picker', {
                id: `${this.id}-picker`,
                role: 'dialog',
                'aria-label': 'Color picker'
            });

            this.picker.classList.add(this.usesCustomParent
                ? 'tcp-picker--absolute'
                : 'tcp-picker--fixed');

            this.appendPaletteSection();

            if (this.options.allowCustomColor) this.appendCustomColorSection();
            if (this.options.allowRecent) this.appendRecentColorsSection();

            // Render once. Using body by default prevents parent stacking contexts
            // (cards, transformed elements, backdrop-filter, etc.) from covering it.
            this.parentContainer.append(this.picker);
            this.picker.addEventListener('click', this.handlePickerClick);
            this.picker.addEventListener('keydown', this.handlePickerKeydown);
            this.customInput?.addEventListener('input', this.handleCustomInput);
            this.customInput?.addEventListener('keydown', this.handleCustomKeydown);
            this.nativeColorInput?.addEventListener('input', this.handleNativeColorInput);
            this.nativeColorInput?.addEventListener('change', this.handleNativeColorChange);
        }

        appendPaletteSection() {
            const section = this.createSection(this.options.paletteLabel, 'palette');
            const colors = createElement('div', 'tcp-colors');

            this.palette.forEach(color => colors.append(this.createColorSwatch(color)));

            if (this.options.allowClearColor) {
                const clearSwatch = this.createColorSwatch('', 'Clear color');
                clearSwatch.classList.add('tcp-color--clear');
                colors.append(clearSwatch);
            }

            if (this.options.allowCustomColor) {
                const customSwatch = createElement('div', 'tcp-color tcp-color--custom', {
                    role: 'button',
                    tabindex: '0',
                    'aria-label': this.options.customPickerLabel,
                    title: this.options.customPickerLabel
                });
                colors.append(customSwatch);
            }

            section.append(colors);
            this.picker.append(section);
        }

        appendCustomColorSection() {
            const section = this.createSection(this.options.customColorLabel, 'custom');

            this.customInput = createElement('input', 'tcp-custom-input', {
                type: 'text',
                placeholder: '#3498DB',
                maxlength: 7,
                spellcheck: 'false',
                autocomplete: 'off',
                'aria-label': this.options.customColorLabel || 'Custom color'
            });
            this.customInput.value = this.color;

            // The native color input is hidden; the palette's custom swatch opens it.
            // Keeping it in the DOM gives us the browser's fast, familiar color UI
            // without adding any dependency or custom HSV canvas logic.
            this.nativeColorInput = createElement('input', 'tcp-native-color-input', {
                type: 'color',
                tabindex: '-1',
                'aria-hidden': 'true'
            });
            this.nativeColorInput.value = this.color || normalizeColor(this.options.initialColor) || DEFAULT_OPTIONS.initialColor;

            section.append(this.customInput, this.nativeColorInput);
            this.picker.append(section);
        }

        appendRecentColorsSection() {
            const section = this.createSection(this.options.recentLabel, 'recent');
            this.recentColorsContainer = createElement('div', 'tcp-colors');
            section.append(this.recentColorsContainer);
            this.picker.append(section);
            this.refreshRecentColors();
        }

        refreshRecentColors() {
            if (!this.recentColorsContainer) return;

            const recentColors = this.getRecentColors().slice(0, this.options.recentMax);
            const fragment = document.createDocumentFragment();

            if (!recentColors.length) {
                fragment.append(createElement('div', 'tcp-color tcp-color--dummy', {
                    'aria-hidden': 'true'
                }));
            } else {
                recentColors.forEach(color => fragment.append(this.createColorSwatch(color)));
            }

            this.recentColorsContainer.replaceChildren(fragment);
        }

        createSection(labelText, modifier) {
            const section = createElement('section', `tcp-section tcp-section--${modifier}`);

            // ColorPick did not render a label above the custom HEX field.
            // A label is still supported when explicitly provided.
            if (labelText) {
                const label = createElement('div', 'tcp-section__label');
                label.textContent = labelText;
                section.append(label);
            }

            return section;
        }

        createColorSwatch(color, label = color) {
            const swatch = createElement('div', 'tcp-color', {
                role: 'button',
                tabindex: '0',
                'data-color': color,
                'aria-label': label || 'Clear color',
                title: label || 'Clear color'
            });

            // Swatches use a CSS variable, keeping visual styling outside JavaScript.
            if (color) swatch.style.setProperty('--tcp-swatch-color', color);
            return swatch;
        }

        onPickerClick(event) {
            event.stopPropagation();

            const colorSwatch = event.target.closest('.tcp-color:not(.tcp-color--dummy)');
            if (!colorSwatch || !this.picker.contains(colorSwatch)) return;

            event.preventDefault();

            if (colorSwatch.classList.contains('tcp-color--custom')) {
                this.openNativeColorPicker();
                return;
            }

            this.applyColor(colorSwatch.dataset.color ?? '', { storeRecent: true, notify: true });

            if (this.options.closeOnSelect) this.hide();
        }

        onPickerKeydown(event) {
            if (event.key !== 'Enter' && event.key !== ' ') return;

            const colorSwatch = event.target.closest('.tcp-color[role="button"]');
            if (!colorSwatch || !this.picker.contains(colorSwatch)) return;

            event.preventDefault();
            colorSwatch.click();
        }

        openNativeColorPicker() {
            if (!this.nativeColorInput) return;

            // input[type=color] cannot represent an empty value. Keep the last
            // selected color, or fall back to the configured initial color.
            if (this.color) this.nativeColorInput.value = this.color;
            this.nativeColorInput.click();
        }

        onNativeColorInput(event) {
            const color = normalizeColor(event.target.value);
            if (!color) return;

            // Live preview without filling the recent-color history while the
            // user is still moving inside the native browser picker.
            this.applyColor(color, { storeRecent: false, notify: true });
        }

        onNativeColorChange(event) {
            const color = normalizeColor(event.target.value);
            if (!color) return;

            this.applyColor(color, { storeRecent: true, notify: true });
            if (this.options.closeOnSelect) this.hide();
        }

        onCustomInput() {
            const rawValue = this.customInput.value.trim();
            const color = normalizeColor(rawValue);
            const isEmptyAllowed = !rawValue && this.options.allowClearColor;
            const isValid = Boolean(color) || isEmptyAllowed;

            this.customInput.classList.toggle('tcp-custom-input--error', !isValid);
            this.customInput.setAttribute('aria-invalid', String(!isValid));

            if (color) {
                this.applyColor(color, { storeRecent: true, notify: true });
            } else if (isEmptyAllowed) {
                this.applyColor('', { storeRecent: false, notify: true });
            }
        }

        onCustomKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hide();
                this.element.focus();
                return;
            }

            const value = this.customInput.value.trim();
            const isValid = Boolean(normalizeColor(value)) || (!value && this.options.allowClearColor);

            if (event.key === 'Enter' && isValid) {
                event.preventDefault();
                this.hide();
                this.element.focus();
            }
        }

        applyColor(color, { storeRecent, notify }) {
            const hasChanged = color !== this.color || this.element.value !== color;

            if (storeRecent && color) {
                this.appendRecentColor(color);
                if (this.isOpen) this.refreshRecentColors();
            }

            if (!hasChanged) return;

            this.color = color;
            this.element.value = color;
            this.syncInputColorVariables();

            if (this.customInput && this.customInput.value !== color) {
                this.customInput.value = color;
            }

            if (this.nativeColorInput && color && this.nativeColorInput.value !== color) {
                this.nativeColorInput.value = color;
            }

            if (notify) this.notifyColorSelected(true);
        }

        syncInputColorVariables() {
            const hasColor = Boolean(this.color);

            // Project CSS can style the field without JavaScript forcing a background color.
            this.element.style.setProperty('--tcp-color', hasColor ? this.color : 'transparent');
            this.element.style.setProperty('--tcp-color-contrast', getContrastColor(this.color));
            this.element.classList.toggle('tcp-input--empty', !hasColor);
        }

        notifyColorSelected(dispatchChangeEvent) {
            if (typeof this.options.onColorSelected === 'function') {
                this.options.onColorSelected.call(this, this.color, this.element);
            }

            if (!dispatchChangeEvent) return;

            this.element.dispatchEvent(new CustomEvent('tinycolorpicker:change', {
                bubbles: true,
                detail: { color: this.color, picker: this }
            }));
        }

        getRecentColors() {
            try {
                const storedColors = JSON.parse(localStorage.getItem(this.options.storageKey)) || [];
                return this.normalizePalette(storedColors);
            } catch (error) {
                return [];
            }
        }

        appendRecentColor(color) {
            if (!this.options.allowRecent || !color) return;

            const recentColors = this.getRecentColors().filter(recentColor => recentColor !== color);
            recentColors.unshift(color);

            try {
                localStorage.setItem(
                    this.options.storageKey,
                    JSON.stringify(recentColors.slice(0, this.options.recentMax))
                );
            } catch (error) {
                // localStorage can be unavailable in private/restricted browser contexts.
            }
        }

        resolveParentContainer() {
            const configuredParent = this.options.parentContainer;

            if (configuredParent instanceof Element) return configuredParent;

            if (typeof configuredParent === 'string' && configuredParent) {
                try {
                    return this.element.closest(configuredParent)
                        || document.querySelector(configuredParent)
                        || document.body;
                } catch (error) {
                    return document.body;
                }
            }

            return document.body;
        }

        shouldOpenUp(anchorRect = this.element.getBoundingClientRect()) {
            if (this.options.direction === 'up') return true;
            if (this.options.direction === 'down') return false;
            if (this.element.classList.contains('dropdown-up')) return true;

            const pickerHeight = this.picker?.offsetHeight || 0;
            const spaceBelow = window.innerHeight - anchorRect.bottom;
            const spaceAbove = anchorRect.top;

            return spaceBelow < pickerHeight + 12 && spaceAbove > spaceBelow;
        }

        setDirection(openUp) {
            this.picker.classList.toggle('tcp-picker--up', openUp);
            this.picker.classList.toggle('tcp-picker--down', !openUp);
        }

        updatePosition() {
            if (!this.picker || !this.element.isConnected) return;

            const anchorRect = this.element.getBoundingClientRect();
            const pickerWidth = this.picker.offsetWidth;
            const pickerHeight = this.picker.offsetHeight;
            const openUp = this.shouldOpenUp(anchorRect);
            const gap = 5;

            this.setDirection(openUp);

            if (!this.usesCustomParent) {
                const maxLeft = Math.max(gap, window.innerWidth - pickerWidth - gap);
                const maxTop = Math.max(gap, window.innerHeight - pickerHeight - gap);
                const desiredTop = openUp
                    ? anchorRect.top - pickerHeight - gap
                    : anchorRect.bottom + gap;

                this.picker.style.left = `${Math.min(Math.max(gap, anchorRect.left), maxLeft)}px`;
                this.picker.style.top = `${Math.min(Math.max(gap, desiredTop), maxTop)}px`;
                return;
            }

            // Custom containers keep the picker inside their stacking context.
            // Coordinates are relative to the picker's real offset parent.
            const offsetParent = this.picker.offsetParent || this.parentContainer;
            const parentRect = offsetParent.getBoundingClientRect();
            const left = anchorRect.left - parentRect.left + offsetParent.scrollLeft;
            const anchorTop = anchorRect.top - parentRect.top + offsetParent.scrollTop;
            const top = openUp
                ? anchorTop - pickerHeight - gap
                : anchorTop + anchorRect.height + gap;
            const maxLeft = Math.max(gap, offsetParent.clientWidth - pickerWidth - gap);

            this.picker.style.left = `${Math.min(Math.max(gap, left), maxLeft)}px`;
            this.picker.style.top = `${Math.max(gap, top)}px`;
        }

        schedulePositionUpdate() {
            if (this.positionFrame) return;

            this.positionFrame = requestAnimationFrame(() => {
                this.positionFrame = null;
                if (this.isOpen) this.updatePosition();
            });
        }

        bindPositionListeners() {
            window.addEventListener('resize', this.handlePositionChange, { passive: true });
            document.addEventListener('scroll', this.handlePositionChange, { passive: true, capture: true });
        }

        unbindPositionListeners() {
            window.removeEventListener('resize', this.handlePositionChange);
            document.removeEventListener('scroll', this.handlePositionChange, true);

            if (this.positionFrame) {
                cancelAnimationFrame(this.positionFrame);
                this.positionFrame = null;
            }
        }

        static bindGlobalListeners() {
            if (globalListenersBound) return;
            globalListenersBound = true;

            document.addEventListener('pointerdown', event => {
                if (!activePicker) return;

                const target = event.target;
                if (target === activePicker.element) return;
                if (activePicker.picker?.contains(target)) return;

                activePicker.hide();
            });

            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && activePicker) activePicker.hide();
            });
        }
    }

    TinyColorPicker.defaults = DEFAULT_OPTIONS;
    TinyColorPicker.defaultPalette = DEFAULT_PALETTE;
    TinyColorPicker.normalizeColor = normalizeColor;
    TinyColorPicker.isHexColor = isHexColor;

    global.TinyColorPicker = TinyColorPicker;
}(typeof window !== 'undefined' ? window : globalThis));
