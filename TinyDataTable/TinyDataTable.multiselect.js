/**
 * TinyDataTable.customSelect.js - Custom Select Implementation for TinyDataTable
 *
 * This script overrides the default buildSelect function of the TinyDataTable class
 * with a custom implementation that creates a dropdown-like select input. The dropdown
 * allows users to select an option from a list, and the selected value is reflected
 * in the associated label. This custom select mimics an HTML select element but with
 * enhanced flexibility and custom styling.
 *
 * The script first checks if TinyDataTable is properly defined and loaded, then it
 * proceeds to implement the custom `buildSelect` function. This function provides
 * the following features:
 *
 * 1. A dynamic dropdown menu created using `div` and `ul` elements.
 * 2. The ability to simulate a `select` element with custom options.
 * 3. The ability to expose a `value` property like a native select.
 * 4. The ability to handle selection change events and update the visible label.
 * 5. Optional multi-select support through `selectOptions.multiple`.
 *
 * This script is meant to be loaded after the TinyDataTable.js script.
 *
 * ------------------------------------------------------------
 * Update:
 * - Multi-select support (optional) controlled by an explicit option (`selectOptions.multiple`).
 * - Selection is stored on the element itself in `selectWrapper.__selection`
 *   instead of dataset attributes, keeping arrays as real JS values.
 * - In multi-select mode, an option with `value: ''` represents "Tous" / no filter.
 * - When "Tous" exists, selecting every real option automatically normalizes to [].
 * - CSS class names are centralized in CUSTOM_SELECT_CLASSES.
 * - DOM option references are cached to avoid repeated querySelector calls.
 * - Only one global document click listener is used for all custom selects.
 * - Opening one select automatically closes any other currently opened select.
 */

