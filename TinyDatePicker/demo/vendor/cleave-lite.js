/**
 * CleaveLite
 * Small demo-only compatibility helper for TinyDatePicker's assistDateInput option.
 * It implements only the numeric date/block formatting used by this demo.
 */
(() => {
  'use strict';

  if (typeof window.Cleave === 'function') {
    return;
  }

  class CleaveLite {
    constructor(element, options = {}) {
      if (!(element instanceof HTMLInputElement)) {
        throw new TypeError('CleaveLite expects an input element.');
      }

      this.element = element;
      this.options = options;
      this.handleInput = this.handleInput.bind(this);
      this.element.addEventListener('input', this.handleInput);
      this.handleInput();
    }

    handleInput() {
      const formattedValue = this.options.date
        ? this.formatDate(this.element.value)
        : this.formatBlocks(this.element.value);

      if (formattedValue !== this.element.value) {
        this.element.value = formattedValue;
      }
    }

    formatDate(rawValue) {
      const datePattern = Array.isArray(this.options.datePattern)
        ? this.options.datePattern
        : ['d', 'm', 'Y'];
      const blockSizes = datePattern.map((token) => token === 'Y' ? 4 : 2);
      const delimiter = this.options.delimiter || '/';

      return this.joinBlocks(rawValue, blockSizes, blockSizes.map(() => delimiter).slice(0, -1));
    }

    formatBlocks(rawValue) {
      const blockSizes = Array.isArray(this.options.blocks) ? this.options.blocks : [];
      const delimiters = Array.isArray(this.options.delimiters) ? this.options.delimiters : [];

      return this.joinBlocks(rawValue, blockSizes, delimiters);
    }

    joinBlocks(rawValue, blockSizes, delimiters) {
      const digits = String(rawValue || '').replace(/\D/g, '');
      const parts = [];
      let offset = 0;

      blockSizes.forEach((blockSize, index) => {
        if (offset >= digits.length) {
          return;
        }

        parts.push(digits.slice(offset, offset + blockSize));
        offset += blockSize;

        if (offset < digits.length && delimiters[index]) {
          parts.push(delimiters[index]);
        }
      });

      return parts.join('');
    }

    destroy() {
      this.element.removeEventListener('input', this.handleInput);
    }
  }

  window.Cleave = CleaveLite;
})();
