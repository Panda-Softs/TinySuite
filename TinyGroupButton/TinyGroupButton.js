/**
 * TinyGroupButton v1.1.0
 * Dependency-free checkbox button-group controller.
 *
 * Contract preserved from the legacy jQuery btnGroup:
 * - regular checked values are exposed as a lowercase CSV string;
 * - an optional input.all means "all" and is excluded from the CSV value;
 * - updateValue() synchronizes the DOM without emitting change events;
 * - onChange / afterChange are emitted only by user-driven selection changes;
 * - dynamically inserted checkboxes work through event delegation on the root.
 */
(function (window) {
    'use strict';

    const instances = new WeakMap();
    const DEFAULTS = Object.freeze({
        activeClass: 'is-checked',
        onChange: undefined
    });
    const CHECKBOX_SELECTOR = 'input[type="checkbox"]';
    const REGULAR_SELECTOR = 'input[type="checkbox"]:not(.all)';
    const ALL_SELECTOR = 'input[type="checkbox"].all';

    class TinyGroupButton {
        constructor(element, options = {}) {
            if (!(element instanceof HTMLElement)) {
                throw new TypeError('TinyGroupButton: a valid HTMLElement is required.');
            }

            this.element = element;
            this.settings = Object.assign({}, DEFAULTS, options);
            this.value = undefined;
            this._onChange = this._onChange.bind(this);

            this.element.addEventListener('change', this._onChange);
            this._syncVisualState();
        }

        /**
         * Get the instance for an element, creating it when needed.
         * Options are used only on first creation.
         *
         * @param {HTMLElement|string} elementOrSelector
         * @param {Object} [options]
         * @returns {TinyGroupButton|null}
         */
        static getInstance(elementOrSelector, options = {}) {
            const element = typeof elementOrSelector === 'string'
                ? document.querySelector(elementOrSelector)
                : elementOrSelector;

            if (!element) return null;
            if (!(element instanceof HTMLElement)) {
                throw new TypeError('TinyGroupButton.getInstance: expected an HTMLElement or a valid selector.');
            }

            let instance = instances.get(element);
            if (!instance) {
                instance = new TinyGroupButton(element, options);
                instances.set(element, instance);
            }
            return instance;
        }

        /** Build the effective CSV value from the current DOM. */
        buildValue() {
            return Array.from(this.element.querySelectorAll(`${REGULAR_SELECTOR}:checked`))
                .map(checkbox => String(checkbox.value).toLowerCase())
                .join(',');
        }

        /** Return the last value stored by setValue(), preserving the legacy contract. */
        getValue() {
            return this.value;
        }

        /** Set checked state and mirror it to the parent label. */
        check(checkboxes, checked) {
            if (!checkboxes) return;
            const elements = checkboxes instanceof HTMLInputElement ? [checkboxes] : Array.from(checkboxes);
            elements.forEach(checkbox => {
                checkbox.checked = !!checked;
                checkbox.closest('label')?.classList.toggle(this.settings.activeClass, !!checked);
            });
        }

        /**
         * Apply an external CSV value to existing options without emitting events.
         * Unknown values are discarded. The effective value is returned.
         */
        updateValue(value) {
            const requested = value == null ? '' : String(value);
            const current = this.buildValue();

            if (requested !== current) {
                const requestedValues = requested ? requested.split(',') : [];
                this.element.querySelectorAll(REGULAR_SELECTOR).forEach(checkbox => {
                    this.check(checkbox, requestedValues.includes(checkbox.value));
                });
            }

            const effective = this.buildValue();
            this.check(this.element.querySelectorAll(ALL_SELECTOR), !effective.length);
            return effective;
        }

        /** Store a value and emit the native compatibility events when it changes. */
        setValue(value, triggerUpdate = true) {
            const oldValue = this.value;
            this.value = value;
            if (!triggerUpdate || value === oldValue) return;

            const beforeDetail = { old_value: oldValue, value: this.value };
            this.element.dispatchEvent(new CustomEvent('onChange', {
                detail: beforeDetail,
                bubbles: true
            }));

            if (typeof this.settings.onChange === 'function') {
                this.settings.onChange.call(this, this.value);
            }

            this.element.dispatchEvent(new CustomEvent('afterChange', {
                detail: { from: oldValue, to: this.value },
                bubbles: true
            }));
        }

        /** Remove this instance's listener and registration. */
        destroy() {
            this.element.removeEventListener('change', this._onChange);
            instances.delete(this.element);
        }

        _syncVisualState() {
            this.element.querySelectorAll(CHECKBOX_SELECTOR).forEach(checkbox => {
                checkbox.closest('label')?.classList.toggle(this.settings.activeClass, checkbox.checked);
            });
        }

        _onChange(event) {
            const checkbox = event.target.closest?.(CHECKBOX_SELECTOR);
            if (!checkbox || !this.element.contains(checkbox)) return;

            const isAll = checkbox.classList.contains('all');
            const hasAll = !!this.element.querySelector(ALL_SELECTOR);
            const hasRegularSelection = !!this.element.querySelector(`${REGULAR_SELECTOR}:checked`);

            checkbox.closest('label')?.classList.toggle(this.settings.activeClass, checkbox.checked);

            if (isAll) {
                if (hasRegularSelection) {
                    this.check(this.element.querySelectorAll(REGULAR_SELECTOR), false);
                } else {
                    this.check(this.element.querySelectorAll(ALL_SELECTOR), true);
                }
            } else if (hasAll) {
                this.check(this.element.querySelectorAll(ALL_SELECTOR), !hasRegularSelection);
            }

            this.setValue(this.buildValue(), true);
        }
    }

    window.TinyGroupButton = TinyGroupButton;
})(window);