(function () {
    'use strict';

    // Check if TinyDataTable is already defined and is a valid class.
    if (typeof TinyDataTable === 'undefined' || !(TinyDataTable.prototype && TinyDataTable.prototype.constructor === TinyDataTable)) {
        throw new Error('TinyDataTable.js should be loaded before this script. Please ensure TinyDataTable.js is included in your HTML and that it is a valid class.');
    }

    // Reference to the TinyDataTable object for easier access.
    const self = TinyDataTable;

    // Keep every CSS class name in one place so styling can be renamed safely.
    const CUSTOM_SELECT_CLASSES = Object.freeze({
        wrapper: 'tt-select',
        trigger: 'select',
        label: 'select-label',
        icon: 'tt-select-icon',
        menu: 'dropdown-menu',
        item: 'dropdown-item',
        selected: 'selected',
        open: 'open'
    });

    // Empty value is the optional semantic value used for "Tous" / no filter.
    const EMPTY_VALUE = '';

    // Track only currently opened selects instead of querying every select on each document click.
    const OPEN_SELECTS = new Set();

    // Small helper to normalize comparisons and storage.
    const _toStr = value => value == null ? EMPTY_VALUE : String(value);

    /**
     * Update the visual open state and ARIA state of a custom select.
     *
     * Keeping this logic centralized prevents different code paths from
     * forgetting to synchronize the CSS class and aria-expanded attribute.
     */
    const setOpenState = (selectWrapper, opened) => {
        selectWrapper.classList.toggle(CUSTOM_SELECT_CLASSES.open, opened);

        const trigger = selectWrapper.querySelector(`.${CUSTOM_SELECT_CLASSES.trigger}`);
        if (trigger) trigger.setAttribute('aria-expanded', opened ? 'true' : 'false');

        if (opened) OPEN_SELECTS.add(selectWrapper);
        else OPEN_SELECTS.delete(selectWrapper);
    };

    /**
     * One global outside-click listener for all custom selects.
     *
     * Previous implementations attached one document listener per select.
     * Keeping only opened selects in OPEN_SELECTS reduces unnecessary work.
     */
    document.addEventListener('click', event => {
        OPEN_SELECTS.forEach(selectWrapper => {
            // Also discard detached selects so OPEN_SELECTS cannot retain stale DOM references.
            if (!selectWrapper.isConnected || !selectWrapper.contains(event.target)) {
                setOpenState(selectWrapper, false);
            }
        });
    });

    /**
     * Function to create a custom dropdown select input.
     * This function creates a dropdown menu where each option is clickable.
     * The selected value updates both the dropdown and a label representing the selected value.
     *
     * NOTE:
     * - Multi-select mode is enabled ONLY when `selectOptions.multiple === true`.
     * - The current selection is stored as a JS value on the wrapper:
     *     - single: selectWrapper.__selection = 'VALUE'
     *     - multi:  selectWrapper.__selection = ['A', 'B', ...]
     * - In multi-select mode, [] represents "Tous" ONLY when an empty-value option exists.
     *
     * @param {Array} options - Array of options to display in the dropdown.
     * @param {String|Array} defaultValue - Default selected value or values.
     * @param {Function} onChange - Callback executed when the user changes the selection.
     * @param {Object} selectOptions - Extra behavior flags, e.g. { multiple: true, icon: '...' }.
     * @returns {HTMLElement} The custom dropdown wrapper.
     */
    function createDropdown(options, defaultValue, onChange, selectOptions = {}) {

        // Normalize options to a consistent [{ value, label }, ...] structure.
        const normalizedOptions = self._normalizeOptions(options);

        // Multi-select mode is explicit. Never infer it from defaultValue.
        const isMulti = selectOptions.multiple === true;

        // Cache option metadata by value for quick label/default lookups.
        // Keep the first occurrence to match the previous Array.find() behavior.
        const optionByValue = new Map();
        normalizedOptions.forEach(option => {
            const value = _toStr(option.value);
            if (!optionByValue.has(value)) optionByValue.set(value, option);
        });

        // "Tous" is optional and exists only when an actual option has value === ''.
        const emptyOption = optionByValue.get(EMPTY_VALUE) || null;
        const hasEmptyOption = optionByValue.has(EMPTY_VALUE);

        // Only real values participate in a multiple selection.
        // Use Set so duplicate option values do not affect "all selected" detection.
        const selectableValues = [...new Set(
            normalizedOptions.map(option => _toStr(option.value)).filter(Boolean)
        )];
        const allowedValues = new Set(selectableValues);

        // Create the wrapper for the custom select dropdown.
        const selectWrapper = self._dtCreateElement('div', CUSTOM_SELECT_CLASSES.wrapper);

        // Visible trigger / label area.
        const selectElement = self._dtCreateElement('div', CUSTOM_SELECT_CLASSES.trigger, {
            role: 'button',
            tabIndex: 0,
            'aria-haspopup': 'listbox',
            'aria-expanded': 'false'
        });

        // Label displaying the current selected value(s).
        const labelElement = self._dtCreateElement('label', CUSTOM_SELECT_CLASSES.label);

        // Dropdown list containing all available options.
        const dropdownMenu = self._dtCreateElement('ul', CUSTOM_SELECT_CLASSES.menu, {
            role: 'listbox',
            'aria-multiselectable': isMulti ? 'true' : 'false'
        });

        // Cache option links to avoid repeated querySelector/querySelectorAll calls.
        // Keeping value together with link also correctly supports duplicate option values.
        const optionLinks = [];

        // Public-ish flag useful for TinyDataTable integration and styling.
        selectWrapper.multiple = isMulti;

        // Store selection ONLY in JS (not dataset).
        // - single: string
        // - multi: array of strings
        selectWrapper.__selection = isMulti ? [] : EMPTY_VALUE;

        // ---------------------------------------------------------------------
        // Internal helpers
        // ---------------------------------------------------------------------

        /**
         * Close this dropdown.
         */
        const close = () => setOpenState(selectWrapper, false);

        /**
         * Open this dropdown and close any other currently opened custom select.
         */
        const open = () => {
            OPEN_SELECTS.forEach(other => {
                if (other !== selectWrapper) setOpenState(other, false);
            });
            setOpenState(selectWrapper, true);
        };

        /**
         * Toggle the current dropdown.
         */
        const toggle = () => selectWrapper.classList.contains(CUSTOM_SELECT_CLASSES.open) ? close() : open();

        /**
         * Normalize a multi-select value.
         *
         * Rules:
         * - Always return an array of unique strings.
         * - Ignore unknown / removed option values.
         * - Never store the empty "Tous" value in the array.
         * - When "Tous" exists, selecting every real value is equivalent to [].
         */
        const normalizeMultiSelection = value => {
            const values = Array.isArray(value)
                ? value
                : (value == null || value === EMPTY_VALUE ? [] : [value]);

            const selected = [...new Set(
                values.map(_toStr).filter(v => v && allowedValues.has(v))
            )];

            // Selecting all real values is semantically identical to "Tous".
            if (hasEmptyOption && selectableValues.length && selected.length === selectableValues.length) return [];

            return selected;
        };

        /**
         * Update the selected CSS state of every dropdown item.
         *
         * In multi-select mode:
         * - [] + an empty option means the empty option ("Tous") is selected.
         * - Otherwise every selected real value receives the selected class.
         *
         * In single-select mode the matching value receives the selected class.
         */
        const updateSelection = () => {
            const selectedValues = isMulti ? new Set(selectWrapper.__selection) : null;
            const selectAll = isMulti && !selectWrapper.__selection.length && hasEmptyOption;
            const singleValue = !isMulti ? _toStr(selectWrapper.__selection) : null;

            optionLinks.forEach(({ value, link }) => {
                const selected = isMulti
                    ? (selectAll ? value === EMPTY_VALUE : selectedValues.has(value))
                    : value === singleValue;

                link.classList.toggle(CUSTOM_SELECT_CLASSES.selected, selected);
                link.setAttribute('aria-selected', selected ? 'true' : 'false');
            });
        };

        /**
         * Update the visible select label.
         *
         * Multi-select labels keep the same order as the configured options,
         * not the order in which the user clicked them.
         */
        const updateLabel = () => {
            if (isMulti) {
                const values = selectWrapper.__selection;

                if (!values.length) {
                    // Display "Tous" only when an actual empty-value option exists.
                    labelElement.textContent = emptyOption?.label ?? '—';
                    return;
                }

                const selected = new Set(values);
                const labels = normalizedOptions
                    .filter(option => {
                        const value = _toStr(option.value);
                        return value !== EMPTY_VALUE && selected.has(value);
                    })
                    .map(option => option.label);

                labelElement.textContent = labels.length ? labels.join(', ') : '—';
                return;
            }

            const selectedOption = optionByValue.get(_toStr(selectWrapper.__selection));
            labelElement.textContent = selectedOption ? selectedOption.label : '—';
        };

        /**
         * Normalize and set the internal selection.
         *
         * This setter updates UI state only. It deliberately does NOT dispatch
         * a change event so programmatic `select.value = ...` behaves like the
         * previous implementation. User clicks dispatch the change explicitly.
         */
        const setSelection = value => {
            selectWrapper.__selection = isMulti ? normalizeMultiSelection(value) : _toStr(value);
            updateLabel();
            updateSelection();
        };

        /**
         * Trigger a native-like bubbling change event on the custom wrapper.
         */
        const emitChange = () => {
            selectWrapper.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Getter and setter for the `value` property on the selectWrapper element.
        // - single returns string
        // - multi returns a COPY of the selected values array
        Object.defineProperty(selectWrapper, 'value', {
            get() {
                return isMulti ? selectWrapper.__selection.slice() : _toStr(selectWrapper.__selection);
            },
            set(value) {
                setSelection(value);
            }
        });

        // ---------------------------------------------------------------------
        // Create dropdown options dynamically from the provided options.
        // ---------------------------------------------------------------------
        normalizedOptions.forEach(option => {
            const value = _toStr(option.value);
            const listItem = self._dtCreateElement('li');

            const linkItem = self._dtCreateElement('a', CUSTOM_SELECT_CLASSES.item, {
                href: '#',
                role: 'option',
                'aria-selected': 'false',
                'data-value': value,
                text: option.label
            });

            // Keep direct DOM references for selection updates.
            optionLinks.push({ value, link: linkItem });

            // Add click event to update the value when an item is clicked.
            linkItem.addEventListener('click', event => {
                event.preventDefault();

                if (isMulti) {
                    // Empty option means "Tous": clear the complete selection.
                    if (value === EMPTY_VALUE) {
                        setSelection([]);
                    } else {
                        const current = selectWrapper.__selection.slice();
                        const index = current.indexOf(value);

                        if (index >= 0) current.splice(index, 1);
                        else current.push(value);

                        // setSelection() also converts "all values selected" back to [] when appropriate.
                        setSelection(current);
                    }
                } else {
                    // Single select: select the value and close the dropdown.
                    setSelection(value);
                    close();
                }

                // Preserve the previous behavior: an option click always emits change.
                emitChange();
            });

            listItem.appendChild(linkItem);
            dropdownMenu.appendChild(listItem);
        });

        // Toggle dropdown visibility when the visible select area is clicked.
        selectElement.addEventListener('click', toggle);

        // Basic keyboard support for the custom trigger.
        selectElement.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            } else if (event.key === 'Escape') {
                close();
            }
        });

        // ---------------------------------------------------------------------
        // Build final DOM structure.
        // ---------------------------------------------------------------------

        // Optional icon rendered before the selected label.
        if (selectOptions.icon) {
            selectElement.appendChild(
                self._dtCreateElement('span', CUSTOM_SELECT_CLASSES.icon, { html: selectOptions.icon })
            );
        }

        selectElement.appendChild(labelElement);
        selectWrapper.appendChild(selectElement);
        selectWrapper.appendChild(dropdownMenu);

        // ---------------------------------------------------------------------
        // Initialize the default selection.
        // ---------------------------------------------------------------------

        if (isMulti) {
            // Multi default may be an array, a single value or empty.
            // setSelection() performs all normalization and "Tous" handling.
            setSelection(defaultValue);
        } else {
            if (defaultValue != null && defaultValue !== EMPTY_VALUE) {
                const value = _toStr(defaultValue);

                if (optionByValue.has(value)) {
                    setSelection(value);
                } else if (normalizedOptions.length) {
                    // Fallback to first option to preserve previous behavior.
                    setSelection(normalizedOptions[0].value);
                } else {
                    setSelection(EMPTY_VALUE);
                }
            } else if (normalizedOptions.length) {
                // Preserve previous behavior: without defaultValue, select first option.
                setSelection(normalizedOptions[0].value);
            } else {
                setSelection(EMPTY_VALUE);
            }
        }

        // If onChange callback is provided, bind the change event.
        // Native addEventListener already executes a normal function with
        // `this === selectWrapper`, so no extra bind/wrapper is necessary.
        if (typeof onChange === 'function') {
            selectWrapper.addEventListener('change', onChange);
        }

        // Return the custom select element.
        return selectWrapper;
    }

    // Overwrite the default buildSelect method with the custom implementation.
    self.buildSelect = createDropdown;

})();