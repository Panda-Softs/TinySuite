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
 * 3. A `value` property to reflect the selected value.
 * 4. The ability to handle selection change events and update the label accordingly.
 *
 * This script is meant to be loaded after the TinyDataTable.js script.
 */

// Self-Invoking Function to Create a Private Scope for Custom Select Logic
(function() {

    // Check if TinyDataTable is already defined and is a valid class
    if (typeof TinyDataTable === 'undefined' || !(TinyDataTable.prototype && TinyDataTable.prototype.constructor === TinyDataTable)) {
        // If TinyDataTable is not defined, throw an error and stop execution
        throw new Error("TinyDataTable.js should be loaded before this script. Please ensure TinyDataTable.js is included in your HTML and that it is a valid class.");
    }

    // Reference to the TinyDataTable object for easier access
    const self = TinyDataTable;

    /**
     * Function to create a custom dropdown select input.
     * This function creates a dropdown menu where each option is clickable.
     * The selected value updates both the dropdown and a label representing the selected value.
     *
     * @param {Array} options - Array of options to display in the dropdown.
     * @param {String} defaultValue - The default selected value.
     * @param {Function} onChange - A callback function to execute when the value changes.
     * @returns {HTMLElement} - The custom dropdown element (selectWrapper).
     */
    function createDropdown(options, defaultValue, onChange) {
        // Normalize the options to ensure consistent structure (e.g., value and label)
        const normalizedOptions = self._normalizeOptions(options);

        // Create the wrapper for the custom select dropdown
        const selectWrapper = self._dtCreateElement('div', 'tt-select');
        const labelElement = self._dtCreateElement('div', 'select');  // Label area (displaying selected label)
        const dropdownMenu = self._dtCreateElement('ul', 'dropdown-menu');  // Dropdown list (menu)

        // Function to update the selection in the dropdown
        const updateSelection = (value) => {
            // Find and remove the 'selected' class from the previously selected item
            const selectedItem = dropdownMenu.querySelector('a.selected');
            if (selectedItem) {
                selectedItem.classList.remove('selected');
            }

            // Find and add the 'selected' class to the newly selected item
            const newSelectedItem = dropdownMenu.querySelector(`a[data-value="${value}"]`);
            if (newSelectedItem) {
                newSelectedItem.classList.add('selected');
            }
        };

        // Getter and setter for the `value` property on the selectWrapper element
        Object.defineProperty(selectWrapper, 'value', {
            get() {
                return this.dataset.value || '';  // Return the stored value
            },
            set(value) {
                this.dataset.value = value;  // Store the value in the dataset
                // Update the label to show the selected option's label
                const selectedOption = normalizedOptions.find(option => option.value === value);
                if (selectedOption) {
                    labelElement.textContent = selectedOption.label;
                }
                // Update the selection (highlight the selected item in the dropdown)
                updateSelection(value);
            }
        });

        // Create dropdown options dynamically from the provided options
        normalizedOptions.forEach(option => {
            const listItem = self._dtCreateElement('li');
            const linkItem = self._dtCreateElement('a', {
                class: 'dropdown-item',
                href: 'javascript:void(0);',
                text: option.label,  // Display the label of the option
                'data-value': option.value  // Store the value as a data attribute
            });

            // Add click event to update the value when an item is clicked
            linkItem.addEventListener('click', () => {
                selectWrapper.value = option.value;  // Set the value using the setter (this.value)

                // Trigger the change event manually on the wrapper
                const changeEvent = new Event('change', { bubbles: true });
                selectWrapper.dispatchEvent(changeEvent);

                // Close the dropdown
                selectWrapper.classList.remove('open');
            });

            listItem.appendChild(linkItem);
            dropdownMenu.appendChild(listItem);
        });

        // Toggle dropdown visibility when the label element is clicked
        labelElement.addEventListener('click', () => {
            selectWrapper.classList.add('open');
        });

        // Close the dropdown before delegated click handlers can stop propagation.
        document.addEventListener('pointerdown', (event) => {
            if (!selectWrapper.contains(event.target)) {
                selectWrapper.classList.remove('open');
            }
        }, true);

        // Append the label and dropdown menu to the selectWrapper
        selectWrapper.appendChild(labelElement);
        selectWrapper.appendChild(dropdownMenu);

        // Set the default value if provided
        if (defaultValue) {
            const defaultOption = normalizedOptions.find(option => String(option.value) === String(defaultValue));
            if (defaultOption) {
                selectWrapper.value = defaultOption.value;  // Set value using the setter
            }
        } else if (normalizedOptions.length > 0) {
            const firstOption = normalizedOptions[0];
            selectWrapper.value = firstOption.value;  // Set value using the setter
        }

        // If onChange callback is provided, bind the change event
        if (onChange && typeof onChange === 'function') {
            selectWrapper.addEventListener('change', onChange.bind(selectWrapper));
        }

        // Return the custom select element
        return selectWrapper;
    };

    // Overwrite the default buildSelect method with the custom one
    self.buildSelect = createDropdown;

})();
