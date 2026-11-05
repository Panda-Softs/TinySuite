/*! 
 * TinyDataTable - Version 1.3.3
 * Lightweight data table in plain JavaScript (no required dependencies).
 *
 * Features
 * - Local data mode: in-memory search, multi-sort, paging, filters.
 * - Ajax mode: server-side paging/filtering/sorting with AbortController safety.
 * - "Load once" Ajax mode: fetch once then behave like local mode.
 * - Optional: mark.js highlighting, tooltips via pluggable adapter (e.g., Tippy.js).
 * - Grouping: group headers + merged columns (rowspan).
 * - Child rows: expandable nested rows (optionally lazy-loaded).
 * - Row selection (with optional group selection).
 */
    (function (root, factory) {
        if (typeof define === 'function' && define.amd) {
            define([], factory);
        } else if (typeof module === 'object' && module.exports) {
            module.exports = factory();
        } else {
            root.TinyDataTable = factory();
        }
    }(typeof self !== 'undefined' ? self : this, function () {
        'use strict';

    function escapeHtml(s) {
        return String(s)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function debounce(fn, delay, ctx) {
        let timer = null;
        return function (...args) {
            if (timer) clearTimeout(timer);
            const self = ctx || this;
            timer = setTimeout(() => {
                timer = null;
                fn.apply(self, args);
            }, delay);
        };
    }

    /**
     * Tokenize a string/array of class names into a de-duplicated array.
     * Accepts comma or whitespace separators.
     */
    function tokenize_str(v) {
        if (v == null) return [];
        v = Array.isArray(v) ? v.flat(Infinity).filter(Boolean) : String(v).split(/[\s,]+/);
        return [...new Set(v.map(x => String(x).trim()).filter(Boolean))];
    }

    function isBlank(s) { return  s == null || String(s).trim() === ''}

    /*
    function camelCase(s) {
        return String(s).toLowerCase().replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    }*/
    function toCamelCase(str) {
        return String(str)
            .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
            .replace(/^(.)/, m => m.toLowerCase());
    }

    function _isNode(val) { return isObj(val) && (val.nodeType === 1 || val.nodeType === 11); }
    function formatText (tpl, vars) {
        tpl = tpl == null ? "" : String(tpl);
        return tpl.replace(/\{(\w+)\}/g, function (_, key) {
            return (vars && vars[key] != null) ? String(vars[key]) : "";
        });
    };

    function to_digits (value, locale, precision = 2, negative = false)  {
        var num = Number(value);
        if (Number.isNaN(num)) return value; // not a number, just return as is
        if (negative) num = -num;
        try {
            return num.toLocaleString(locale || 'en-US', {minimumFractionDigits: precision, maximumFractionDigits: precision});
        } catch (e) {
            return num.toFixed(precision); //// Fallback in case Intl/locale issues
        }
    }

    function _setDisplayElement(el, visible) {
        if (el._originaDisplay==null) el._originaDisplay = el.style.display; //window.getComputedStyle(el).display;
        if (visible) {
            el.style.removeProperty('display');
        } else {
            el.style.display = 'none';
        }
    }

    function isPlainObject(v) { return isObj(v) && !Array.isArray(v) };

    function isFn(f) { return !!f && typeof f === 'function'}
    function isNbr(n) { return typeof n === 'number' }
    function isStr(s) { return typeof s === 'string' }

    function isObj(o) { return o !== null && typeof o === 'object' }

    const isNonEmptyArray = a => Array.isArray(a) && a.length > 0;


    function flattenParams(params) {
        const flatten = (obj, prefix = '') => {
            let items = [];
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}[${key}]` : key;

                    if (isObj(value)) {
                        items = items.concat(flatten(value, newKey)); // Recursively flatten nested objects
                    } else {
                        items.push([newKey, (value===undefined || value===null) ? '' : value]);
                    }
                }
            }
            return items;
        };
        return new URLSearchParams(flatten(params)).toString();
    }

    function toArrayPromise(value) {
        return Promise.resolve(value).then(r => Array.isArray(r) ? r : []);
    }

    /**
     * Parse a fetch() Response expecting JSON.
     * - Handles non-2xx responses
     * - Handles HTML / non-JSON bodies
     * - Preserves response body snippet for debugging
     *
     * @param {Response} response
     * @param {string} url - Request URL (for error messages)
     * @returns {Promise<any>} Parsed JSON
     * @throws {Error} with extra fields: status, url, body
     */
    async function _dtParseJsonResponse(response, url) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        const bodyText = await response.text();

        // HTTP error (4xx / 5xx)
        if (!response.ok) {
            const err = new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
            err.status = response.status;
            err.statusText = response.statusText;
            err.url = url;
            err.body = bodyText.slice(0, 2000);
            throw err;
        }

        // Valid JSON response
        if (contentType.includes('application/json') || contentType.includes('+json')) {
            try {
                return JSON.parse(bodyText || 'null');
            } catch (e) {
                const err = new Error(`Invalid JSON response for ${url}`);
                err.cause = e;
                err.url = url;
                err.body = bodyText.slice(0, 2000);
                throw err;
            }
        }

        // Unexpected content-type (HTML, text, etc.)
        const err = new Error(`Expected JSON but got "${contentType || 'unknown'}" for ${url}`);
        err.url = url;
        err.body = bodyText.slice(0, 2000);
        throw err;
    }


    // Unified Ajax utility
    function _dtAjaxRequest(url, options = {}) {
        const method = (options.method || "GET").toUpperCase();
        let finalUrl = url;

        // Base request options
        const requestOptions = {
            method: method,
            headers: Object.assign({"X-Requested-With": "XMLHttpRequest"}, options.headers || {}),
            signal: options.signal
        };

        if (method === "GET") {
            // GET: params go into query string
            if (options.params) {
                let query = options.params;

                // Allow users to pass URLSearchParams directly
                if (query instanceof URLSearchParams) {
                    const usp = query;
                    finalUrl += (finalUrl.indexOf("?") !== -1 ? "&" : "?") + usp.toString();
                } else if (isObj(query)) {
                    // Nested object → deep-flatten into bracketed keys
                    const flat = flattenParams(query);
                    finalUrl += (finalUrl.indexOf("?") !== -1 ? "&" : "?") + flat;
                } else if (isStr(query) && query.trim() !== "") {
                    // Already encoded query string
                    finalUrl += (finalUrl.indexOf("?") !== -1 ? "&" : "?") + query;
                }
            }
        } else {
            // Non-GET: JSON body
            requestOptions.headers["Content-Type"] =
                requestOptions.headers["Content-Type"] || "application/json";

            if (options.body !== undefined) {
                // Explicit body provided by caller
                requestOptions.body = options.body;
            } else if (isObj(options.params)) {
                // No body, but params given → send as JSON
                requestOptions.body = JSON.stringify(options.params);
            } else {
                requestOptions.body = null;
            }
        }

        return fetch(finalUrl, requestOptions).then(r => _dtParseJsonResponse(r, finalUrl));
    }


    /**
     Delegate events: _addEventListener(root, 'click', 'tr[data-row]', handler)
     - attaches 1 listener to `root`
     - when event bubbles from an element matching `selector`, calls handler
     - inside handler: this === matched element
     - handler gets (e, matched) so you can use either `this` or `matched`
     */
     function _addEventListener(root, eventName, selector, handler, ctx, options) {
         if (!root || !eventName || !selector || typeof handler !== 'function') return null;

         const listener = function (e) {
             const target = e.target?.closest?.(selector);
             if (!target || !root.contains(target)) return;

             const evt = Object.create(null);

             ['type', 'bubbles', 'cancelable', 'defaultPrevented', 'eventPhase', 'isTrusted', 'timeStamp', 'shiftKey', 'ctrlKey', 'altKey', 'metaKey'].forEach(prop => {
                 Object.defineProperty(evt, prop, {
                     get() { return e[prop]; },
                     enumerable: true,
                     configurable: true
                 });
             });

             // Override or add properties
             evt.target = e.target;
             evt.currentTarget = target;
             evt.delegateTarget = root;
             evt.preventDefault = () => e.preventDefault();
             evt.stopPropagation = () => e.stopPropagation();
             evt.stopImmediatePropagation = () => e.stopImmediatePropagation();
             handler.call(ctx || target, evt, target);
         };

         root.addEventListener(eventName, listener, options);
         return () => root.removeEventListener(eventName, listener, options);
     }

    /**
     * Normalizes text for case- and accent-insensitive searching.
     */
    function normalizeSearchText(value) {
        return String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

     /**
     * Normalize defaultSort option into an array of { key, dir } objects.
     *
     * Supported forms:
     *   - { id: 'asc', date: 'desc' }
     *   - { 0: 'asc', 3: 'desc' } // by column index
     *
     * @param {any} defaultSort - user-provided defaultSort option
     * @param {Array} columns   - TinyDataTable columns array
     * @returns {Array<{key: string, dir: 'asc'|'desc'}>}
     */
    function _normalizeDefaultSort(defaultSort, columns) {
        var orders = [];

        if (!defaultSort || typeof defaultSort !== 'object' || Array.isArray(defaultSort)) {
            return orders;
        }

        Object.keys(defaultSort).forEach(function (k) {
            var rawDir = defaultSort[k];
            if (!rawDir) return;

            var dir = String(rawDir).toLowerCase() === 'desc' ? 'desc' : 'asc';
            var colKey = null;

            // Numeric key => treat as column index
            if (/^\d+$/.test(k)) {
                var idx = parseInt(k, 10);
                if (columns && columns[idx]) {
                    colKey = columns[idx].key;
                }
            } else {
                // String key => treat as column key
                colKey = k;
            }

            if (colKey) {
                orders.push({ key: colKey, dir: dir });
            }
        });

        return orders;
    }


    /**
     * Internal helper to create DOM elements with optional classes and attributes.
     *
     * @param {string} tagName - Tag name, e.g. 'div', 'span', 'button'.
     * @param {string|string[]|null} [classNames] - Optional classes (array or space/comma-separated string).
     * @param {Object} [attrs] - Optional attributes as key/value pairs.
     *   - Normal keys: assigned as properties if possible, otherwise via setAttribute.
     *   - Keys starting with "data-": mapped to element.dataset in camelCase.
     *   - Keys 'text', 'html' or 'style' are forbidden and will throw (set these manually).
     *
     * @returns {HTMLElement}
     */
    function _dtCreateElement(tagName, ...args) {
        const el = document.createElement(tagName);

        let classNames = null;   // string | string[] | null
        let attrs = null;        // object | null

        // Parse args:
        // ()                      -> no class, no attrs
        // (classNames)            -> class only
        // (attrs)                 -> attrs only (may include class)
        // (classNames, attrs)     -> class + attrs (attrs may include class to merge)
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a == null) continue;

            if (isPlainObject(a)) {
                attrs = Object.assign(attrs || {}, a);
            } else {
                // treat as classNames
                classNames = classNames == null ? a : [classNames, a];
            }
        }

        // Merge class/className from attrs into classNames
        if (attrs) {
            const extraClass = attrs.class || attrs.className || null;
            if (extraClass != null) {
                delete attrs.class;
                delete attrs.className;
                classNames = classNames == null ? extraClass : [classNames, extraClass];
            }
        }

        // Normalize and apply classes
        _dtAddClass(el, classNames);

        // Apply attributes
        if (attrs) {
            Object.keys(attrs).forEach(function (name) {
                const value = attrs[name];
                if (value == null) return;

                if (name === 'html') { el.innerHTML = value; return; }
                if (name === 'text') { el.textContent = value; return; }

                if (name === 'style') {
                    el.style.cssText = value;
                    return;
                }

                if (name.indexOf('data-') === 0) {
                    const dataKey = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
                    el.dataset[dataKey] = value;
                    return;
                }

                if (name in el && name !== 'className') el[name] = value;
                else el.setAttribute(name, value);
            });
        }

        return el;
    }

    function _dtAddClass(el, className) {
        if (!el || className == null || className == '') return;
        if (isFn(className)) className = className(el);
        if (isStr(className)) className = tokenize_str(className);
        if (isNonEmptyArray(className))
            [...new Set(className.filter(Boolean).map(t => t.trim()))].forEach(c => el.classList.add(c));
    }

    function _looksLikeHtml(s) {
        if (typeof s !== 'string' || s.indexOf('<') === -1) return false;
        return /<\s*\/?\s*[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(s);
    }

    /*
    function _htmlToNode(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = String(html ?? '').trim();
        if (tpl.content.childElementCount === 1) return tpl.content.firstElementChild;
        const wrap = document.createElement('span');
        wrap.appendChild(tpl.content);
        return wrap;
    }*/

    // -----------------------------
    // Global namespace and CSS classes
    // -----------------------------

    const NAMESPACE = 'tiny-table';

    /**
     * TinyDataTable semantic version. Update when making breaking or notable changes.
     */
    const TINYDATATABLE_VERSION = '1.4.1';


    const TINY_TABLE_CLASSES = {
        // Root table class applied to the <table> element.
        root: NAMESPACE,

        // State applied to the <table> element when no rows are displayed.
        empty: 'is-empty',

        // Wrapper around the table when scrollX/scrollY are enabled.
        wrapper: `${NAMESPACE}-wrapper`,

        // Floating sticky header created when stickyHeader is enabled.
        stickyHeader: `${NAMESPACE}-sticky-header`,
        stickyHeaderTable: `${NAMESPACE}-sticky-header-table`,
        stickyHeaderActive: `${NAMESPACE}-sticky-header-active`,

        // Single empty cell class used for colspan placeholder cells.
        emptyCell: `${NAMESPACE}-empty-cell`,

        // High-level layout containers (optional).
        // container  -> wraps controls + wrapper/table + pager when any of them exist.
        // controls   -> wraps the search input and filters bar.
        // search     -> wrapper for search input.
        // searchInput-> actual <input> element.
        // filters    -> wrapper for the filters bar.
        // filterItem -> individual filter element container.
        container: `${NAMESPACE}-container`,
        controls: `${NAMESPACE}-controls`,
        controlsActions: `${NAMESPACE}-controls-actions`,
        search: `${NAMESPACE}-search`,
        searchInput: `${NAMESPACE}-search-input`,
        searchLabel : `${NAMESPACE}-search-label`,
        filters: `${NAMESPACE}-filters`,
        filterItem: `${NAMESPACE}-filter-item`,

        // Sorting states used on <th> elements.
        sortedAsc: `${NAMESPACE}-sorted-asc`,
        sortedDesc: `${NAMESPACE}-sorted-desc`,

        // Parent/child rows for hierarchical data.
        rowHasChildren: `${NAMESPACE}-has-children`,
        childRow: `${NAMESPACE}-child-row`,

        // Temporary state used by revealRow() to make the target obvious.
        revealedRow: `${NAMESPACE}-revealed-row`,

        // Toggle icon for expanding/collapsing child rows.
        toggleIcon: `${NAMESPACE}-toggle-icon`,

        // Pager / footer related classes.
        pager: `${NAMESPACE}-pager`,
        pagerInner: `${NAMESPACE}-pager-inner`,
        length: `${NAMESPACE}-length`,
        info: `${NAMESPACE}-info`,
        pages: `${NAMESPACE}-pages`,
        pagesSlot: `${NAMESPACE}-pages-slot`,
        pageButtonActive: `${NAMESPACE}-page-active`,
        ellipsis: `${NAMESPACE}-ellipsis`,

        // Grouping support.
        groupHeaderRow: `${NAMESPACE}-group-header-row`,
        groupHeaderCell: `${NAMESPACE}-group-header-cell`,

        // Row selection.
        selectHeaderCell: `${NAMESPACE}-select-header-cell`,
        selectCell: `${NAMESPACE}-select-cell`,

        loading: `${NAMESPACE}-loading`,

        hasAnyChildren: `${NAMESPACE}-has-any-children`,
    };

    const COL_STYLE_PROPS = ['width', 'minWidth', 'maxWidth', 'textAlign', 'whiteSpace'];

    // -----------------------------
    // mark.js detection (once, inline)
    // -----------------------------

    let MARK_CTOR = (typeof window !== 'undefined' && window.Mark) ? window.Mark :
        (typeof globalThis !== 'undefined' && globalThis.Mark) ? globalThis.Mark :
            null;
    let GLOBAL_TOOLTIP_ADAPTER = null;

    // -----------------------------

    // -----------------------------
    // DataSource base and strategies
    // -----------------------------

    /**
     * Abstract base data source.
     * Concrete implementations must override load(state, columns).
     */
    class DataSource {
        constructor(table) {
            // table is the TinyDataTable instance (may be null for some sources)
            this.table = table || null;
        }

        /**
         * @param {Object} state  Table state (paging, search, sort, ...)
         * @param {Array} columns Column definitions
         * @returns {Promise<{rows: Array, total: number}>}
         */
        load(state, columns) {
            return Promise.reject(new Error('DataSource.load not implemented'));
        }
    }

    /**
     * LocalDataSource
     * Handles client-side data: search, sort, and paging in memory.
     */
    class LocalDataSource extends DataSource {
        constructor(data, table) {
            super(table);
            this.setData(data);
        }

        /**
         * Replace local data (LocalDataSource / AjaxLoadOnceDataSource) and re-draw.
         * @param {Array<Object>} data
         */

        setData(data) {
            this.original = Array.isArray(data) ? data.slice() : [];
            this._attachOriginalIndex();
        }

        // Attach a stable index to keep original ordering when no sort is applied
        _attachOriginalIndex() {
            this.original.forEach(function (row, idx) {
                if (Object.prototype.hasOwnProperty.call(row, '__dt_index')) return;
                Object.defineProperty(row, '__dt_index', {
                    value: idx,
                    enumerable: false,
                    configurable: false,
                    writable: false
                });
            });
        }

        /**
         * Return all rows after search + sort, without paging.
         */
        getFilteredRows(state, columns) {
            var searchableCols = columns.filter(function (c) {
                return c.searchable !== false;
            });

            var sortKey = state.sortKey;
            var sortableCol = null;

            if (sortKey) {
                sortableCol = columns.find(function (c) {
                    return c.sortable !== false && c.key === sortKey;
                });
            }

            var rows = this.original;
            var self = this;

            // Apply column filters (if configured and active) before search/sort.
            var activeFilters = state.filters || {};
            var hasActiveFilters =
                isObj(activeFilters) &&
                Object.keys(activeFilters).some(function (k) {
                    var v = activeFilters[k];
                    return v !== undefined && v !== null && v !== '' && v !== false;
                });

            if (hasActiveFilters && this.table && this.table.filters && this.table.filters.enabled) {
                var filterDefs = Array.isArray(this.table.filters.items)
                    ? this.table.filters.items
                    : [];

                rows = rows.filter(function (row) {
                    for (var key in activeFilters) {
                        if (!Object.prototype.hasOwnProperty.call(activeFilters, key)) continue;
                        var value = activeFilters[key];

                        // Resolve filter definition for this key (if any).
                        var def = filterDefs.find(function (f) {
                            return f && f.key === key;
                        });

                        // Disabled boolean or "empty" non-boolean values do not filter.
                        if (def && def.type === 'bool') {
                            if (!value) continue;
                        } else {
                            if (value === null || value === '' || value === undefined) continue;
                        }

                        // Custom predicate (full control).
                        if (isFn(def?.predicate)) {
                            if (!def.predicate(row, value, {filter: def, table: self.table})) {
                                return false;
                            }
                            continue;
                        }

                        // Default behaviour:
                        //  - boolean filter: require truthy cell value
                        //  - other filters: strict string equality.
                        var cellValue = row[key];

                        if (def && def.type === 'bool') {
                            if (!cellValue) return false;

                        } else if (Array.isArray(value)) {
                            if (!value.length) continue;
                            if (cellValue == null) return false;

                            const match = value.some(selectedValue => String(selectedValue) === String(cellValue));
                            if (!match) return false;
                        } else {
                            if (cellValue == null) return false;

                            if (String(cellValue) !== String(value)) {
                                return false;
                            }
                        }
                    }
                    return true;
                });
            }

            // Single helper for search + sort
            // Behavior:
            // - Start from the raw dataset value when the column has a real key
            //   (and is not synthetic).
            // - If a renderer exists, compute its value for the given phase.
            // - If the rendered value is a scalar (string / number / boolean),
            //   use it instead of the raw value.
            // - Object values (e.g. HTML wrappers) are ignored.
            // - The returned value is always a primitive suitable for String(...).

            function getValue(col, row, phase) {
                let v = null;

                if (col.key && !col.isSyntheticKey) v = row[col.key];

                if (isFn(col.render)) {
                    try {
                        const rendered = self.table._renderValue(
                            col, v, row, 0, phase || "value", { isChild: false }
                        );

                        // Accept any primitive, reject objects
                        if (
                            isStr(rendered) ||
                            isNbr(rendered) ||
                            typeof rendered === "boolean"
                        ) {
                            v = rendered;
                        }
                    } catch (e) {}
                }

                return v;
            }


            // Search (parent rows + child rows if enabled)
            if (state.searchText && state.searchText.trim() !== '' && searchableCols.length > 0) {
                var q = normalizeSearchText(state.searchText);

                rows = rows.filter(function (row) {
                    // 1) Parent row match (uses getValue → key or render)
                    var parentMatch = searchableCols.some(function (col) {
                        var v = getValue(col, row, 'search');
                        if (v == null) return false;
                        return normalizeSearchText(v).indexOf(q) !== -1;
                    });
                    if (parentMatch) return true;

                    // 2) Child row match (unchanged, still key-based)
                    const table = self.table;
                    if (!table || !table.childRows || !table.childRows.enabled) return false;

                    var children = table._getChildrenForRow(row);
                    if (!children || !children.length) return false;

                    var childCols = table._getChildColumnsForParent(row) || [];
                    var childSearchableCols = childCols.filter(function (c) {
                        return c.searchable !== false && c.key;
                    });
                    if (!childSearchableCols.length) return false;

                    return children.some(function (child) {
                        return childSearchableCols.some(function (col) {
                            var vChild = child[col.key];
                            if (vChild == null) return false;
                            return String(vChild).toLowerCase().indexOf(q) !== -1;
                        });
                    });
                });
            }

            // Sort (based on state.sortOrders)
            var sortSpecs = [];

            if (Array.isArray(state.sortOrders) && state.sortOrders.length) {
                state.sortOrders.forEach(function (order) {
                    if (!order || !order.key) return;

                    var dirMult = (String(order.dir || order.direction || 'asc').toLowerCase() === 'desc') ? -1 : 1;
                    var col = columns.find(function (c) {
                        return c.sortable !== false && c.key === order.key;
                    });

                    if (col) {
                        sortSpecs.push({
                            col: col,
                            dir: dirMult
                        });
                    }
                });
            }

            if (sortSpecs.length) {
                // Precompute sort keys once per row (Schwartzian transform) for better performance
                var keyed = rows.map(function (row) {
                    var keys = sortSpecs.map(function (spec) {
                        var col = spec.col;
                        var v = getValue(col, row, 'sort');
                        if (v == null) return { t: 'n', v: null };
                        v = String(v).replace(/<[^>]*>/g, '');

                        // numeric
                        var n = Number(v);
                        if (!isNaN(n)) return { t: 'num', v: n };

                        // date
                        var d = Date.parse(v);
                        if (!isNaN(d)) return { t: 'date', v: d };

                        return { t: 'str', v: v };
                    });
                    return { row: row, keys: keys };
                });

                keyed.sort(function (a, b) {
                    for (var i = 0; i < sortSpecs.length; i++) {
                        var dir = sortSpecs[i].dir;
                        var ka = a.keys[i], kb = b.keys[i];

                        if (ka.v == null && kb.v == null) continue;
                        if (ka.v == null) return 1;
                        if (kb.v == null) return -1;

                        // Compare by type when both match; otherwise fallback to string
                        if (ka.t === kb.t) {
                            if (ka.t === 'num' || ka.t === 'date') {
                                var diff = ka.v - kb.v;
                                if (diff !== 0) return diff * dir;
                            } else {
                                var diffStr = String(ka.v).localeCompare(String(kb.v));
                                if (diffStr !== 0) return diffStr * dir;
                            }
                        } else {
                            var da = String(ka.v), db = String(kb.v);
                            var diffAny = da.localeCompare(db);
                            if (diffAny !== 0) return diffAny * dir;
                        }
                    }

                    // All sort keys equal → keep initial order
                    var ia = isNbr(a.row.__dt_index) ? a.row.__dt_index : 0;
                    var ib = isNbr(b.row.__dt_index) ? b.row.__dt_index : 0;
                    return ia - ib;
                });

                rows = keyed.map(function (x) { return x.row; });
            }


            return rows;
        }

        /**
         * Main load implementation in local mode: filtered rows + paging.
         */
        load(state, columns) {
            var rows = this.getFilteredRows(state, columns);
            var total = rows.length;

            // Paging
            if (state.pagingEnabled) {
                var start = (state.page - 1) * state.pageSize;
                var end = start + state.pageSize;
                rows = rows.slice(start, end);
            }

            return Promise.resolve({rows: rows, total: total});
        }
    }

    class AjaxLoadOnceDataSource extends LocalDataSource {
        constructor(ajaxOptions, table) {
            super([], table); //// Start with empty data; will be filled after first AJAX call
            this.ajax = ajaxOptions ?? {};
            this.fetchFn = isFn(this.ajax.fetch) ? this.ajax.fetch : null;
            this._loaded = false;
        }

        /**
         * Force reload on next draw()
         */
        /**
         * Reload data and re-draw.
         * - Ajax mode: re-fetches the current page.
         * - Local/loadOnce mode: simply re-draws.
         */

        refresh() {
            this._loaded = false;
        }

        /**
         * First call: load from server, store in LocalDataSource, then use LocalDataSource.load()
         * Next calls: just use LocalDataSource.load() (search+sort+paging in memory)
         */
        load(state, columns) {
            const self = this;
            // Capture parent method once, correctly bound
            const _load = super.load.bind(this);

            // Already loaded -> use LocalDataSource behavior:
            // filtering + sorting + paging from your existing implementation
            if (this._loaded) {
                return _load(state, columns);
            }

            // ---- FIRST LOAD FROM SERVER ----

            // Custom ajax.fetch({state, columns}) hook
            if (this.fetchFn) {
                return Promise
                    .resolve(this.fetchFn({state: state, columns: columns}))
                    .then(function (result) {
                        self.setData(result);
                        self._loaded = true;
                        return _load(state, columns);
                    });
            }

            // Default fetch via fetch() using the same logic as AjaxDataSource
            var method = (this.ajax.method || 'GET').toUpperCase();
            var url = isFn(this.ajax.url)
                ? this.ajax.url({state: state, columns: columns})
                : this.ajax.url;

            return _dtAjaxRequest(url, {
                method: method,
                headers: this.ajax.headers || {},
                signal: state.__signal
            }).then(function (json) {
                let rows = [];
                if (self.ajax.transform) {
                    rows = self.ajax.transform(json);
                } else {
                    rows = Array.isArray(json) ? json : (json.data || []);
                }
                self.setData(rows);
                self._loaded = true;
                // Now use the normal LocalDataSource logic (search + sort + paging)
                return _load(state, columns);
            });
        }
    }

    /**
     * AjaxDataSource
     * Handles server-side data loading.
     */
    class AjaxDataSource extends DataSource {
        constructor(ajaxOptions, table) {
            super(table);
            this.ajax = ajaxOptions ?? {};
            this.fetchFn = isFn(this.ajax.fetch) ? this.ajax.fetch : null;
            this.filterParamsFn = isFn(this.ajax.filterParamsFn) ? this.ajax.filterParamsFn : null;

            if (!this.fetchFn && !this.ajax.url) {
                throw new Error('AjaxDataSource: either ajax.fetch or ajax.url is required');
            }
        }

        /**
         * Load data from the server.
         * Supports:
         *   - ajax.fetch({ state, columns }) -> { rows, total }
         *   - ajax.url + optional buildParams / transform
         */
        load(state, columns) {
            const self = this;
            const _handleFetchResponse = r => r.then(function (json) {
                if (isFn(self.ajax.transform)) {
                    json = self.ajax.transform(json);
                }
                const rows = Array.isArray(json) ? json : (json.data || []);
                const total = isNbr(json.total) ? json.total : rows.length;
                return {rows: rows, total: total};
            });

            if (this.fetchFn) {
                return _handleFetchResponse(Promise.resolve(this.fetchFn({state: state, columns: columns})));
            }

            // NEW: compute extra filters first (before cloning state.filters)
            let extraFilters = null;
            if (this.filterParamsFn) {
                // Keep it simple: filterParamsFn returns a plain object (filters to merge)
                // Signature is up to you; this is the most useful context.
                extraFilters = this.filterParamsFn({
                    state,
                    columns,
                    table: this.table
                });
            }

            // Base filters + merged extras in one shot
            let filters = Object.assign({}, state.filters || {}, extraFilters || {});

            // Optional (recommended): unset empty values (same semantics as your setFilters)
            Object.keys(filters).forEach(k => {
                const v = filters[k];
                if (v == null || v === '') delete filters[k];
            });

            const columnDefs = columns.filter(col => col.visible !== false).map(col => ({
                key: col.key || '',
                searchable: col.searchable !== false,
                orderable:  col.sortable   !== false
            }));

            const ajaxParams = {
                tinyDataTable: true,
                paging: {
                    page: state.page,
                    length: state.pagingEnabled ? state.pageSize : -1,
                    start: state.pagingEnabled ? (state.page - 1) * state.pageSize : 0,
                    pagingEnabled: state.pagingEnabled
                },
                searchText: state.searchText,
                columns: columnDefs,
                order: state.sortOrders,
                filters
            };

            const buildParams = this.ajax.buildParams ?? function (s) {return s;};
            const params = buildParams(ajaxParams);

            const method = (this.ajax.method || 'GET').toUpperCase();
            const url = isFn(this.ajax.url)
                ? this.ajax.url({state: state, columns: columns})
                : this.ajax.url;
            const headers = this.ajax.headers || {};

            return _handleFetchResponse(_dtAjaxRequest(url, { method, params, headers, signal: state.__signal }));
        }
    }

    // -----------------------------
    // TinyDataTable main class
    // -----------------------------

    class TinyDataTable {
        /**
         * Static semantic version of the TinyDataTable library. This is
         * useful for debugging and feature checks at runtime.
         */
        static get version() {
            return TINYDATATABLE_VERSION;
        }


        constructor(tableSelector, options) {
            var table = isStr(tableSelector)
                ? document.querySelector(tableSelector)
                : tableSelector;

            if (!table) throw new Error(`TinyDataTable: table element not found (selector: ${String(tableSelector)})`);
            if (!_isNode(table)) throw new Error(`TinyDataTable: invalid table argument. Expected a DOM Element (<table>), got ${Object.prototype.toString.call(table)}`);

            this.table = table;
            this.table.classList.add(TINY_TABLE_CLASSES.root);

            this.id = this.table?.id || this.table.getAttribute('data-tt-id') || ('tt-' + Math.random().toString(36).slice(2));

            const dataset = table.dataset;
            this.options = options || {};
            this.locale = this.options.locale || navigator.language || navigator.userLanguage || 'en-US';

            // Instance texts: defaults + per-table overrides
            this.texts = Object.assign({}, TinyDataTable.defaults.texts, this.options.texts);

            // Empty message from options or data attribute
            this.emptyMessage = (this.options.emptyMessage != null ? this.options.emptyMessage : dataset.inplaceEmptyMessage) || this.texts.emptyMessage;

            // Scrolling options
            // scrollX / scrollY can be:
            //   - false  -> no scrolling in that axis
            //   - 'auto' -> overflow:auto (default for X)
            //   - any other truthy value -> overflow:scroll
            this.scrollX = (this.options.scrollX !== undefined) ? this.options.scrollX : 'auto';
            this.scrollY = (this.options.scrollY !== undefined) ? this.options.scrollY : false;

            // Sticky header can be configured either through JS:
            //   stickyHeader: true
            //   stickyHeader: { enabled: true, top: '64px', zIndex: 110 }
            // or through markup:
            //   data-sticky-header="true"
            //   data-sticky-header-top="64px"
            //
            // If no explicit top value is supplied, TinyDataTable reads the
            // inherited --tiny-table-sticky-top CSS custom property from the
            // source table. This keeps application chrome offsets completely
            // outside the TinyDataTable implementation.
            const stickyOpt = this.options.stickyHeader;
            const dataStickyRaw = dataset.stickyHeader;
            const dataStickyEnabled = dataStickyRaw != null && !['0', 'false', 'no', 'off'].includes(String(dataStickyRaw).trim().toLowerCase());
            const stickyIsObject = isObj(stickyOpt);
            this.stickyHeader = {
                enabled: stickyIsObject
                    ? stickyOpt.enabled !== false
                    : (stickyOpt !== undefined ? !!stickyOpt : dataStickyEnabled),
                top: stickyIsObject && stickyOpt.top != null
                    ? String(stickyOpt.top)
                    : (dataset.stickyHeaderTop != null ? String(dataset.stickyHeaderTop) : null),
                zIndex: stickyIsObject && stickyOpt.zIndex != null
                    ? Number(stickyOpt.zIndex)
                    : (dataset.stickyHeaderZIndex != null ? Number(dataset.stickyHeaderZIndex) : null)
            };


            // Internal draw sequencing for async safety (Ajax) + performance caches
            this._internals = {
                drawSeq: 0,
                drawPromise: null,
                revealTimer: null,
                activeAbort: null,
                visibleColumns: null,
                visibleColumnCount: null,
                renderPlan: null,
                lastHighlightQuery: null,
                tooltipsDelegated: false
            };

            this._events = Object.create(null);

            /**
             * Wrapper around the table when horizontal/vertical scrolling
             * is enabled. The wrapper only ever contains the <table>,
             * never the pager or external controls.
             */
            this.wrapper = null;

            /**
             * Optional high-level container that wraps the controls,
             * wrapper/table, and pager. It is only created when there is
             * at least one of: pager, search input, or filters bar.
             */
            this.container = null;

            /**
             * Optional container that hosts toolbar-style controls such as
             * the search input and the filters bar.
             */
            this.controlsContainer = null;

            /**
             * Reference to the search <input> element when search UI is
             * enabled. This is useful for integrations that need direct
             * access to the input node.
             */
            this.searchInput = null;

            // Sticky-header runtime nodes/listeners are initialized only when
            // requested by the instance. The floating header lives outside
            // the horizontal scroll wrapper so it can stick to the viewport.
            this.stickyHeaderElement = null;
            this.stickyHeaderTable = null;
            this._stickyHeaderRaf = null;
            this._stickyResizeObserver = null;

            var cols = this.options.columns || [];
            this.columns = cols.map(function (col) {
                var base = {
                    sortable: true,
                    searchable: true,
                    visible: true
                };
                for (var k in col) {
                    if (Object.prototype.hasOwnProperty.call(col, k)) {
                        base[k] = col[k];
                    }
                }
                return base;
            });

            const hasAjax = dataset.url || this.options.ajax?.url;
            const datasetPageSize = parseInt(dataset.pageSize, 10);
            this.paging = {
                enabled: this.options.paging?.enabled ?? (hasAjax ? true : false),
                showInfo : this.options.paging?.showInfo ?? false,
                pageSize: this.options.paging?.pageSize ?? (datasetPageSize > 0 ? datasetPageSize : 100),
                serverSide: this.options.paging?.serverSide ?? false,
                pageSizeOptions: this.options.paging?.pageSizeOptions ?? [20, 50, 100, 200]
            };

            this.footer = {
                enabled: this.options.footer?.enabled ?? false,
                // NEW (no back-compat): { [columnKey]: 'sum'|'avg'|function }
                aggregates: isObj(this.options.footer?.aggregates) ? this.options.footer.aggregates : {},
                hideWhenEmpty : this.options.footer?.hideWhenEmpty ?? true,
                callback : isFn(this.options.footer?.callback) ? this.options.footer.callback : null
            };

            this.childRows = {
                enabled: this.options.childRows?.enabled ?? true,
                dataKey: this.options.childRows?.dataKey ?? 'children',
                startExpanded: this.options.childRows?.startExpanded ?? false,
                rowId: this.options.childRows?.rowId,
                toggleOnRowClick: this.options.childRows?.toggleOnRowClick ?? true,
                toggleIcon : this.options.childRows?.toggleIcon ?? true,
                columns: this.options.childRows?.columns,
                getColumns: this.options.childRows?.getColumns,
                lazyLoad : this.options.childRows?.lazyLoad
            };

            this.normalizeColumn(this.childRows.columns,'childcol');

            this.highlight = {
                enabled: this.options.highlight?.enabled === true,
                contextSelector: this.options.highlight?.contextSelector || null,
                markOptions: this.options.highlight?.markOptions || {}
            };

            // Grouping configuration
            // Backward compatible with: grouping.keys (string[])
            // New API supports:
            // - grouping.key(row, gctx)
            // - grouping.type(row, gctx)
            // - grouping.precompute (e.g., countDistinctBy)
            var groupingOpt = this.options.grouping || {};
            this.grouping = {
                enabled: !!groupingOpt.enabled,

                // legacy
                keys: Array.isArray(groupingOpt.keys) ? groupingOpt.keys.slice() : null,

                // new (optional)
                keyFn: isFn(groupingOpt.key) ? groupingOpt.key : null,
                typeFn: isFn(groupingOpt.type) ? groupingOpt.type : null,
                precompute: isObj(groupingOpt.precompute) ? groupingOpt.precompute : null,

                // Optional: specialized aggregate rows may replace the detail rows of one group.
                // Other groups keep the existing row/rowspan implementation unchanged.
                skipRows: isFn(groupingOpt.skipRows) ? groupingOpt.skipRows : null,
                mergeColumns: isFn(groupingOpt.mergeColumns)
                        ? groupingOpt.mergeColumns
                        : (Array.isArray(groupingOpt.mergeColumns) ? groupingOpt.mergeColumns.slice() : []),
                header: {
                    show: groupingOpt.header?.show ?? false,
                    render: isFn(groupingOpt.header?.render) ? groupingOpt.header.render : null,
                    createdRow: isFn(groupingOpt.header?.createdRow) ? groupingOpt.header.createdRow : null
                }
            };
            this.customClass = this.options.customClass;

            // High-level search configuration (controls visibility of the
            // search input; the actual search logic uses state.searchText).
            this.searchConfig = {
                enabled: !!(this.options.search?.enabled ?? this.options.search?.selector ?? false),
                selector: this.options.search?.selector,
                label: this.options.search?.label,
                placeholder: this.options.search?.placeholder || this.texts.searchPlaceholder,
                debounceMs: (typeof this.options.search?.debounceMs === 'number') ? this.options.search.debounceMs : 150
            };

            // Column filters configuration (purely declarative; the LocalDataSource
            // and AjaxDataSource implementations are responsible for applying filters).
            var filtersOpt = this.options.filters || {};
            this.filters = {
                enabled: !!filtersOpt.enabled,
                items: Array.isArray(filtersOpt.items) ? filtersOpt.items : []
            };

            // Selection configuration

            var selectOpt = this.options.select;
            var selectEnabled = false;
            var groupMode = 'row';

            if (selectOpt === true) {
                selectEnabled = true;
            } else if (isObj(selectOpt)) {
                selectEnabled = !!selectOpt.enabled;
                if (selectOpt.groupMode === 'group') groupMode = 'group';
            }

            this.select = {
                enabled: selectEnabled,
                groupMode: groupMode,
                builder: selectOpt?.builder,

                // Optional selection policy. Return true/false, a rejection reason
                // string, or { selectable, reason }. The callback receives the row
                // plus the current selection, so consumers can express constraints
                // such as "same customer only" without touching table internals.
                canSelect: isFn(selectOpt?.canSelect) ? selectOpt.canSelect : null
            };

            // Initial filters state derived from the filters configuration.
            var initialFiltersState = this._getDefaultFiltersState();

            // Core state object used for paging, search, sorting and filters.
            this.state = {
                page: 1,
                pageSize: this.paging.pageSize,
                pagingEnabled: this.paging.enabled,
                searchText: '',
                sortOrders: _normalizeDefaultSort(this.options.defaultSort||this.options.order, this.columns),
                totalRows: 0,
                filters: initialFiltersState
            };


            this._expandedRowKeys = new Set();
            this._childRowsInitialized = false;

            // Selection state
            this._selectedRowKeys = new Set();
            this._rowDataByKey = {};
            this._pageParentRowKeys = [];
            this._pageGroupRowKeyMap = null;
            this._headerSelectCheckbox = null;
            this._lastPageRows = [];

            // dataset.loadonceUrl is a URL string if present (data-loadonce-url="...")
            const loadOnceUrl = dataset.loadonceUrl;

            // Resolve the effective ajax URL with precedence:
            const ajaxUrl = loadOnceUrl || dataset.url || this.options.ajax?.url;
            const useAjax = ajaxUrl || isFn(this.options.ajax?.fetch);
            const loadOnce = !!loadOnceUrl || this.options.ajax?.loadOnce === true;

            if (useAjax && loadOnce) {
                // Hybrid: ajax once, then fully local (search/sort/paging)
                this.options.ajax = this.options.ajax || {};
                this.options.ajax.url = ajaxUrl;

                // normalize flag on options for use in AjaxLoadOnceDataSource
                if (this.options.ajax.loadOnce == null) {
                    this.options.ajax.loadOnce = true;
                }

                this.dataSource = new AjaxLoadOnceDataSource(this.options.ajax, this);
                this._isAjax = false; // behaviour is local after first load

            } else if (useAjax) {
                // Classic ajax mode (no load-once hybrid)
                this.options.ajax = this.options.ajax || {};
                this.options.ajax.url = ajaxUrl;

                this.dataSource = new AjaxDataSource(this.options.ajax, this);
                this._isAjax = true;

            } else if (Array.isArray(this.options.data)) {
                // Pure local data
                this.dataSource = new LocalDataSource(this.options.data || [], this);
                this._isAjax = false;

            } else {
                throw new Error('DataSource Error: no ajax url and no data array provided.');
            }


            this.thead = null;
            this.tbody = null;
            this.tfoot = null;
            this.footerRow = null;
            this.pagerContainer = null;
            this.pager = null;

            // Create a high-level container when at least one of the
            // optional outer UI pieces (pager, search input, filters bar)
            // is enabled. This ensures the scroll wrapper only ever wraps
            // the table while the container wraps the whole widget.
            this._initWrapper();
            this._ensureContainer();
            this._initStructure();

            // Optional feature module. The consumer only declares `inlineEdit`;
            // TinyDataTable resolves the implementation if the optional script is loaded.
            this.inlineEdit = null;
            if (this.options.inlineEdit) {
                if (!isFn(TinyDataTable.initInlineEdit)) {
                    throw new Error('TinyDataTable inlineEdit is enabled but TinyDataTable.inlineEdit.js is not loaded.');
                }
                this.inlineEdit = TinyDataTable.initInlineEdit(
                    this,
                    this.options.inlineEdit === true ? {} : this.options.inlineEdit
                );
            }

            this._initStickyHeader();
            //this._emit('init', {});
            if (isFn(this.options.afterInit)) {
                this.options.afterInit.call(this.api());
            }

            this.draw();
        }

        api() { return this; }

        on(event, handler) {
            if (!this._events[event]) this._events[event] = [];
            this._events[event].push(handler);
            return this;
        }

        off(event, handler) {
            if (!this._events[event]) return this;
            if (!handler) {
                this._events[event] = [];
                return this;
            }
            this._events[event] = this._events[event].filter(function (fn) {
                return fn !== handler;
            });
            return this;
        }

        _emit(event, payload) {
            var handlers = this._events[event];
            if (!handlers || handlers.length === 0) return;
            var api = this.api();
            handlers.forEach(function (fn) {
                try {
                    fn.call(api, payload, api);
                } catch (err) {
                    if (typeof window !== 'undefined' && window.console) {
                        console.error('TinyDataTable handler error for event', event, err);
                    }
                }
            });
        }

        /**
         * Build filter state from configured default values.
         *
         * @returns {Object}
         */
        _getDefaultFiltersState() {
            const defaults = {};
            if (!this.filters?.enabled || !Array.isArray(this.filters.items)) return defaults;

            this.filters.items.forEach(def => {
                if (!def?.key) return;

                if (!def.type || def.type === 'boolean') def.type = 'bool';

                if (def.type === 'bool') {
                    if (def.defaultValue === true) defaults[def.key] = true;
                } else if (def.defaultValue != null && def.defaultValue !== '') {
                    defaults[def.key] = def.defaultValue;
                }
            });

            return defaults;
        }

        /**
         * Synchronize filter controls with state.filters.
         *
         * @returns {TinyDataTable}
         */
        _syncFilterControls() {
            if (!this._filterControls || !Array.isArray(this.filters?.items)) {
                return this;
            }

            this.filters.items.forEach(def => {
                if (!def?.key) return;

                const control = this._filterControls[def.key];
                if (!control) return;

                const value = this.state.filters?.[def.key];

                if (def.type === 'bool' || def.type === 'boolean') {
                    const checkbox =
                        control.matches?.('input[type="checkbox"]')
                            ? control
                            : control.querySelector?.('input[type="checkbox"]');

                    if (checkbox) {
                        checkbox.checked = !!value;
                    }

                    return;
                }

                if (def.multiple === true) {
                    const values = Array.isArray(value)
                        ? value
                        : [];

                    if (control instanceof HTMLSelectElement) {
                        const selected = new Set(
                            values.map(String)
                        );

                        Array.from(control.options).forEach(option => {
                            option.selected = selected.has(option.value);
                        });
                    } else {
                        control.value = values;
                    }

                    return;
                }

                control.value = value ?? '';
            });

            return this;
        }

        /**
         * Update one or many filters, always:
         * - unset empty values (null/undefined/'')
         * - reset pagination to page 1
         * - redraw the table
         *
         * @param {Object} filtersPatch - Partial filters { key: value }
         * @returns {TinyDataTable}
         */
        setFilters(filtersPatch) {
            const next = Object.assign({}, this.state.filters || {});
            const patch = filtersPatch || {};

            Object.keys(patch).forEach(key => {
                const value = patch[key];

                const shouldUnset = value == null || value === '' || value === false || (Array.isArray(value) && value.length === 0);
                if (shouldUnset) {
                    delete next[key];
                } else {
                    next[key] = value;
                }
            });

            this.state.filters = next;
            this.state.page = 1;

            this._syncFilterControls();

            return this.draw();
        }

        /**
         * Convenience: set a single filter.
         *
         * @param {string} key
         * @param {*} value
         * @returns {TinyDataTable}
         */
        setFilter(key, value) { return this.setFilters({ [key]: value }); }

        /**
         * Convenience: remove a single filter.
         *
         * @param {string} key
         * @returns {TinyDataTable}
         */
        clearFilter(key) { return this.setFilter(key, null); }

        /**
         * Replace all filters (hard reset), always resets page and redraws.
         *
         * @param {Object} filters
         * @returns {TinyDataTable}
         */
        replaceFilters(filters) {
            this.state = this.state || {};
            this.state.filters = {};
            return this.setFilters(filters || {});
        }

        /**
         * Reset all filters.
         *
         * By default, configured defaultValue values are restored.
         *
         * @param {Object} options
         * @param {boolean} options.toDefaults
         * @returns {TinyDataTable}
         */
        resetFilters({ toDefaults = true } = {}) {
            this.state.filters = toDefaults ? this._getDefaultFiltersState() : {};

            this.state.page = 1;

            this._syncFilterControls();

            this._emit('filtersReset', {filters: { ...this.state.filters }});

            return this.draw();
        }

        /**
         * Read current filter value.
         *
         * @param {string} key
         * @returns {*}
         */
        getFilter(key) { return this.state.filters?.[key];}

        getTableElement() {
            return this.table;
        }

        getHeaderElement() {
            return this.thead;
        }

        getBodyElement() {
            return this.tbody;
        }

        getFooterElement() {
            return this.tfoot;
        }

        getPagerElement() {
            return this.pagerContainer;
        }

        getDom() {
            return {
                table: this.table,
                thead: this.thead,
                tbody: this.tbody,
                tfoot: this.tfoot,
                pager: this.pagerContainer
            };
        }

        getColumns() { return this.columns; }

        // Get table headers from the column definitions
        headers(visibleOnly = true) {
            const headers = [];
            this.columns.forEach(col => {
                if (!(visibleOnly && col.visible === false)) {
                    headers.push(col.title || '');  // Push the title or an empty string if not set
                }
            });
            return headers;
        }

        /*
        getFullData(visibleOnly = true) {
            var self = this;

            // Helper function to process a single row (either parent or child)
            function processRow(row, visibleOnly, isChild) {
                // Determine the columns to use (child columns if isChild is true)
                const columns = isChild ? self._getChildColumnsForParent(row) : self.columns;

                return columns.reduce(function (acc, col) {
                    // Skip non-visible columns if visibleOnly is true
                    if (visibleOnly && col.visible === false) {
                        return acc;  // Skip this column by not adding it to the accumulator
                    }

                    var rawValue = row[col.key];  // Get raw data for the current column

                    var content = self._renderValue(col, rawValue, row, acc.length, "value", {
                        isChild: !!isChild,
                        rowKey: row.key
                    });

                    // Skip null or undefined values
                    if (content != null) {
                        acc.push(content);  // Add the processed content for this column
                    }

                    return acc;  // Return the accumulator for the next iteration
                }, []);  // Initialize the accumulator as an empty array
            }

            const savePagingEnabled = this.state.pagingEnabled;
            this.state.pagingEnabled = false;
            // Fetch the data from the data source
            return this.dataSource.load(this.state, this.columns).then(function (result) {
                const rows = Array.isArray(result.rows) ? result.rows : [];  // Ensure rows is an array

                // Process the rows (parent and child rows) by rendering them based on columns
                const processedData = rows.reduce(function (acc, row) {
                    // Process the current row (whether parent or child) using the unified `processRow` function
                    const rowData = processRow(row, visibleOnly, false);

                    // If the row has children, process the child rows and append their data
                    if (row.children && row.children.length > 0) {
                        // Recursively process child rows and append their data to the parent row's data
                        rowData.push(...row.children.reduce(function (childAcc, childRow) {
                            // Process each child row using the same `processRow` function
                            const childData = processRow(childRow, visibleOnly, true);  // Pass `true` for child rows
                            childAcc.push(childData);
                            return childAcc;
                        }, []));
                    }

                    acc.push(rowData);  // Add the parent row data to the accumulator
                    return acc;  // Return the accumulated row data
                }, []);  // Start with an empty array for all rows

                // Return the processed data with both parent and child rows
                return processedData;
            }).finally(() => {
                this.state.pagingEnabled = savePagingEnabled;
            })
        }
        */
        getFullData(visibleOnly = true, exportOnly = true) {
            const self = this;

            // Predicate used to decide if a column is included in the export dataset
            const isExportableColumn = (col) => {
                if (visibleOnly && col.visible === false) return false;
                if (exportOnly && (col.export === false || col.className?.includes('no-export'))) return false;
                return true;
            };

            // Use the SAME columns for headers + rows so lengths always match
            const cols = this.columns.filter(isExportableColumn);

            const headers = cols.map(col => ({
                label: col.label ?? col.title ?? '',
                type: col.type ?? null
            }));

            // Reused HTML stripper (no DOM insertion)
            const _stripper = document.createElement('div');
            const stripHtml = (html) => {
                _stripper.innerHTML = String(html ?? '');
                return _stripper.textContent || '';
            };

            // Build one fixed-width row array (always cols.length entries)
            function buildRowArray(row, rowIndex, isChild) {
                return cols.map((col, colIndex) => {
                    const rawValue = row ? row[col.key] : null;

                    let content = self._renderValue(col, rawValue, row, colIndex, "value", {
                        isChild: !!isChild,
                        rowKey: row && row.key,
                        rowIndex: rowIndex
                    });

                    // IMPORTANT: keep placeholder so the row never becomes ragged
                    if (content == null) return '';

                    // Normalize common render return types for export use
                    if (isObj(content) && content.html != null) {
                        return stripHtml(content.html);
                    }

                    // DOM Node -> use its text
                    if (_isNode(content)) return content.textContent || '';

                    return String(content);
                });
            }

            const savedPagingEnabled = this.state.pagingEnabled;
            this.state.pagingEnabled = false;

            // Keep the load call consistent with the *table state*, but we only render/export filtered cols.
            return this.dataSource.load(this.state, this.columns)
                .then(function (result) {
                    const rows = Array.isArray(result?.rows) ? result.rows : [];

                    // Flat list of rows: parent row, then each child row as its own row
                    const outRows = [];
                    rows.forEach((row, i) => {
                        outRows.push(buildRowArray(row, i, false));

                        const children = (self.childRows?.enabled ? self._getChildrenForRow(row) : null) || [];
                        children.forEach((childRow, ci) => {
                            outRows.push(buildRowArray(childRow, ci, true));
                        });
                    });

                    return { headers, rows: outRows };
                })
                .finally(() => {
                    this.state.pagingEnabled = savedPagingEnabled;
                });
        }

        /**
         * Draw (render) the table using the current state (paging/search/sort/filters).
         * In Ajax/server-side mode this triggers a request; in local mode it re-renders immediately.
         */
        draw() {
            const self = this;

            // Refresh caches once per draw (visible columns, counts, render plan)
            this._refreshColumnCaches();

            const drawId = ++this._internals.drawSeq;

            // Ajax-only: abort previous in-flight request, attach signal to state
            if (self._isAjax) {
                try {
                    if (self._internals.activeAbort) self._internals.activeAbort.abort();
                } catch (e) { /* noop */ }
                self._internals.activeAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
                self.state.__signal = self._internals.activeAbort ? self._internals.activeAbort.signal : undefined;
            } else {
                self.state.__signal = undefined;
            }

            function onLoad(result) {
                // Ignore stale async results (out-of-order Ajax responses)
                if (self._isAjax && drawId !== self._internals.drawSeq) return;

                const rows = Array.isArray(result && result.rows) ? result.rows : [];
                const total = (result && isNbr(result.total)) ? result.total : rows.length;

                self.state.totalRows = total;
                self._lastPageRows = rows;

                if (self._isAjax) {
                    self._emit('xhr', {
                        rows: rows,
                        total: total,
                        state: Object.assign({}, self.state)
                    });
                }

                self._renderBody(rows);

                if (self.pager) self.pager.update();
                self._updateSortIndicators();
                self._syncStickyHeaderContent();
                self._stickyHeaderSchedule?.();

                var showFooter = self._updateFooterVisibility();
                if (showFooter) {
                    self._updateFooterAggregates(self._getAllVisibleRowsForAggregates(rows));
                }

                self._postBodyRender(rows);

                // Tooltips for dynamically rendered rows (delegated when possible)
                self._initTooltipsInScope(self.tbody);

                const drawSettings = {
                    table: self.table,
                    state: Object.assign({}, self.state),
                    columns: self.columns,
                    options: self.options,
                    dom: self.getDom()
                };

                self._emit('draw', drawSettings);
                if (isFn(self.options.drawCallback)) {
                    self.options.drawCallback.call(self.api(), drawSettings);
                }
            }

            if (self._isAjax) self.table.classList.add(TINY_TABLE_CLASSES.loading);

            const drawPromise = this.dataSource.load(this.state, this.columns)
                .then(onLoad)
                .catch(function (err) {
                    // Abort is expected under rapid input / pagination
                    if (err && err.name === 'AbortError') return;
                    // Common status-specific handling (optional)
                    const status = err && err.status;

                    // Optional centralized error hook
                    if (isFn(self.options.onError)) {
                        try { self.options.onError(err); } catch (e) { /* noop */ }
                    } else if (status !== 401 && typeof console?.error !== 'undefined') {
                        console.error('TinyDataTable error:', err);
                        if (err && err.body) console.error('Response body:', err.body);
                    }

                    if (status === 401) {
                        // Unauthorized: typically session expired / login redirect
                        self._emit('error:unauthorized', { error: err, status });
                        // You can also optionally show a UI message here if you want
                        // (avoid forcing behavior: leave to user-land via onError/event)
                    } else if (status === 500) {
                        self._emit('error:server', { error: err, status });
                    } else if (isNbr(status)) {
                        self._emit('error:http', { error: err, status });
                    } else {
                        self._emit('error', { error: err });
                    }

                    // Do not silently swallow errors (critical for html mode invalid Node returns)
                    throw err;
                })

                .finally(function () {
                    if (self._isAjax) {
                        try { self.table.classList.remove(TINY_TABLE_CLASSES.loading); } catch (e) { /* noop */ }
                    }
                });

            this._internals.drawPromise = drawPromise;
            return drawPromise;
        }

        /**
         * Redraw header, footer and current page body using cached rows only.
         * Does not reload ajax data.
         * Does not change the current page.
         *
         * @returns {TinyDataTable}
         */
        redrawFromCache() {
            const rows = this._lastPageRows ?? [];

            this._refreshColumnCaches();

            this.drawHeader();
            this.drawFooter();

            this._renderBody(rows);

            if (this.pager) {
                this.pager.update();
            }

            this._updateSortIndicators();
            this._syncStickyHeaderContent();
            this._stickyHeaderSchedule?.();

            const showFooter = this._updateFooterVisibility();
            if (showFooter) {
                this._updateFooterAggregates(this._getAllVisibleRowsForAggregates(rows));
            }

            this._postBodyRender(rows);
            this._initTooltipsInScope(this.tbody);

            const drawSettings = {
                table: this.table,
                state: Object.assign({}, this.state),
                columns: this.columns,
                options: this.options,
                dom: this.getDom(),
                fromCache: true
            };

            this._emit('draw', drawSettings);

            if (isFn(this.options.drawCallback)) {
                this.options.drawCallback.call(this.api(), drawSettings);
            }

            return this;
        }

        refresh() {
            if (isFn(this.dataSource.refresh)) this.dataSource.refresh();
                return this.draw();
        }
        /**
         * Set the global search text and re-draw.
         * @param {string} text
         */

        search(text) {
            this.state.searchText = text || '';
            this.state.page = 1;
            this._emit('search', {searchText: this.state.searchText});
            return this.draw();
        }


        _getTooltipAdapter() {
            // User provided adapter can be:
            //  - a function(el, content)
            //  - an object: { bind(el, content), delegate(root, options) }
            if (GLOBAL_TOOLTIP_ADAPTER) {
                return GLOBAL_TOOLTIP_ADAPTER;
            }

            // Built-in Tippy.js adapter (if available)
            if (typeof window !== "undefined" && window.tippy) {
                const tippy = window.tippy;
                return {
                    delegate: function (root) {
                        if (typeof tippy.delegate !== "function") return false;
                        tippy.delegate(root, {
                            target: "[data-tooltip]",
                            allowHTML: true,
                            content: function (ref) { return ref.getAttribute("data-tooltip") || ""; }
                        });
                        return true;
                    },
                    bind: function (el, content) {
                        if (!content) return;
                        if (isFn(tippy)) {
                            tippy(el, { content: content, allowHTML: true });
                        }
                    }
                };
            }

            return null;
        }
        _initTooltipsInScope(root) {
            const adapter = this._getTooltipAdapter();
            if (!adapter) return;

            const tooltipsOpt = (this.options && this.options.tooltips) || {};

            // 1) Prefer delegation if supported and not disabled
            if (!this._internals.tooltipsDelegated &&
                tooltipsOpt.delegate !== false &&
                isObj(adapter) &&
                isFn(adapter.delegate)) {

                const ok = adapter.delegate(root, tooltipsOpt);
                if (ok !== false) {
                    this._internals.tooltipsDelegated = true;
                    return; // delegated: no scan/bind per draw
                }
            }

            // 2) Fallback: per-element binding
            const bindFn = isFn(adapter) ? adapter : (isObj(adapter) && isFn(adapter.bind)) ? adapter.bind : null;

            if (!bindFn) return;

            const rootScope = this.tbody || this.table;
            const elements = rootScope.querySelectorAll("[data-tooltip]");
            elements.forEach((el) => {
                if (el._dtTooltipInited) return;
                el._dtTooltipInited = true;
                bindFn(el, el.getAttribute("data-tooltip"));
            });
        }

        /**
         * Toggle sorting for a given column key.
         * Cycles for that key: none -> asc -> desc -> none.
         * After a click, only this key is used (single-column sort via UI).
         * Multi-column sorting is intended for defaultSort / programmatic use.
         */
        /**
         * Toggle sorting for a given column key.
         * Default click: single-column sort only (sortOrders becomes [key] or []).
         * Shift+click (opts.append=true): multi-sort (add/promote key while keeping other sort specs).
         *
         * Cycle for the clicked key: none -> asc -> desc -> none
         */
        /**
         * Sort by a column key (or array of sort orders) and re-draw.
         * @param {string|Array<{key:string,dir:'asc'|'desc'}>} key
         * @param {'asc'|'desc'} [dir]
         */

        sortBy(key, opts) {
            opts = opts || {};
            var append = !!opts.append;

            // Find column and ensure sortable
            var col = null;
            for (var i = 0; i < this.columns.length; i++) {
                if (this.columns[i].key === key) { col = this.columns[i]; break; }
            }
            if (!col || col.sortable === false) return;

            var prevOrders = this.state.sortOrders ? this.state.sortOrders.slice() : [];
            var orders = prevOrders.slice();

            // Find existing order for this key
            var index = -1;
            for (var j = 0; j < orders.length; j++) {
                if (orders[j] && orders[j].key === key) { index = j; break; }
            }

            // Determine currentDir
            var currentDir = (index === -1) ? null : (orders[index].dir || orders[index].direction || null);
            currentDir = currentDir ? String(currentDir).toLowerCase() : null;

            // Cycle: none -> asc -> desc -> none
            var nextDir;
            if (!currentDir) nextDir = 'asc';
            else if (currentDir === 'asc') nextDir = 'desc';
            else nextDir = null;

            var changed = { key: key, dir: nextDir };
            var nextOrders = [];

            if (!append) {
                // SINGLE SORT: replace with only clicked column (or none)
                nextOrders = nextDir ? [{ key: key, dir: nextDir }] : [];
            } else {
                // MULTI SORT (Shift): append new key as LAST priority, toggle existing IN PLACE
                nextOrders = orders.slice();

                if (index === -1) {
                    // Not present -> add as last (secondary/tertiary/etc.)
                    if (nextDir) nextOrders.push({ key: key, dir: nextDir });
                } else {
                    if (nextDir) {
                        // Toggle dir but KEEP its position (priority)
                        nextOrders[index] = { key: key, dir: nextDir };
                    } else {
                        // Remove it, keep relative order of others
                        nextOrders.splice(index, 1);
                    }
                }
            }

            this.state.sortOrders = nextOrders;
            this.state.page = 1;

            this._emit('order', {
                sortOrders: this.state.sortOrders.slice(),
                previousSortOrders: prevOrders,
                changed: changed,
                append: append
            });

            return this.draw();
        }


        /**
         * Reveal the first logical row whose data column matches `value`.
         *
         * In local/load-once mode, the method resolves the matching row against
         * the full filtered/sorted data set, navigates to the page containing it,
         * waits for the redraw, then scrolls to and temporarily highlights every
         * rendered row with the same value. In server-side mode it can only reveal
         * rows already present in the currently loaded response.
         *
         * The method deliberately works from the table's row data (`tr._data`) and
         * does not require consumer-specific `data-*` attributes on the DOM.
         *
         * @param {string} column Row-data property to match.
         * @param {*} value Value to reveal.
         * @returns {Promise<boolean>} True when at least one rendered row was revealed.
         */
        async revealRow(column, value) {
            if (!isStr(column) || !column.trim() || value == null) return false;

            const key = column.trim();
            const targetValue = String(value);
            const matches = row => {
                if (!row || row[key] == null) return false;
                return String(row[key]) === targetValue;
            };

            // The constructor starts the first draw asynchronously. Reuse that
            // promise instead of triggering a duplicate AJAX request.
            const pendingDraw = this._internals.drawPromise;
            if (pendingDraw && isFn(pendingDraw.then)) {
                await pendingDraw;
            }

            const canResolveAllRows = isFn(this.dataSource?.getFilteredRows);
            const rows = canResolveAllRows
                ? this.dataSource.getFilteredRows(this.state, this.columns)
                : (Array.isArray(this._lastPageRows) ? this._lastPageRows : []);

            const index = rows.findIndex(matches);
            if (index < 0) return false;

            // Local/load-once pagination is performed after filtering/sorting, so
            // the index above maps directly to TinyDataTable's 1-based page.
            if (canResolveAllRows && this.state.pagingEnabled && this.state.pageSize > 0) {
                const page = Math.floor(index / this.state.pageSize) + 1;
                if (page !== this.state.page) {
                    const redraw = this.goToPage(page);
                    if (redraw && isFn(redraw.then)) await redraw;
                }
            }

            if (!this.tbody) return false;

            const renderedRows = Array.from(this.tbody.querySelectorAll('tr')).filter(tr => matches(tr._data));
            if (!renderedRows.length) return false;

            // Clear a previous reveal before highlighting the new target.
            this.tbody.querySelectorAll(`tr.${TINY_TABLE_CLASSES.revealedRow}`).forEach(tr => {
                tr.classList.remove(TINY_TABLE_CLASSES.revealedRow);
            });
            if (this._internals.revealTimer) {
                clearTimeout(this._internals.revealTimer);
                this._internals.revealTimer = null;
            }

            renderedRows.forEach(tr => tr.classList.add(TINY_TABLE_CLASSES.revealedRow));

            const reduceMotion = typeof window !== 'undefined'
                && isFn(window.matchMedia)
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            renderedRows[0].scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'center',
                inline: 'nearest'
            });

            this._internals.revealTimer = setTimeout(() => {
                renderedRows.forEach(tr => {
                    if (tr?.classList) tr.classList.remove(TINY_TABLE_CLASSES.revealedRow);
                });
                this._internals.revealTimer = null;
            }, 4000);

            return true;
        }

        /**
         * Change the current page (1-based) and re-draw.
         * @param {number} page
         */

        goToPage(page) {
            if (!this.paging.enabled) return;
            var maxPage = Math.max(1, Math.ceil(this.state.totalRows / this.state.pageSize));
            var oldPage = this.state.page;
            var newPage = Math.min(Math.max(1, page), maxPage);

            if (newPage === oldPage) return;

            this.state.page = newPage;
            this._emit('page', {page: newPage, oldPage: oldPage});
            return this.draw();
        }

        setData(data) {
            if (!(this.dataSource instanceof LocalDataSource)) {
                throw new Error('setData is only available in local data mode');
            }
            this.dataSource.setData(data || []);
            this.state.page = 1;
            return this.draw();
        }

        /**
         * Get the currently selected row keys.
         * The key is determined by `columns[].key` + internal row-key rules (see README).
         * @returns {Array<string>}
         */

        getSelectedRowKeys() {
            return Array.from(this._selectedRowKeys);
        }

        /**
         * Get one loaded parent row by row key.
         *
         * This is the public counterpart of the internal row cache. Consumers must
         * not read `_rowDataByKey` directly.
         *
         * @param {string|number} rowKey
         * @returns {Object|null}
         */
        getRow(rowKey) {
            if (rowKey === null || rowKey === undefined) return null;

            var key = String(rowKey);
            var dataMap = this._rowDataByKey || {};

            return Object.prototype.hasOwnProperty.call(dataMap, key)
                ? dataMap[key]
                : null;
        }

        /**
         * Get loaded parent rows by row keys, preserving key order.
         * Unknown keys are ignored.
         *
         * @param {Array<string|number>} rowKeys
         * @returns {Array<Object>}
         */
        getRows(rowKeys) {
            if (!Array.isArray(rowKeys)) return [];

            var result = [];
            for (var i = 0; i < rowKeys.length; i++) {
                var row = this.getRow(rowKeys[i]);
                if (row) result.push(row);
            }
            return result;
        }

        /**
         * Get the data objects of the currently selected rows.
         * @returns {Array<Object>}
         */
        getSelectedRows() {
            return this.getRows(this.getSelectedRowKeys());
        }

        /**
         * Return the normalized selection state for one loaded row.
         *
         * `select.canSelect` may return:
         * - true / false
         * - a string (rejected, using the string as the reason)
         * - { selectable: boolean, reason?: string }
         *
         * Selected rows always remain selectable so the user can unselect them.
         *
         * @param {string|number} rowKey
         * @param {Object} context
         * @returns {{selectable:boolean, reason:string}}
         */
        getRowSelectionState(rowKey, context = {}) {
            var key = rowKey === null || rowKey === undefined ? '' : String(rowKey);
            var row = this.getRow(key);

            if (!row || !this.select.enabled) {
                return { selectable: false, reason: '' };
            }

            if (this._selectedRowKeys.has(key) || !isFn(this.select.canSelect)) {
                return { selectable: true, reason: '' };
            }

            var decision = this.select.canSelect.call(this, {
                row: row,
                rowKey: key,
                mode: context.mode || 'row',
                selectedRowKeys: this.getSelectedRowKeys(),
                selectedRows: this.getSelectedRows(),
                table: this
            });

            if (isStr(decision)) {
                return { selectable: false, reason: decision };
            }

            if (isObj(decision)) {
                return {
                    selectable: decision.selectable !== false,
                    reason: decision.reason ? String(decision.reason) : ''
                };
            }

            return { selectable: decision !== false, reason: '' };
        }

        /**
         * Return whether one loaded row can currently be selected.
         *
         * @param {string|number} rowKey
         * @param {Object} context
         * @returns {boolean}
         */
        isRowSelectable(rowKey, context = {}) {
            return this.getRowSelectionState(rowKey, context).selectable;
        }

        /**
         * Get rows from the current page that can participate in selection now.
         * Already-selected rows are included so they can always be unselected.
         *
         * @returns {Array<Object>}
         */
        getSelectableRowsOnPage() {
            var keys = Array.isArray(this._pageParentRowKeys)
                ? this._pageParentRowKeys
                : [];
            var result = [];

            for (var i = 0; i < keys.length; i++) {
                if (!this.isRowSelectable(keys[i], { mode: 'page' })) continue;
                var row = this.getRow(keys[i]);
                if (row) result.push(row);
            }

            return result;
        }

        /**
         * Clear current selection and re-draw selection UI.
         */

        clearSelection() {
            this._selectedRowKeys.clear();
            this._syncSelectionDomAndHeader();
            this._emit('select', {
                mode: 'clear',
                rowKey: null,
                checked: false,
                affectedRowKeys: [],
                selectedRowKeys: this.getSelectedRowKeys()
            });
        }

        /**
         * Select a row by its rowKey.
         * @param {string} rowKey
         */

        selectRow(rowKey) {
            if (!rowKey) return false;

            var key = String(rowKey);
            if (!this.isRowSelectable(key, { mode: 'api' })) {
                this._syncSelectionDomAndHeader();
                return false;
            }

            this._selectedRowKeys.add(key);
            this._syncSelectionDomAndHeader();
            return true;
        }

        /**
         * Unselect a row by its rowKey.
         * @param {string} rowKey
         */

        unselectRow(rowKey) {
            if (!rowKey) return false;
            var changed = this._selectedRowKeys.delete(String(rowKey));
            this._syncSelectionDomAndHeader();
            return changed;
        }

        /**
         * Select all selectable rows on the current page.
         */

        selectAllOnPage() {
            var self = this;
            if (!this._pageParentRowKeys) return;

            this._pageParentRowKeys.forEach(function (k) {
                if (self.isRowSelectable(k, { mode: 'page' })) {
                    self._selectedRowKeys.add(String(k));
                }
            });

            this._syncSelectionDomAndHeader();
        }

        /**
         * Unselect all rows on the current page.
         */

        unselectAllOnPage() {
            var self = this;
            if (!this._pageParentRowKeys) return;
            this._pageParentRowKeys.forEach(function (k) {
                self._selectedRowKeys.delete(k);
            });
            this._syncSelectionDomAndHeader();
        }

        _loadLazyChildren(rowKey) {
            const { lazyLoad, rowId } = this.childRows || {};
            if (!lazyLoad) return Promise.resolve([]);

            const parent = this._rowDataByKey[rowKey];
            const parentId = parent && (rowId ? rowId(parent) : parent.id);
            if (!parentId) return Promise.resolve([]);

            let url;
            if (isPlainObject(lazyLoad)) {
                if (lazyLoad.url) {
                    url = isFn(lazyLoad.url) ? lazyLoad.url(parentId, parent) : (isStr(lazyLoad) ? url : undefined);
                }
                if (isFn(lazyLoad.load)) {
                    return toArrayPromise(lazyLoad.load(parentId, parent));
                }
            }

            // Resolve URL (string override or default ajax)
            if (!url && lazyLoad === true && this._isAjax && this.options.ajax?.url) {
                url = this.options.ajax?.url;
            }

            if (!url) return Promise.resolve([]);

            return toArrayPromise(_dtAjaxRequest(url, { params: { child: true, rowId: parentId }}));
        }

        /**
         * Expand child rows for the given parent rowKey.
         * If `childRows.lazyLoad` is enabled, this may trigger a children Ajax request.
         * @param {string} rowKey
         */

        expandChildRows(rowKey) {
            if (!this.childRows.enabled || !rowKey) return;
            const afterInsertChildRows = (rowKey) => {
                this._insertChildRowsForParent(rowKey);
                this._emit("childShown", {rowKey});
            }
            const dataKey = this.childRows.dataKey || "children";
            const row = this._rowDataByKey[rowKey];
            if (this.childRows.lazyLoad && (!row[dataKey] || row[dataKey].length === 0)) {
                this._expandedRowKeys.add(rowKey);
                return this._loadLazyChildren(rowKey).then(children => {
                    row[dataKey] = children || [];
                    afterInsertChildRows(rowKey);
                });
            } else {
                this._expandedRowKeys.add(rowKey);
                afterInsertChildRows(rowKey);
            }
        }

        /**
         * Collapse child rows for the given parent rowKey.
         * @param {string} rowKey
         */

        collapseChildRows(rowKey) {
            if (!this.childRows.enabled || !rowKey) return;
            if (!this._expandedRowKeys.has(rowKey)) return;

            this._expandedRowKeys.delete(rowKey);
            this._emit('childHidden', {rowKey: rowKey});

            // Only remove the child rows for this parent
            this._removeChildRowsForParent(rowKey);
        }

        /**
         * Toggle child rows for the given parent rowKey.
         * @param {string} rowKey
         */

        toggleChildRows(rowKey) {
            if (!this.childRows.enabled || !rowKey) return;
            if (this._expandedRowKeys.has(rowKey)) {
                this.collapseChildRows(rowKey);
            } else {
                this.expandChildRows(rowKey);
            }
        }

        /**
         * Collapse all currently expanded child rows.
         */

        collapseAllChildRows() {
            if (!this.childRows.enabled) return;
            if (this._expandedRowKeys.size === 0) return;

            this._expandedRowKeys.clear();
            this._emit('childHidden', {rowKey: null, all: true});

            // Remove all child rows in one shot
            if (this.tbody) {
                var childSelector = 'tr.' + TINY_TABLE_CLASSES.childRow;
                this.tbody.querySelectorAll(childSelector).forEach(function (tr) {
                    tr.remove();
                });

                // Reset all toggle icons
                var iconSelector = '.' + TINY_TABLE_CLASSES.toggleIcon + '[data-tt-toggle="row"].expanded';
                this.tbody.querySelectorAll(iconSelector).forEach(function (icon) {
                    icon.classList.remove('expanded');
                });
            }

            if (this.highlight && this.highlight.enabled) {
                this._applyHighlight();
            }
        }

        _getRowKey(row, rowIndex, fallbackPrefix) {
            var prefix = fallbackPrefix || 'row';
            if (isFn(this.childRows.rowId)) {
                var k = this.childRows.rowId(row);
                if (k != null) return String(k);
            }
            if (row && row.id != null) return String(row.id);
            if (row && isNbr(row.__dt_index)) return String(row.__dt_index);
            return prefix + '-' + rowIndex;
        }

        _getChildrenForRow(row) {
            if (!this.childRows.enabled) return null;
            var key = this.childRows.dataKey;
            var value = row && row[key];
            if (!Array.isArray(value) || value.length === 0) return null;
            return value;
        }

        _hasChildRows(row) {
            if (isPlainObject(this.options.childRows?.lazyLoad) && isFn(this.options.childRows?.lazyLoad.hasChildren)) {
                return !!this.options.childRows?.lazyLoad.hasChildren(row);
            }
            var children = this._getChildrenForRow(row);
            return !!(children && children.length);
        }

        _getChildColumnsForParent(parentRow) {
            var cfg = this.childRows || {};
            var cols = null;

            if (isFn(cfg.getColumns)) {
                cols = cfg.getColumns(parentRow);
            } else if (Array.isArray(cfg.columns) && cfg.columns.length) {
                cols = cfg.columns;
            } else {
                cols = this.columns;
            }

            cols = Array.isArray(cols) ? cols : [];

            // Ensure child columns are normalized and visibility rules are respected.
            // (renderDataRow no longer checks col.visible === false for performance reasons)
            this.normalizeColumn(cols, 'childcol');
            return cols.filter(function (c) { return !(c && c.visible === false); });
        }


        _insertChildRowsForParent(rowKey) {
            if (!this.tbody || !rowKey) return;

            var parentTr = this.tbody.querySelector('tr[data-row-key="' + rowKey + '"]');
            if (!parentTr) return;

            var row = this._rowDataByKey[rowKey];
            if (!row) return;

            var children = this._getChildrenForRow(row);
            if (!children || !children.length) return;

            var childColumns = this._getChildColumnsForParent(row);
            var groupKey = parentTr.dataset.groupKey || null;
            var self = this;

            var frag = document.createDocumentFragment();

            children.forEach(function (childRow, childIndex) {
                var childKey = self._getRowKey(
                    childRow,
                    childIndex,
                    'child-of-' + rowKey
                );

                var childTr = self._renderDataRow(
                    childRow,
                    childIndex,
                    childKey,
                    true,
                    childColumns,
                    {
                        hasChildren: false,
                        isExpanded: false,
                        mergeColumnsSet: null,
                        groupSize: 1,
                        rowIndexInGroup: 0,
                        groupKey: groupKey
                    }
                );

                childTr.classList.add(TINY_TABLE_CLASSES.childRow);
                childTr.dataset.parentKey = rowKey;
                frag.appendChild(childTr);
            });

            parentTr.parentNode.insertBefore(frag, parentTr.nextSibling);

            var icon = parentTr.querySelector('.' + TINY_TABLE_CLASSES.toggleIcon + '[data-tt-toggle="row"]');
            if (icon) icon.classList.add('expanded');

            if (this.highlight && this.highlight.enabled) {
                this._applyHighlight();
            }
        }

        _removeChildRowsForParent(rowKey) {
            if (!this.tbody || !rowKey) return;

            var selector = `tr.${TINY_TABLE_CLASSES.childRow}[data-parent-key="${rowKey}"]`;

            this.tbody.querySelectorAll(selector).forEach(function (tr) {
                tr.remove();
            });

            var parentTr = this.tbody.querySelector('tr[data-row-key="' + rowKey + '"]');
            if (parentTr) {
                var icon = parentTr.querySelector('.' + TINY_TABLE_CLASSES.toggleIcon + '[data-tt-toggle="row"]');
                if (icon) icon.classList.remove('expanded');
            }

            if (this.highlight && this.highlight.enabled) {
                this._applyHighlight();
            }
        }

        _hasGrouping() {
            const g = this.grouping;
            return !!(g && g.enabled && (isFn(g.keyFn) || (g.keys && g.keys.length)));
        }

        _buildGroupingCtx(rows) {
            const g = this.grouping || {};
            const pre = g.precompute || {};
            const ctx = { precompute: {}, rows: rows };

            // --- countDistinctBy ---
            const defs = pre.countDistinctBy;
            if (defs && Array.isArray(defs) && defs.length) {
                ctx.precompute.countDistinctBy = Object.create(null);

                for (const def of defs) {
                    if (!def || !def.by || !def.distinct || !def.name) continue;

                    const bucket = {
                        // Map<byValue, count>
                        sizeBy: new Map(),
                        // internal: Map<byValue, Set<distinctValue>>
                        _setBy: new Map()
                    };

                    const when = isFn(def.when) ? def.when : null;

                    for (const r of rows) {
                        if (!r) continue;
                        if (when && !when(r)) continue;

                        const k = r[def.by];
                        if (k == null) continue;

                        const dv = r[def.distinct];
                        if (dv == null) continue;

                        let set = bucket._setBy.get(k);
                        if (!set) {
                            set = new Set();
                            bucket._setBy.set(k, set);
                        }
                        const before = set.size;
                        set.add(dv);
                        if (set.size !== before) bucket.sizeBy.set(k, set.size);
                    }

                    ctx.precompute.countDistinctBy[def.name] = bucket;
                }
            }

            // --- Custom precompute
            if (isFn(pre.custom)) {
                const extra = pre.custom(rows, ctx);
                if (isObj(extra)) {
                    for (const k of Object.keys(extra)) {
                        if (k in ctx.precompute) continue; // or throw
                        ctx.precompute[k] = extra[k];
                    }
                }
            }

            // Convenience helpers
            ctx.getDistinctCount = function (name, byValue) {
                const b = ctx?.precompute?.countDistinctBy?.[name];
                if (!b) return 0;
                return b.sizeBy.get(byValue) || 0;
            };

            ctx.typeOf = function (row) {
                return isFn(g.typeFn) ? g.typeFn(row, ctx) : null;
            };
            ctx.keyOf = function (row) {
                return isFn(g.keyFn) ? g.keyFn(row, ctx) : null;
            };

            return ctx;
        }

        _buildGroups(rows, gctx) {
            var grouping = this.grouping;
            var groups = [];
            var groupIndexByKey = Object.create(null);

            const useKeyFn = isFn(grouping.keyFn);
            const useKeys = (!useKeyFn && Array.isArray(grouping.keys) && grouping.keys.length);

            rows.forEach(function (row, rowIndex) {
                // Resolve groupKey
                let groupKey;

                if (useKeyFn) {
                    groupKey = grouping.keyFn(row, gctx);

                    // Never allow blank keys (blank would merge unrelated rows)
                    if (groupKey == null || String(groupKey).trim() === '') {
                        groupKey = `__auto__|${rowIndex}`;
                    } else {
                        groupKey = String(groupKey);
                    }
                } else if (useKeys) {
                    var keyParts = grouping.keys.map(function (k) {
                        return row ? row[k] : null;
                    });
                    groupKey = keyParts
                        .map(function (value) {
                            if (value == null) return null;
                            const str = String(value).trim();
                            if (!str) return null;
                            return str;
                        })
                        .filter(Boolean)
                        .join('|');

                    if (!groupKey) groupKey = `__auto__|${rowIndex}`;
                } else {
                    groupKey = `__auto__|${rowIndex}`;
                }

                var group;
                if (Object.prototype.hasOwnProperty.call(groupIndexByKey, groupKey)) {
                    group = groups[groupIndexByKey[groupKey]];
                } else {
                    group = {
                        key: groupKey,
                        keys: useKeys ? grouping.keys : null,
                        values: {},
                        rows: []
                    };

                    // legacy group.values support
                    if (useKeys) {
                        var keyParts2 = grouping.keys.map(function (k) {
                            return row ? row[k] : null;
                        });
                        grouping.keys.forEach(function (k, idx) {
                            group.values[k] = keyParts2[idx];
                        });
                    }

                    // computed type at group level (for branching without mutating rows)
                    if (isFn(grouping.typeFn)) {
                        group.values.__groupType = grouping.typeFn(row, gctx);
                    }

                    groupIndexByKey[groupKey] = groups.length;
                    groups.push(group);
                }
                group.rows.push(row);
            });

            return groups;
        }

        _isColumnVisible(col) {
            return col.visible !== false;
        }

        _getVisibleColumns() {
            return this.columns.filter(col => this._isColumnVisible(col));
        }

        setColumnVisibility(targets, visible = true) {
            if (!Array.isArray(targets)) targets = [targets];
            if (!targets.length) return this;

            const isIndexMode = typeof targets[0] === 'number';
            const targetSet = new Set(targets);

            let changed = false;

            this.columns.forEach((col, index) => {
                const match = isIndexMode ? targetSet.has(index) : targetSet.has(col.key);
                if (match) {
                    const nextVisible = !!visible;
                    if (col.visible !== nextVisible) {
                        col.visible = nextVisible;
                        changed = true;
                    }
                }
            });

            if (!changed) return this;

            this.redrawFromCache();

            return this;
        }

        /**
         * Refresh per-draw column caches to avoid repeated work inside hot loops.
         * Called once per draw (and whenever columns visibility/selection changes).
         */
        _refreshColumnCaches() {
            // Visible data columns (excluding select column)
            this._internals.visibleColumns = this._getVisibleColumns();
            // Total visible grid columns, including select column (if enabled)
            this._internals.visibleColumnCount = this._internals.visibleColumns.length + (this.select?.enabled ? 1 : 0);
            // Render plan is used by HTML render mode (optional) and other optimizations
            this._internals.renderPlan = this._buildRenderPlan();
        }

        /**
         * Build a lightweight plan for rendering visible columns.
         * @param {Array<Object>} visibleColumns
         */
        _buildRenderPlan() {
            return this._internals.visibleColumns.map(function (col) {
                return {
                    col: col,
                    className: col?.className,
                    hasTooltip: !!col?.tooltip,
                    hasRender: isFn(col?.render)
                };
            });
        }

        _applyGroupRowCustomClass(tr, group, meta) {
            if (!this.customClass || !this.customClass.groupRow) return;

            var cfg = this.customClass.groupRow;
            var classes = isFn(cfg) ? cfg(group, meta || {}) : cfg;

            if (classes && isStr(classes)) {
                classes = classes.trim().split(/\s+/);

                if (Array.isArray(classes)) {
                    classes.forEach(function (c) {
                        if (c && isStr(c)) {
                            tr.classList.add(c);
                        }
                    });
                }
            }
        }


        _renderGroupHeaderRow(group, groupIndex, visibleColCount, gctx) {

            function setGroupHeaderDataAttributes(tr, groupingKeys, groupValues, groupRows) {

                if (groupRows.length>1) {
                    tr.dataset.groupSize = groupRows.length;
                }

                if (!Array.isArray(groupingKeys)) return;

                var firstRow = groupRows[0];

                for (const key of groupingKeys) {
                    const raw =
                        (groupValues && groupValues[key] != null) ? groupValues[key] :
                            (firstRow && firstRow[key] != null) ? firstRow[key] :
                                null;

                    if (raw == null) continue;

                    const val = String(raw).trim();
                    if (!val) continue;

                    // dataset requires camelCase
                    const dsKey = 'group' + toCamelCase(key).replace(/^(.)/, m => m.toUpperCase());
                    tr.dataset[dsKey] = val;
                }
            }

            var tr = _dtCreateElement('tr', TINY_TABLE_CLASSES.groupHeaderRow);

            setGroupHeaderDataAttributes(
                tr,
                group.keys,        // ['orderId', 'paymentType']
                group.values,         // whatever you store when building groups
                group.rows
            );

            // base params: shared, stable, no ctx
            const params = {
                tr,
                group,
                rows: group.rows,
                groupIndex,
                groupKey: group.key,
                values: group.values,
                visibleColCount,
                api: this,
                gctx: gctx
            };

            // createdRow: no ctx, but bind this
            if (this.grouping?.header && isFn(this.grouping.header.createdRow)) {
                this.grouping.header.createdRow.call(this, params);
            }

            this._applyCustomClass(tr, 'groupRow', group, {
                isGroupHeader: true,
                groupIndex,
                groupKey: group.key
            });

            var label;

            if (this.grouping?.header && isFn(this.grouping.header.render)) {
                // ctx only for render
                var ctx = {
                    phase: 'display',
                    _esc: escapeHtml,
                    _blank: isBlank,
                    _html: function (html) { return { __tinyHtml: true, html: String(html) }; }
                };

                // renderParams: shallow clone + ctx
                const renderParams = Object.assign({}, params, { ctx });

                label = this.grouping.header.render.call(this, renderParams);

                // only accept trusted html wrapper
                if (isObj(label) && label.__tinyHtml === true && label.html != null) {
                    tr.insertAdjacentHTML('beforeend', String(label.html));
                    return tr;
                }
            }

            if (label == null) {
                if (Array.isArray(this.grouping.keys) && this.grouping.keys.length) {
                    label = this.grouping.keys.map(k => group.values[k]).join(' - ');
                } else {
                    label = group.key;
                }
            }

            var td = _dtCreateElement('td', TINY_TABLE_CLASSES.groupHeaderCell, { colSpan: visibleColCount });

            if (label instanceof Node) td.appendChild(label);
            else td.appendChild(document.createTextNode(label != null ? String(label) : ''));

            tr.appendChild(td);
            return tr;
        }

        _initWrapper() {
            var needWrapper = this.scrollX !== false || this.scrollY !== false;
            if (!needWrapper) return;

            var table = this.table;
            var parent = table.parentNode;
            if (!parent) return;

            const _resolveOverflow = v => v === 'auto' ? 'auto' : (v ? 'scroll' : 'visible');

            if (parent.classList?.contains(TINY_TABLE_CLASSES.wrapper)) {
                parent.style.overflowX = _resolveOverflow(this.scrollX);
                parent.style.overflowY = _resolveOverflow(this.scrollY);
                this.wrapper = parent;
                return;
            }

            var wrapper = _dtCreateElement('div', TINY_TABLE_CLASSES.wrapper);

            wrapper.style.overflowX = _resolveOverflow(this.scrollX);
            wrapper.style.overflowY = _resolveOverflow(this.scrollY);

            parent.insertBefore(wrapper, table);
            wrapper.appendChild(table);

            this.wrapper = wrapper;
        }

        /**
         * Ensure that a high-level container exists when any outer UI
         * (pager, search box, filters bar) is enabled. The container wraps
         * the table or its scroll wrapper together with the pager.
         */
        _ensureContainer() {
            var needContainer =
                this.paging?.enabled || this.paging?.showInfo ||
                this.searchConfig?.enabled ||
                (this.filters && this.filters.enabled && Array.isArray(this.filters.items) && this.filters.items.length > 0);

            if (!needContainer) return;

            if (this.container && this.container.parentNode) {
                return;
            }

            var anchor = this.wrapper || this.table;

            var existingContainer = anchor.closest(`.${TINY_TABLE_CLASSES.container}`);
            if (existingContainer) {
                this.container = existingContainer;
                return;
            }

            var parent = anchor.parentNode;
            if (!parent) return;

            var container = _dtCreateElement('div', TINY_TABLE_CLASSES.container);

            parent.insertBefore(container, anchor);
            container.appendChild(anchor);

            this.container = container;
        }


        /**
         * Initialize the optional floating sticky header.
         *
         * A cloned header is used instead of CSS position:sticky because the
         * TinyDataTable horizontal scroll wrapper is itself an overflow
         * container. Native sticky headers would otherwise stick to that
         * wrapper instead of the page viewport.
         *
         * @private
         */
        _initStickyHeader() {
            if (!this.stickyHeader?.enabled || !this.thead || typeof document === 'undefined') return;

            const self = this;
            const floating = _dtCreateElement('div', TINY_TABLE_CLASSES.stickyHeader, {
                'aria-hidden': 'true'
            });
            floating.hidden = true;

            if (Number.isFinite(this.stickyHeader.zIndex)) {
                floating.style.zIndex = String(this.stickyHeader.zIndex);
            }

            const stickyTable = document.createElement('table');
            stickyTable.className = `${this.table.className} ${TINY_TABLE_CLASSES.stickyHeaderTable}`.trim();
            stickyTable.removeAttribute('id');
            floating.appendChild(stickyTable);
            document.body.appendChild(floating);

            this.stickyHeaderElement = floating;
            this.stickyHeaderTable = stickyTable;
            this.table.classList.add(TINY_TABLE_CLASSES.stickyHeaderActive);

            const schedule = () => {
                if (self._stickyHeaderRaf != null) return;
                self._stickyHeaderRaf = requestAnimationFrame(() => {
                    self._stickyHeaderRaf = null;
                    self._syncStickyHeaderGeometry();
                });
            };

            this._stickyHeaderSchedule = schedule;

            // The page itself may scroll through BODY in FXBase, while the
            // table wrapper handles horizontal scrolling. Listen to both,
            // without assuming which element owns the vertical scroll.
            window.addEventListener('scroll', schedule, { passive: true });
            document.addEventListener('scroll', schedule, { passive: true, capture: true });
            this.wrapper?.addEventListener('scroll', schedule, { passive: true });
            window.addEventListener('resize', schedule, { passive: true });

            if (typeof ResizeObserver !== 'undefined') {
                this._stickyResizeObserver = new ResizeObserver(() => {
                    self._syncStickyHeaderContent();
                    schedule();
                });
                this._stickyResizeObserver.observe(this.table);
                if (this.wrapper) this._stickyResizeObserver.observe(this.wrapper);
            }

            // Keep sorting usable from the floating copy. The real THEAD owns
            // all TinyDataTable event logic; the clone only forwards clicks.
            floating.addEventListener('click', event => {
                const cloneTh = event.target.closest?.('th');
                if (!cloneTh || !self.thead) return;

                // Checkbox changes are forwarded by the change handler below.
                if (event.target.closest?.('input[type="checkbox"]')) return;

                const cloneRow = cloneTh.parentElement;
                const index = cloneRow ? Array.prototype.indexOf.call(cloneRow.children, cloneTh) : -1;
                const originalTh = index >= 0 ? self.thead.querySelector('tr')?.children[index] : null;
                originalTh?.click();
            });

            floating.addEventListener('change', event => {
                const cloneCheckbox = event.target.closest?.('input[type="checkbox"][data-tt-select-all]');
                if (!cloneCheckbox) return;
                const originalCheckbox = self.thead?.querySelector('input[type="checkbox"][data-tt-select-all]');
                if (!originalCheckbox) return;
                originalCheckbox.checked = cloneCheckbox.checked;
                originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
            });

            this._syncStickyHeaderContent();
            schedule();
        }

        /**
         * Resolve the sticky top offset without coupling TinyDataTable to an
         * application toolbar. Explicit config wins; otherwise the value is
         * inherited from --tiny-table-sticky-top on the source table.
         *
         * @returns {string}
         * @private
         */
        _getStickyHeaderTop() {
            if (this.stickyHeader?.top != null && String(this.stickyHeader.top).trim() !== '') {
                return String(this.stickyHeader.top);
            }

            if (typeof getComputedStyle === 'function' && this.table) {
                const customValue = getComputedStyle(this.table)
                    .getPropertyValue('--tiny-table-sticky-top')
                    .trim();
                if (customValue) return customValue;
            }

            return '0px';
        }

        /**
         * Clone current header content and lock every cloned cell to the
         * rendered width of its source TH. This keeps the floating header
         * aligned with dynamically hidden/shown columns.
         *
         * @private
         */
        _syncStickyHeaderContent() {
            if (!this.stickyHeaderElement || !this.stickyHeaderTable || !this.thead) return;

            const clone = this.thead.cloneNode(true);
            clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            const sourceCells = Array.from(this.thead.querySelectorAll('tr:first-child > th'));
            const cloneCells = Array.from(clone.querySelectorAll('tr:first-child > th'));

            sourceCells.forEach((sourceTh, index) => {
                const cloneTh = cloneCells[index];
                if (!cloneTh) return;
                const width = sourceTh.getBoundingClientRect().width;
                if (width > 0) {
                    const px = `${width}px`;
                    cloneTh.style.width = px;
                    cloneTh.style.minWidth = px;
                    cloneTh.style.maxWidth = px;
                }
            });

            this.stickyHeaderTable.className = `${this.table.className} ${TINY_TABLE_CLASSES.stickyHeaderTable}`.trim();
            this.stickyHeaderTable.replaceChildren(clone);

            const tableWidth = this.table.getBoundingClientRect().width;
            if (tableWidth > 0) this.stickyHeaderTable.style.width = `${tableWidth}px`;
        }

        /**
         * Update fixed position/visibility of the floating header.
         * The header appears only after the real THEAD crosses the configured
         * top edge and disappears before the bottom of the table reaches it.
         *
         * @private
         */
        _syncStickyHeaderGeometry() {
            const floating = this.stickyHeaderElement;
            const stickyTable = this.stickyHeaderTable;
            if (!floating || !stickyTable || !this.thead || !this.table?.isConnected) return;

            floating.style.top = this._getStickyHeaderTop();

            // Reading the computed top lets callers use px/rem/calc()/CSS vars.
            const computedTop = parseFloat(getComputedStyle(floating).top) || 0;
            const sourceHeadRect = this.thead.getBoundingClientRect();
            const tableRect = this.table.getBoundingClientRect();
            const anchorRect = (this.wrapper || this.table).getBoundingClientRect();
            const headerHeight = sourceHeadRect.height;

            const shouldStick =
                headerHeight > 0 &&
                sourceHeadRect.top < computedTop &&
                tableRect.bottom > computedTop + headerHeight;

            if (!shouldStick) {
                floating.hidden = true;
                return;
            }

            const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
            const left = Math.max(0, anchorRect.left);
            const right = Math.min(viewportWidth, anchorRect.right);
            const visibleWidth = Math.max(0, right - left);

            if (visibleWidth <= 0) {
                floating.hidden = true;
                return;
            }

            floating.style.left = `${left}px`;
            floating.style.width = `${visibleWidth}px`;
            floating.style.height = `${headerHeight}px`;

            // getBoundingClientRect() already includes the wrapper horizontal
            // scroll offset, so positioning by the real table rect keeps the
            // clone perfectly aligned without TinyDataTable needing to know
            // the current scrollLeft value.
            stickyTable.style.left = `${tableRect.left - left}px`;
            stickyTable.style.width = `${tableRect.width}px`;

            floating.hidden = false;
        }

        normalizeColumn(col, syntheticPrefix, index='') {
            if (!col) return;
            const self = this;


            function parseTypeWithParams(type) {
                const str = String(type).trim();

                if (str.indexOf('(') === -1) return { name: str.toLowerCase(), params: [] };

                // match: name or name(...)
                const m = str.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/);
                if (!m) return null;

                const name = m[1].toLowerCase();
                const params = m[2]
                    ? m[2].split(',').map(p => {
                        const v = p.trim();
                        if (v === '') return undefined;
                        if (!isNaN(v)) return Number(v);
                        return v;
                    }) : [];

                return { name, params };
            }


            if (Array.isArray(col)) {
                col.forEach(function (c, index) {
                    self.normalizeColumn(c, syntheticPrefix, index);
                });
                return col;
            } else if (isObj(col)) {
                // 1) real key or synthetic key based on index
                if (col.key == null || col.key === '') {
                    col.key = '__' + (syntheticPrefix || 'col') + '_' + index;
                    col.isSyntheticKey = true;
                }

                if (!col.render && col.type && TinyDataTable.typeRenderers) {
                    const parsed = parseTypeWithParams(col.type);
                    const renderer = parsed && TinyDataTable.typeRenderers[parsed.name];

                    if (renderer) {
                        // If params exist, treat renderer as a factory
                        if (parsed.params && parsed.params.length) {
                            col.render = renderer.apply(null, parsed.params);
                        } else {
                            col.render = renderer;
                        }
                    }
                }

                return col;
            }
        }


        _bindSearchInput(inputEl) {
            const self = this;
            if (!inputEl) return;

            inputEl.value = this.state.searchText || '';

            const typingDelay = typeof self.searchConfig?.debounceMs === 'number' ? self.searchConfig.debounceMs : 150;

            let pendingSearch = null;
            const applySearch = () => {
                clearTimeout(pendingSearch);
                pendingSearch = null;
                // Read the current value, not an event captured before clearing.
                if (self.state.searchText !== inputEl.value) self.search(inputEl.value);
            };

            inputEl.addEventListener('input', () => {
                clearTimeout(pendingSearch);
                pendingSearch = null;
                if (!inputEl.value.trim() || typingDelay <= 0) {
                    applySearch(); // Clear all filters and marks immediately.
                } else {
                    pendingSearch = setTimeout(applySearch, typingDelay);
                }
            });
            // The native X on type="search" can dispatch `search` without `input`.
            inputEl.addEventListener('search', applySearch);

            this.searchInput = inputEl;
        }

        // -----------------------------
        // Controls bar: orchestrator + components
        // -----------------------------
        _initControlsBar() {
            const parentForControls = this.container;
            const anchorForControls = this.wrapper || this.table;

            if (!parentForControls || !anchorForControls) return;

            // Build components (each returns { el, order, align } or null)
            const components = [
                this._buildFiltersComponent(),
                this._buildSearchComponent(),
                this._buildButtonsComponent()
            ].filter(Boolean);

            // If no components to render, nothing to do
            if (!components.length) return;

            // Create controls bar only if there is at least one component
            const controls = _dtCreateElement('div', TINY_TABLE_CLASSES.controls);
            this.controlsContainer = controls;

            // Sort by order then append
            components
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .forEach(c => {
                    // Optional: apply alignment class now (no-op if you don’t use it yet)
                    if (c.align) {
                        // Example: tt-pos-left / tt-pos-center / tt-pos-right
                        controls.classList.add('tt-controls-has-align'); // optional marker
                        _dtAddClass(c.el, 'tt-pos-' + String(c.align).toLowerCase());
                    }

                    controls.appendChild(c.el);
                });

            parentForControls.insertBefore(controls, anchorForControls);

            this._initTooltipsInScope(this.controlsContainer); /// ?? why here
        }

        /**
         * Create a switch (checkbox) UI element.
         *
         * @param {Object} params
         * @param {boolean} params.checked - Initial checked state
         * @param {Function} params.onChange - Callback when value changes
         * @param {string} [params.label] - Optional text label
         * @param {string} [params.className] - Optional wrapper class
         * @returns {HTMLElement}
         */
        _createSwitchElement({ checked = false, onChange = null, label = null, className = null, tooltip = null, id = null } = {}) {
            const switchLabel = _dtCreateElement('label', 'tt-switch');
            const input = _dtCreateElement('input', { type: 'checkbox', checked, id : id});
            switchLabel.appendChild(input);
            switchLabel.appendChild(_dtCreateElement('span', 'lever'));
            if (isFn(onChange)) input.addEventListener('change', onChange);
            if (!label) return switchLabel;
            const wrapper = _dtCreateElement('label', className || 'tt-switch-wrapper');
            if (tooltip) wrapper.setAttribute('data-tooltip', tooltip);
            wrapper.appendChild(_dtCreateElement('span', 'tt-switch-text', { text : label}));
            wrapper.appendChild(switchLabel);
            return wrapper;
        }
        /**
         * Component interface:
         * {
         *   key: 'filters'|'search'|'buttons',
         *   el: HTMLElement,
         *   order: number,
         *   align: 'left'|'center'|'right'|undefined
         * }
         */

        // -----------------------------
        // Filters component
        // -----------------------------
        _buildFiltersComponent() {
            const self = this;

            this._filterControls = Object.create(null);

            const hasFiltersUI =
                this.filters &&
                this.filters.enabled &&
                Array.isArray(this.filters.items) &&
                this.filters.items.length > 0;

            if (!hasFiltersUI) return null;

            const filtersEl = _dtCreateElement('div', TINY_TABLE_CLASSES.filters);

            this.filters.items.forEach(function (def) {
                if (!def || !def.key) return;

                const item = _dtCreateElement('div', TINY_TABLE_CLASSES.filterItem, {
                    class: self.customClass?.filterItem
                });

                let labelEl = null;

                if (def.label) {
                    labelEl = _dtCreateElement('label', { text : String(def.label)});
                    item.appendChild(labelEl);
                }

                if (def.tooltip) {
                    item.setAttribute('data-tooltip', String(def.tooltip));
                }

                let controlNode;

                // NOTE: your demo uses type: 'boolean' but your current code checks 'bool'
                const isBoolean = def.type === 'bool';

                if (isBoolean) {
                    const checked = !!self.state.filters?.[def.key];
                    const onChange = function () {
                        self.setFilter(def.key, !!this.checked);
                    };
                    controlNode = self._createSwitchElement({checked, label: null, onChange});
                    /*
                    const switchLabel = _dtCreateElement('label', 'tt-switch');

                    const input = _dtCreateElement('input', { type: 'checkbox', checked : !!(self.state.filters && self.state.filters[def.key])});
                    switchLabel.appendChild(input);

                    const lever = _dtCreateElement('span', 'lever');
                    switchLabel.appendChild(lever);

                    input.addEventListener('change', function () {
                        if (!self.state.filters) self.state.filters = {};
                        self.state.filters[def.key] = !!this.checked;
                        self.state.page = 1;
                        self.draw();
                    });

                    controlNode = switchLabel;
                    */
                } else {
                    const opts = def.options || [];
                    const isMultiple = def.multiple === true && opts.length > 1;

                    const currentValue = self.state.filters?.[def.key] ?? (isMultiple ? [] : '');

                    const onFilterChange = function () {
                        let value = this.value;

                        // Native <select multiple> fallback.
                        if (isMultiple && !Array.isArray(value)) {
                            value = Array.from(this.selectedOptions || [], option => option.value);
                        }

                        self.setFilter(def.key, isMultiple ? value : (value === '' ? null : value));
                    };
                    controlNode = TinyDataTable.buildSelect(opts, currentValue, onFilterChange, { multiple: isMultiple, icon : def.icon });
                    _dtAddClass(controlNode, self.customClass?.select);
                }

                if (def.id) controlNode.id = def.id;
                if (def.name) controlNode.name = def.name;
                if (labelEl && controlNode.id) labelEl.htmlFor = controlNode.id;

                // Keep the control so API calls can synchronize the UI later.
                self._filterControls[def.key] = controlNode;

                item.appendChild(controlNode);
                filtersEl.appendChild(item);
            });

            return {
                key: 'filters',
                el: filtersEl,
                // temporary defaults (you’ll tune later when you do ordering/alignment)
                order: (isNbr(this.filters.order)) ? this.filters.order : 2,
                align: this.filters.align // optional (left|center|right)
            };
        }


        // -----------------------------
        // Search component
        // -----------------------------
        _buildSearchComponent() {
            const cfg = this.searchConfig;
            if (!cfg || !cfg.enabled) return null;

            const sel = cfg.selector;

            // External input is used ONLY when selector is a non-empty string.
            const hasExternalSelector = (isStr(sel) && sel.trim() !== '');

            // Case B: external search selector (no component in controls bar, just bind)
            if (hasExternalSelector) {
                const inputEl = document.querySelector(sel);
                if (!inputEl) {
                    console.warn('TinyDataTable: search.selector input not found:', sel);
                } else {
                    this._bindSearchInput(inputEl);
                }
                return null;
            }

            // Case A: internal search UI (default, including selector === '' or undefined)
            const searchEl = _dtCreateElement('div', TINY_TABLE_CLASSES.search);

            const hasLabel = !isBlank(cfg.label);

            const tableId = this.table && this.table.id ? this.table.id : '';
            const inputId = tableId ? (tableId + '-search') : null;

            if (hasLabel) {
                const labelAttrs = { text: cfg.label };
                if (inputId) labelAttrs.for = inputId;

                const labelEl = _dtCreateElement('label', TINY_TABLE_CLASSES.searchLabel, labelAttrs);
                searchEl.appendChild(labelEl);
            }

            const inputEl = _dtCreateElement('input', TINY_TABLE_CLASSES.searchInput, {
                type: 'search',
                placeholder: cfg.placeholder || '',
                value: this.state.searchText || '',
                class: this.customClass?.searchInput
            });

            if (hasLabel && inputId) inputEl.id = inputId;

            this._bindSearchInput(inputEl);

            searchEl.appendChild(inputEl);

            return {
                key: 'search',
                el: searchEl,
                order: (isNbr(cfg.order)) ? cfg.order : 1,
                align: cfg.align
            };
        }

        // -----------------------------
        // Buttons component
        // -----------------------------
        _buildButtonsComponent() {
            const self = this;
            // Recommended: allow buttons to be either array OR { items, order, align }
            const raw = this.options.buttons;

            const defs = Array.isArray(raw) ? raw : (isObj(raw) && Array.isArray(raw.items)) ? raw.items : [];

            if (!defs.length) return null;

            // Refactor your existing _renderControlButtons logic into a builder that RETURNS the element.
            // Here is the expected pattern:

            const actionsEl = _dtCreateElement('div', TINY_TABLE_CLASSES.controlsActions);

            defs.forEach((def, i) => {

                if (!def) return;

                // Divider
                if (def.divider) {
                    actionsEl.appendChild(_dtCreateElement('span', 'tt-btn-divider'));
                    return;
                }

                // Allow raw Node insertion
                if (def instanceof Node) {
                    actionsEl.appendChild(def);
                    return;
                }

                // Allow HTML-only
                if (def.html && isStr(def.html)) {
                    const wrap = _dtCreateElement('span', 'tt-btn-html', { html : def.html});
                    actionsEl.appendChild(wrap);
                    return;
                }

                // Click behavior
                const type = def.type?.toLowerCase();
                const tooltip = isStr(def.tooltip) ? def.tooltip.trim() : null;


                if (type === 'switch') {
                    const switchElement = self._createSwitchElement({
                        checked : !!def.checked,
                        label: def.label || def.text,
                        className: def.className,
                        tooltip,
                        id : def.id,
                        onChange: isFn(def.onChange) ? (e) => {
                            def.onChange.call(self, e.target.checked, e.target);
                        } : null
                    });

                    actionsEl.appendChild(switchElement);
                    return;
                }

                const btn = _dtCreateElement('button', undefined, { type: 'button' });

                if (def.id) btn.id = def.id;
                if (def.name) btn.name = def.name;
                if (def.title) btn.title = String(def.title);
                if (def.className) _dtAddClass(btn, def.className);

                // Disabled: bool or function
                const disabled = isFn(def.disabled) ? !!def.disabled(this.api()) : !!def.disabled;
                if (disabled) btn.disabled = true;

                const icon = isStr(def.icon) ? def.icon.trim() : '';
                const html = isStr(def.html) ? def.html.trim() : '';
                const text = isStr(def.text) ? escapeHtml(def.text.trim()) : '';
                const isBtnIcon = icon && !html && !text;

                btn.classList.add(isBtnIcon ? 'tt-btn-icon' : 'tt-btn');
                // icon-only case → HTML + special class
                if (isBtnIcon) {
                    btn.innerHTML = icon;
                }  else if (html) {
                    btn.innerHTML = [icon, html].filter(Boolean).join(' ');
                } else {  // text content (safe)
                    btn.textContent = [icon, text].filter(Boolean).join(' ');
                }

                if (tooltip) {
                    btn.setAttribute('data-tooltip', tooltip);   // for custom tooltip styling
                }


                if (type === 'export') {
                    if (Array.isArray(def.format) && def.format.length) {
                        // Create unique menu ID (to avoid conflicts if multiple export buttons)
                        const id = Math.random().toString(36).slice(2);
                        const menuId = `exportMenu_${id}`;

                        // Assign id to btn if missing (to use as triggerSelector)
                        if (!btn.id) btn.id = `exportButton_${id}`;
                        btn.classList.add('tt-dropdown-button');

                        // Create the popup menu <ul>
                        const menu = _dtCreateElement('ul','tt-dropdown',{id : menuId});

                        // Create <li> for each format in def.format array
                        def.format.forEach(fmt => {
                            const defaultLabel = `Export as ${fmt.toUpperCase()}`;
                            // Use label function from def, or from default config, or fallback to generic
                            const labelFn =
                                isFn(def?.label) ||
                                TinyDataTable.defaults?.texts?.exportButton?.label ||
                                (f => defaultLabel);
                            let label = labelFn(fmt);
                            // Defensive: ensure label is a non-empty string
                            label = isStr(label) && label.trim() ? label : defaultLabel;
                            menu.appendChild(_dtCreateElement('li','item',{ 'data-format' : fmt, text: label}));
                        });

                        // Append menu to DOM, for example right after actionsEl or body
                        actionsEl.appendChild(menu);

                        // Instantiate Popup class with the created menu
                        new Popup(menu, {
                            triggerSelector: btn, // We'll assign id to btn if missing below
                            onClick: (e, dataset) => {
                                self.exportTo(dataset.format || 'xlsx', def.sheetname, def.filename);
                            }
                        });
                    }
                    else {
                        def.onClick = (api,ev,def) => {
                            self.exportTo(def.format || 'xlsx', def.sheetname, def.filename);
                        }
                    }
                }
                if (type === 'refresh') {
                    def.onClick = api => api.refresh();
                } else if (type === 'reset-filters') {
                    def.onClick = api => api.resetFilters({
                        toDefaults: def.toDefaults !== false
                    });
                }

                if (isFn(def.onClick)) {
                    btn.addEventListener('click', ev => def.onClick(self.api(), ev, def));
                }

                actionsEl.appendChild(btn);
            });

            if (!actionsEl) return null;

            // Keep reference like before (if you used it)
            this.controlsActions = actionsEl;

            // Layout metadata (optional)
            const order = (!Array.isArray(raw) && raw && isNbr(raw.order)) ? raw.order : 3;
            const align = (!Array.isArray(raw) && raw && raw.align) ? raw.align : undefined;

            return {
                key: 'buttons',
                el: actionsEl,
                order: order,
                align: align
            };
        }

        _applyColumnStylePropsToEl(col, el, props = COL_STYLE_PROPS) {
            props.forEach((p) => {
                const v = col[p];
                if (v == null || v === '') return;

                const jsProp = p.includes('-')
                    ? p.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
                    : p;

                try {
                    el.style[jsProp] = String(v);
                } catch (e) {
                    // ignore invalid style assignment
                }
            });
        }

        /**
         * Redraw the THEAD row from this.columns.
         * Does NOT create or append <thead>; it only replaces its internal <tr>.
         *
         * @param {HTMLElement[]} existingHeaderCells
         * @returns {HTMLTableRowElement|null}
         */
        drawHeader(existingHeaderCells = []) {
            if (!this.thead) return null;

            const self = this;
            const headerRow = _dtCreateElement('tr');

            // Optional selection header cell
            if (this.select.enabled) {
                const selTh = _dtCreateElement('th', TINY_TABLE_CLASSES.selectHeaderCell);
                const cb = this._createCheckbox(selTh);
                cb.dataset.ttSelectAll = '1';
                headerRow.appendChild(selTh);
                this._headerSelectCheckbox = cb;
            }

            function initHeaderCell(col, index) {
                if (col.visible === false) return;

                self.normalizeColumn(col, 'col', index);

                const existingTh = existingHeaderCells[index];
                const th = existingTh || _dtCreateElement('th');

                if (existingTh) {
                    // reset reused TH state before reapplying
                    th.innerHTML = '';
                    th.className = '';
                    th.removeAttribute('data-tooltip');
                    delete th.dataset.key;
                }

                const hasDomTitle = !!(existingTh && (existingTh.innerHTML.trim() || existingTh.textContent.trim()));

                if (hasDomTitle) {
                    col.title = existingTh.textContent.trim();
                    th.innerHTML = existingTh.innerHTML;
                } else if (col.title) {
                    th.textContent = col.title;
                } else if (col.html) {
                    th.innerHTML = col.html;
                }

                if (col.key) th.dataset.key = col.key;

                if (!isBlank(col.className)) {
                    col.className = tokenize_str(col.className);
                    _dtAddClass(th, col.className);
                }

                if (col.sortable !== false) th.classList.add('tt-sortable');

                if (col.headerTooltip) {
                    th.setAttribute('data-tooltip', String(col.headerTooltip));
                }

                self._applyColumnStylePropsToEl(col, th, COL_STYLE_PROPS);

                headerRow.appendChild(th);
                return th;
            }

            this.columns.forEach(initHeaderCell);

            this.thead.replaceChildren(headerRow);

            // static header tooltips
            this._initTooltipsInScope(this.thead);

            return headerRow;
        }

        /**
         * Redraw the TFOOT row from this.columns.
         * Creates nothing if footer is disabled.
         *
         * @returns {HTMLTableRowElement|null}
         */
        drawFooter() {
            if (!this.footer?.enabled || !this.tfoot) {
                this.footerRow = null;
                return null;
            }

            this.footerRow = _dtCreateElement('tr');

            // Selection column footer cell (empty)
            if (this.select.enabled) {
                this.footerRow.appendChild(_dtCreateElement('th'));
            }

            this.columns.forEach(col => {
                if (col.visible === false) return;
                const th = _dtCreateElement('th', { 'data-key': col.key });
                _dtAddClass(th, col.className);
                _dtAddClass(th, col.footerClassName);
                this.footerRow.appendChild(th);
            });

            this.tfoot.replaceChildren(this.footerRow);

            return this.footerRow;
        }

        /**
         * Merge configured columns with existing DOM header cells.
         * - If there are more THs than columns, synthesize missing columns from DOM.
         * - If there are more columns than THs, keep configured columns and missing THs will be created later.
         *
         * @param {HTMLElement[]} existingHeaderCells
         * @returns {Array<Object>}
         */
        _mergeColumnsWithHeaderCells(existingHeaderCells = []) {
            var maxLen = Math.max(this.columns.length, existingHeaderCells.length);
            var mergedColumns = [];

            for (var i = 0; i < maxLen; i++) {
                var originalCol = this.columns[i];
                var col = originalCol || {};
                var th = existingHeaderCells[i] || null;

                // Derive a key
                if (!col.key) {
                    col.key = col.data || th?.dataset.key;
                    if (!col.key) {
                        col.sortable = false;
                        col.searchable = false;
                    }
                }

                // Columns coming purely from DOM (no original definition)
                if (!originalCol) {
                    if (th && !col.title) {
                        col.title = th.textContent.trim();
                    }
                    if (th && !col.className && th.className) {
                        col.className = th.className;
                    }
                }

                mergedColumns[i] = col;
            }

            return mergedColumns;
        }

        /**
         * Initialize pager UI if paging is enabled.
         */
        _initPager() {

            const showPager = !!this.paging.enabled;
            const showInfoOnly = !showPager && !!this.paging.showInfo;

            if (!showPager && !showInfoOnly) {
                this.pagerContainer = null;
                this.pager = null;
                return;
            }

            var self = this;

            var pagerContainer = _dtCreateElement('div', TINY_TABLE_CLASSES.pager, {
                class: this.customClass?.pager
            });

            this.pagerContainer = pagerContainer;

            var anchorForPager = this.wrapper || this.table;
            var parentForPager = anchorForPager ? anchorForPager.parentNode : null;

            if (parentForPager && anchorForPager && anchorForPager.parentNode === parentForPager) {
                parentForPager.insertBefore(pagerContainer, anchorForPager.nextSibling);
            }

            const getState = function () {
                const page = self.state.page;
                const pageSize = showPager ? self.state.pageSize : -1;
                const totalRows = isNbr(self.state.totalRows) ? self.state.totalRows : 0;
                const start = showPager ? (totalRows === 0 ? 0 : (page - 1) * pageSize + 1) : 1;
                const end = showPager ? (totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows)) : totalRows;
                const totalPages = showPager ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
                return { page, pageSize, totalRows, totalPages, start, end };
            }

            this.pager = new Pager(
                this,
                pagerContainer,
                getState,
                function (newPage) {
                    self.goToPage(newPage);
                },
                function (newPageSize) {
                    var newSize = parseInt(newPageSize, 10);
                    var oldSize = self.state.pageSize;
                    if (newSize === oldSize) return;

                    self.state.pageSize = newSize;
                    self.state.page = 1;
                    self._emit('length', {
                        pageSize: newPageSize,
                        oldPageSize: oldSize
                    });
                    self.draw();
                },
                this.paging.pageSizeOptions,
                showInfoOnly
            );
        }

        /**
         * Bind THEAD / TBODY structural listeners.
         */
        _bindStructureEvents() {
            var self = this;

            // Header sort click (delegated)
            _addEventListener(this.thead, 'click', 'th', function (e, th) {
                // Ignore clicks on header select-all checkbox
                if (th.querySelector('input[type="checkbox"][data-tt-select-all]')) return;

                const key = th.dataset.key;
                if (!key) return;

                var col = self.columns.find(function (c) {
                    return c.key === key;
                });
                if (!col || col.sortable === false) return;

                // Shift+click => multi-sort append/promote. Normal click => single-sort.
                self.sortBy(key, { append: !!(e && e.shiftKey) });
            });

            // Header selection change (select all)
            this.thead.addEventListener('change', function (e) {
                var target = e.target;
                if (!target || target.type !== 'checkbox' || target.dataset.ttSelectAll !== '1') return;
                self._handleHeaderSelectAll(target.checked);
            });

            // Body click: toggle icon and optional row toggle
            if (this.childRows.enabled) {
                _addEventListener(this.tbody, 'click', `tr.${TINY_TABLE_CLASSES.rowHasChildren}`, function (e, tr) {
                    if (self.childRows.toggleOnRowClick && this.dataset.rowKey) {
                        const inTd = e.target.nodeName === 'TD';
                        const inToggleLink = !!e.target.closest?.('a[data-tt-toggle]');

                        if (inTd || inToggleLink) {
                            self.toggleChildRows(this.dataset.rowKey);
                            return;
                        }
                    }

                    return false;
                });
            }

            // Body selection change for row checkboxes (delegated)
            if (this.select.enabled) {
                _addEventListener(this.tbody, 'change', 'input[type="checkbox"][data-tt-select="row"]', function (e, checkbox) {
                    var tr = this.closest('tr');
                    if (tr && tr.dataset.rowKey) {
                        self._handleRowCheckboxChange(tr.dataset.rowKey, this.checked, tr);
                    }
                });
            }

            this._initRowActionDelegation();
        }

        _initStructure() {
            // Remove any old TBODY / TFOOT (we will recreate them)
            var oldTbody = this.table.querySelector('tbody');
            if (oldTbody?.parentNode === this.table) this.table.removeChild(oldTbody);

            var oldTfoot = this.table.querySelector('tfoot');
            if (oldTfoot?.parentNode === this.table) this.table.removeChild(oldTfoot);

            // Preserve existing THEAD/TH if present
            var existingThead = this.table.querySelector('thead');
            var existingHeaderRow = existingThead && existingThead.querySelector('tr');
            var existingHeaderCells = [];

            if (existingHeaderRow) {
                existingHeaderCells = Array.prototype.filter.call(existingHeaderRow.children, el => el.tagName === 'TH');
            }

            // THEAD
            this.thead = existingThead || _dtCreateElement('thead');
            if (!existingThead) this.table.appendChild(this.thead);

            // Merge column definitions with DOM header cells
            this.columns = this._mergeColumnsWithHeaderCells(existingHeaderCells);

            // Draw THEAD row from columns
            this.drawHeader(existingHeaderCells);

            // TBODY
            this.tbody = _dtCreateElement('tbody');
            this.table.appendChild(this.tbody);

            // TFOOT
            if (this.footer.enabled) {
                this.tfoot = _dtCreateElement('tfoot');
                this.table.appendChild(this.tfoot);
                this.drawFooter();
            }

            // Build optional toolbar controls
            this._initControlsBar();

            // Pager
            this._initPager();

            // Bind structure events
            this._bindStructureEvents();
        }

/*        _initStructure2() {
            var self = this;

            // Remove any old TBODY / TFOOT (we will recreate them)
            var oldTbody = this.table.querySelector('tbody');
            if (oldTbody && oldTbody.parentNode === this.table) {
                this.table.removeChild(oldTbody);
            }
            var oldTfoot = this.table.querySelector('tfoot');
            if (oldTfoot && oldTfoot.parentNode === this.table) {
                this.table.removeChild(oldTfoot);
            }

            // Preserve existing THEAD/TH if present; only remove TBODY/TFOOT
            var existingThead = this.table.querySelector('thead');
            var existingHeaderRow = existingThead && existingThead.querySelector('tr');

            // THEAD and header row
            var thead = existingThead || _dtCreateElement('thead');
            this.thead = thead;
            if (!existingThead) {
                this.table.appendChild(thead);
            }

            var headerRow = existingHeaderRow || _dtCreateElement('tr');
            var existingHeaderCells = [];
            if (!existingHeaderRow) {
                thead.appendChild(headerRow);
            } else {
                existingHeaderCells = Array.prototype.filter.call(headerRow.children, el=> el.tagName?.toLowerCase() === 'th');
            }

            // Optional selection header cell
            if (this.select.enabled) {
                var selTh = _dtCreateElement('th', TINY_TABLE_CLASSES.selectHeaderCell);

                var cb = self._createCheckbox(selTh);
                cb.dataset.ttSelectAll = '1';

                headerRow.appendChild(selTh);
                this._headerSelectCheckbox = cb;
            }

            // Merge column definitions with DOM <th> headers.
            // If there are more THs than columns, we synthesize extra columns.
            // If there are more columns than THs, we create missing THs.
            var maxLen = Math.max(this.columns.length, existingHeaderCells.length);
            var mergedColumns = [];
            for (var i = 0; i < maxLen; i++) {
                var originalCol = this.columns[i];
                var col = originalCol || {};
                var th = existingHeaderCells[i] || null;

                // Derive a key
                if (!col.key) {
                    col.key = col.data || th?.dataset.key;
                    if (!col.key) {
                        col.sortable = false;
                        col.searchable = false;
                    }
                }

                // Columns coming purely from DOM (no original definition)
                if (!originalCol) {
                    if (th && !col.title) {
                        col.title = th.textContent.trim();
                    }
                    if (th && !col.className && th.className) {
                        col.className = th.className;
                    }
                }

                mergedColumns[i] = col;
            }
            this.columns = mergedColumns;

            function _applyColumnStylePropsToEl(col, el, props) {
                props.forEach((p) => {
                    const v = col[p];
                    if (v == null || v === '') return;
                    // allow both camelCase and kebab-case in the whitelist
                    const jsProp = p.includes('-') ? p.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : p;
                    try {
                        el.style[jsProp] = String(v);
                    } catch (e) {
                        // ignore invalid style assignment
                    }
                });
            }

            function initHeaderCell(col, index) {
                if (col.visible === false) return;
                self.normalizeColumn(col, 'col', index);

                const existingTh = existingHeaderCells[index];
                const th = existingTh || _dtCreateElement('th');

                const hasDomTitle = !!(existingTh && (th.innerHTML.trim() || th.textContent.trim()));
                if (hasDomTitle) {
                    col.title = th.textContent.trim();
                } else if (col.title) {
                    th.textContent = col.title;
                } else if (col.html) {
                    th.innerHTML = col.html;
                }

                if (col.key) th.dataset.key = col.key;

                if (!isBlank(col.className)) {
                    col.className = tokenize_str(col.className);
                    _dtAddClass(th, col.className);
                }

                if (col.sortable !== false) th.classList.add('tt-sortable'); //'cursor = 'pointer'

                if (col.headerTooltip) th.setAttribute('data-tooltip', String(col.headerTooltip));

                // Apply column style props to the TH (no mutation of col)
                _applyColumnStylePropsToEl(col, th, COL_STYLE_PROPS);

                if (!existingTh) headerRow.appendChild(th);

                return th;
            }

            this.columns.forEach(initHeaderCell);

            thead.appendChild(headerRow);
            this.table.appendChild(thead);

            this.tbody = _dtCreateElement('tbody');
            this.table.appendChild(this.tbody);

            if (this.footer.enabled) {
                var tfoot = _dtCreateElement('tfoot');
                this.tfoot = tfoot;
                this.table.appendChild(tfoot);


                const footerRow = _dtCreateElement('tr');
                this.footerRow = footerRow;

                // Selection column footer cell (empty)
                if (this.select.enabled) {
                    var selFoot = _dtCreateElement('th');
                    footerRow.appendChild(selFoot);
                }

                this.columns.forEach(function (col) {
                    if (col.visible === false) return;
                    var th = _dtCreateElement('th', { 'data-key' : col.key});
                    if (Array.isArray(col.className) && col.className.length > 0) {
                        _dtAddClass(th, col.className);
                    }
                    footerRow.appendChild(th);
                });

                this.tfoot.appendChild(footerRow);
            }

            // Build optional toolbar controls (filters + search + buttons)
            this._initControlsBar();
            /!*
            // Build optional toolbar controls (filters bar and search input).
            var parentForControls = this.container || this.table.parentNode;
            var anchorForControls = this.wrapper || this.table;
            var hasFiltersUI = this.filters && this.filters.enabled &&
                Array.isArray(this.filters.items) && this.filters.items.length > 0;
            var hasSearchUI = this.searchConfig && this.searchConfig.enabled && this.searchConfig.selector!== '';

            if (parentForControls && (hasFiltersUI || hasSearchUI)) {
                var controls = _dtCreateElement('div', TINY_TABLE_CLASSES.controls);
                this.controlsContainer = controls;
                var self = this;

                // Filters bar
                if (hasFiltersUI) {
                    const filtersEl = _dtCreateElement('div', TINY_TABLE_CLASSES.filters);

                    // If there is NO search input, align filters to the right
                    //if (!hasSearchUI) {
                    //    filtersEl.classList.add('align-right');
                    //}

                    this.filters.items.forEach(function (def) {
                        if (!def || !def.key) return;

                        var item = _dtCreateElement('div', TINY_TABLE_CLASSES.filterItem, { class : self.customClass?.filterItem});
                        var labelEl = null;

                        if (def.label) {
                            labelEl = _dtCreateElement('label');
                            labelEl.textContent = String(def.label);
                            item.appendChild(labelEl);
                        }
                        if (def.tooltip) {
                            item.setAttribute("data-tooltip", String(def.tooltip));
                        }

                        let controlNode; // what we finally append to the item

                        if (def.type === 'bool') {
                            const switchLabel = _dtCreateElement('label', 'tt-switch');

                            const input = _dtCreateElement('input', { type : 'checkbox'});
                            input.checked = !!(self.state.filters && self.state.filters[def.key]);
                            switchLabel.appendChild(input);
                            const lever = _dtCreateElement('span', 'lever');
                            switchLabel.appendChild(lever);

                            input.addEventListener('change', function () {
                                if (!self.state.filters) self.state.filters = {};
                                self.state.filters[def.key] = !!this.checked;
                                self.state.page = 1;
                                self.draw();
                            });

                            // For this branch, the control to append is the whole switch label
                            controlNode = switchLabel;

                        } else {
                            // Default: <select> combobox with provided options
                            const opts = def.options || [];
                            const currentValue = (self.state.filters && self.state.filters[def.key] != null) ? String(self.state.filters[def.key]) : '';

                            const onFilterChange = function (e) {
                                var v = this.value;
                                if (!self.state.filters) self.state.filters = {};
                                self.state.filters[def.key] = (v === '' ? null : v);
                                self.state.page = 1;
                                self.draw();
                            }

                            controlNode = TinyDataTable.buildSelect(opts, currentValue, onFilterChange);
                            _dtAddClass(controlNode, self.customClass?.select);
                        }

                        if (def.id) controlNode.id = def.id;
                        if (def.name) controlNode.name = def.name;
                        if (labelEl && controlNode.id) {
                            labelEl.htmlFor = controlNode.id;
                        }

                        item.appendChild(controlNode);
                        filtersEl.appendChild(item);
                    });

                    controls.appendChild(filtersEl);
                }


                // Search input
                if (hasSearchUI) {
                    var searchEl = _dtCreateElement('div', TINY_TABLE_CLASSES.search);

                    var hasLabel = !isBlank(this.searchConfig?.label);
                    var inputId = this.id + '-search';

                    // Optional label
                    if (hasLabel) {
                        var labelEl = _dtCreateElement(
                            'label',
                            TINY_TABLE_CLASSES.searchLabel,
                            { text: this.searchConfig.label, for: inputId }
                        );
                        searchEl.appendChild(labelEl);
                    }

                    var inputEl = _dtCreateElement('input', TINY_TABLE_CLASSES.searchInput);
                    inputEl.type = 'search';
                    inputEl.placeholder = this.searchConfig.placeholder || '';
                    inputEl.value = this.state.searchText || '';

                    if (hasLabel) {
                        inputEl.id = inputId;
                    }

                    this._bindSearchInput(inputEl);

                    searchEl.appendChild(inputEl);
                    controls.appendChild(searchEl);
                }

                else if (this.searchConfig.selector) {
                    const inputEl = document.querySelector(this.searchConfig.selector);
                    if (!inputEl) {
                        console.warn('TinyDataTable: search.selector input not found:', this.searchConfig.selector);
                    } else {
                        this._bindSearchInput(inputEl);
                    }
                }

                parentForControls.insertBefore(controls, anchorForControls);

                // After filters/search are appended, or before—your choice.
                // Usually: render buttons at the end so they appear on the right.
                this._renderControlButtons(controls);

                // Initialize tooltips for static UI
                this._initTooltipsInScope(this.controlsContainer); /// ?? why here

             *!/

            if (this.paging.enabled) {
                var pagerContainer = _dtCreateElement('div', TINY_TABLE_CLASSES.pager, { class : this.customClass?.pager});

                this.pagerContainer = pagerContainer;

                var parentForPager = this.container || this.table.parentNode;
                var anchorForPager = this.wrapper || this.table;

                if (parentForPager && anchorForPager) {
                    parentForPager.insertBefore(pagerContainer, anchorForPager.nextSibling);
                }

                this.pager = new Pager(
                    this,
                    pagerContainer,
                    function () {
                        const page = self.state.page;
                        const pageSize = self.state.pageSize;
                        const totalRows= isNbr(self.state.totalRows) ? self.state.totalRows : 0;
                        const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
                        const end = totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows);
                        const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
                        return { page, pageSize, totalRows, totalPages, start, end };
                    },
                    function (newPage) {
                        self.goToPage(newPage);
                    },
                    function (newPageSize) {
                        var newSize = parseInt(newPageSize, 10);
                        var oldSize = self.state.pageSize;
                        if (newSize === oldSize) return;
                        self.state.pageSize = newSize;
                        self.state.page = 1;
                        self._emit('length', {
                            pageSize: newPageSize,
                            oldPageSize: oldSize
                        });
                        self.draw();
                    },
                    this.paging.pageSizeOptions
                );
            }

            // Header sort click (delegated)
            _addEventListener(this.thead, 'click', 'th', function (e, th) {
                // Ignore clicks on header select-all checkbox
                if (th.querySelector('input[type="checkbox"][data-tt-select-all]')) return;

                const key = th.dataset.key;
                if (!key) return;

                var col = self.columns.find(function (c) { return c.key === key; });
                if (!col || col.sortable === false) return;

                // Shift+click => multi-sort append/promote. Normal click => single-sort.
                self.sortBy(key, { append: !!(e && e.shiftKey) });
            });

            // Header selection change (select all)
            this.thead.addEventListener('change', function (e) {
                var target = e.target;
                if (!target || target.type !== 'checkbox' || target.dataset.ttSelectAll !== '1') return;
                self._handleHeaderSelectAll(target.checked);
            });

            // Body click: toggle icon and optional row toggle
            if (this.childRows.enabled) { //
                _addEventListener(this.tbody, 'click', `tr.${TINY_TABLE_CLASSES.rowHasChildren}`, function (e, tr) {
                    //if (e.target.matches('input[type="checkbox"][data-tt-select]')) return false;

                    // `this` === row
                    if (self.childRows.toggleOnRowClick && this.dataset.rowKey) {

                        const inTd = e.target.nodeName === 'TD';
                        const inToggleLink = !!e.target.closest?.('a[data-tt-toggle]');
                        if (inTd || inToggleLink) {
                            self.toggleChildRows(this.dataset.rowKey);
                            return;
                        }
                    }

                    return false;
                });
            }

            // Body selection change for row checkboxes (delegated)
            if (this.select.enabled) {
                _addEventListener(this.tbody, 'change', 'input[type="checkbox"][data-tt-select="row"]', function (e, checkbox) {
                    var tr = this.closest('tr');
                    if (tr && tr.dataset.rowKey) {
                        self._handleRowCheckboxChange(tr.dataset.rowKey, this.checked, tr);
                    }
                });
            }

            // Initialize tooltips for static UI
            this._initTooltipsInScope(this.thead);

            this._initRowActionDelegation();
        }*/

        _initRowActionDelegation() {
            var self = this; // table instance

            function onRowActionClick(e) {
                // e.currentTarget is the <a[data-action]>
                const a = e.currentTarget;
                const action = a.dataset.action;
                e.action = action;
                const tr = a.closest('tr');

                const payload = {
                    action,
                    dataset: { ...a.dataset },
                    rowKey: tr?.dataset?.rowKey ?? null,
                    id: a?.dataset.id ?? tr?.dataset?.id ?? null,
                    rowData: tr?._data ?? null,
                    rowEl: tr,
                    event: e,          // wrapper, but delegates to original event
                    originalEvent: Object.getPrototypeOf(e) // optional if you want access
                };

                const actionEvent = toCamelCase(action);
                self._emit('action', payload);
                self._emit(`action:${actionEvent}`, payload);

                // if you want to block navigation:
                // e.preventDefault();
            }

            // keep a remover if you ever need to unbind
            this._offRowActionDelegation = _addEventListener(this.tbody, 'click', 'td [data-action]', onRowActionClick);
        }

        /**
         * Render a single "empty" row when there is no data to display.
         * @param {number} visibleColCount Total number of visible columns
         *                                 (already includes selection column if enabled)
         * @returns {HTMLTableRowElement}
         */
        _renderEmptyBody(visibleColCount) {
            const tr = _dtCreateElement('tr');
            const td = _dtCreateElement('td', TINY_TABLE_CLASSES.emptyCell);
            if (visibleColCount > 0) td.colSpan = visibleColCount;
            td.textContent = this.emptyMessage || 'No data available';
            tr.appendChild(td);
            return tr;
        }

        /**
         * Render grouped rows into a DocumentFragment.
         * @param {Array} rows
         * @param {number} visibleColCount
         * @returns {DocumentFragment}
         * @private
         */

        _renderGroupedBodyFragment(rows, visibleColCount, autoExpand) {
            var self = this;

            var frag = document.createDocumentFragment();

            var gctx = this._buildGroupingCtx(rows);
            var groups = this._buildGroups(rows, gctx);
            var pageRowCounter = 0;
            var hasAnyChildrenOnPage = false;

            // Resolve visible column keys once (order matters)
            var visibleColumns = self._internals.visibleColumns || self.columns;

            var visibleColumnKeys = visibleColumns.map(c => c.key);

            // Cache mergeColumns resolver once (avoid typeof checks inside loop)
            var mergeColumnsOpt = (self.grouping && self.grouping.mergeColumns) || [];
            var mergeColumnsIsFn = isFn(mergeColumnsOpt);

            //var mergeColumnsFn = mergeColumnsIsFn ? mergeColumnsOpt : null;
            //var mergeColumnsStatic = mergeColumnsIsFn ? null : mergeColumnsOpt;

            // Optional micro-cache for static specs -> Set, to avoid rebuilding per group
            // (Only safe when mergeColumns is not a function.)
            var staticMergeSetCache = null;

            function resolveMergeColumns(spec) {
                var keys = new Set();

                if (!spec) return keys;

                var list = Array.isArray(spec) ? spec : [spec];

                list.forEach(function (item) {
                    // numeric index
                    if (isNbr(item)) {
                        var k = visibleColumnKeys[item];
                        if (k) keys.add(k);
                        return;
                    }

                    if (typeof item !== 'string') return;

                    // range syntax "start:end"
                    var m = item.match(/^(\d*)\s*:\s*(\d*)$/);
                    if (m) {
                        var start = (m[1] === '') ? 0 : parseInt(m[1], 10);
                        var end = (m[2] === '') ? (visibleColumnKeys.length - 1) : parseInt(m[2], 10);

                        if (isNaN(start) || isNaN(end)) return;

                        for (var i = start; i <= end; i++) {
                            var key = visibleColumnKeys[i];
                            if (key) keys.add(key);
                        }
                        return;
                    }

                    // column key
                    keys.add(item);
                });

                return keys;
            }

            // Pre-resolve static mergeColumns once (if not a function)
            if (!mergeColumnsIsFn) {
                staticMergeSetCache = resolveMergeColumns(mergeColumnsOpt);
            }

            groups.forEach(function (group, groupIndex) {

                var shouldShowHeader = !!(self.grouping.header && self.grouping.header.show);

                // Only real groups (more than 1 row) get headers.
                // This prevents "single rows" from ever producing a group header.
                if (shouldShowHeader && group.rows && group.rows.length > 1) {
                    var headerNode = self._renderGroupHeaderRow(group, groupIndex, visibleColCount, gctx);
                    if (headerNode) frag.appendChild(headerNode);
                }

                // Resolve mergeColumns PER GROUP only if mergeColumns is a function
                var mergeColsSet = mergeColumnsIsFn
                    ? resolveMergeColumns(mergeColumnsOpt({
                        keys: self.grouping.keys,
                        values: group.values,
                        rows: group.rows,
                        groupIndex: groupIndex,
                        groupKey: group.key,
                        gctx: gctx
                    }))
                    : staticMergeSetCache;

                if (isFn(self.grouping.skipRows) && self.grouping.skipRows({
                    rows: group.rows,
                    groupKey: group.key,
                    gctx: gctx
                })) return;

                group.rows.forEach(function (row, rowIndexInGroup) {

                    var rowKey = self._getRowKey(row, pageRowCounter, 'parent');
                    var hasChildren = self._hasChildRows(row);
                    var parentColumns = visibleColumns;
                    var childColumns = self._getChildColumnsForParent(row);
                    var isExpanded = self._expandedRowKeys.has(rowKey);

                    if (!self._pageGroupRowKeyMap[group.key]) {
                        self._pageGroupRowKeyMap[group.key] = [];
                    }
                    self._pageGroupRowKeyMap[group.key].push(rowKey);
                    self._pageParentRowKeys.push(rowKey);

                    var parentTr = self._renderDataRow(
                        row,
                        pageRowCounter,
                        rowKey,
                        false,
                        parentColumns,
                        {
                            hasChildren: hasChildren,
                            isExpanded: isExpanded,
                            mergeColumnsSet: mergeColsSet,
                            groupSize: group.rows.length,
                            rowIndexInGroup: rowIndexInGroup,
                            groupKey: group.key
                        }
                    );

                    parentTr.dataset.groupKey = group.key;

                    if (hasChildren) {
                        hasAnyChildrenOnPage = true;
                        parentTr.classList.add(TINY_TABLE_CLASSES.rowHasChildren);
                        if (autoExpand && !self._expandedRowKeys.has(rowKey)) {
                            self._expandedRowKeys.add(rowKey);
                        }
                    }

                    frag.appendChild(parentTr);
                    pageRowCounter++;

                    var children = hasChildren ? self._getChildrenForRow(row) : null;
                    var expanded = self._expandedRowKeys.has(rowKey);

                    if (children && children.length && expanded) {
                        children.forEach(function (childRow, childIndex) {
                            var childKey = self._getRowKey(
                                childRow,
                                childIndex,
                                'child-of-' + rowKey
                            );
                            var childTr = self._renderDataRow(
                                childRow,
                                childIndex,
                                childKey,
                                true,
                                childColumns,
                                {
                                    hasChildren: false,
                                    isExpanded: false,
                                    mergeColumnsSet: null,
                                    groupSize: 1,
                                    rowIndexInGroup: 0,
                                    groupKey: group.key
                                }
                            );
                            childTr.classList.add(TINY_TABLE_CLASSES.childRow);
                            childTr.dataset.parentKey = rowKey;
                            frag.appendChild(childTr);
                        });
                    }
                });
            });

            this.table.classList.toggle(TINY_TABLE_CLASSES.hasAnyChildren, hasAnyChildrenOnPage);

            return frag;
        }

        /**
         * Render non-grouped rows into a DocumentFragment.
         * @param {Array} rows
         * @returns {DocumentFragment}
         * @private
         */
        _renderFlatBodyFragment(rows, autoExpand) {
            var self = this;
            var frag = document.createDocumentFragment();
            var hasAnyChildrenOnPage = false;

            rows.forEach(function (row, rowIndexOnPage) {
                var rowKey = self._getRowKey(row, rowIndexOnPage, 'parent');
                var hasChildren = self._hasChildRows(row);
                var parentColumns = self._internals.visibleColumns || self.columns;
                var childColumns = self._getChildColumnsForParent(row);
                var isExpanded = self._expandedRowKeys.has(rowKey);

                self._pageParentRowKeys.push(rowKey);

                var parentTr = self._renderDataRow(
                    row,
                    rowIndexOnPage,
                    rowKey,
                    false,
                    parentColumns,
                    {
                        hasChildren: hasChildren,
                        isExpanded: autoExpand || isExpanded,
                        mergeColumnsSet: null,
                        groupSize: 1,
                        rowIndexInGroup: 0,
                        groupKey: null
                    }
                );

                if (hasChildren) {
                    hasAnyChildrenOnPage = true;
                    parentTr.classList.add(TINY_TABLE_CLASSES.rowHasChildren);
                    if (autoExpand && !self._expandedRowKeys.has(rowKey)) {
                        self._expandedRowKeys.add(rowKey);
                    }
                }

                frag.appendChild(parentTr);

                var children = hasChildren ? self._getChildrenForRow(row) : null;
                var expanded = self._expandedRowKeys.has(rowKey);

                if (children && children.length && expanded) {
                    children.forEach(function (childRow, childIndex) {
                        var childKey = self._getRowKey(
                            childRow,
                            childIndex,
                            'child-of-' + rowKey
                        );
                        var childTr = self._renderDataRow(
                            childRow,
                            childIndex,
                            childKey,
                            true,
                            childColumns,
                            {
                                hasChildren: false,
                                isExpanded: false,
                                mergeColumnsSet: null,
                                groupSize: 1,
                                rowIndexInGroup: 0,
                                groupKey: null
                            }
                        );
                        childTr.classList.add(TINY_TABLE_CLASSES.childRow);
                        childTr.dataset.parentKey = rowKey;
                        frag.appendChild(childTr);
                    });
                }
            });

            this.table.classList.toggle(TINY_TABLE_CLASSES.hasAnyChildren, hasAnyChildrenOnPage);

            return frag;
        }

        /**
         * Unfortunaly, the render(value) is not possible anymore
         */
        _renderValue(col, rawValue, row, index, phase, extraCtx) {
            // No renderer => raw value
            if (!col || typeof col.render !== "function") return rawValue;

            const _makeRenderCtx = (phase, col, row, rowIndex, extra) => {
                const ctx = {
                    phase: phase,
                    column: col,
                    rowKey: row ? row.key : null,
                    rowIndex: rowIndex,
                    isChild: false,
                    _esc: escapeHtml,
                    _html: html => ({ html: String(html) }),
                    _blank : isBlank
                }
                return Object.assign(ctx, extra || {});
            }

            // Build ctx once
            const ctx = _makeRenderCtx(phase || "value", col, row, index, extraCtx);

            // New API payload
            const payload = { value: rawValue, row: row, index: index, ctx: ctx };

            try {
                // If renderer declares <= 1 param, assume new API: render({ value, row, index, ctx })
                // Legacy API: render(value, row, index, ctx)
                return col.render.length <= 1 ? col.render.call(this, payload) : col.render.call(this, rawValue, row, index, ctx);
            } catch (e) {
                return rawValue;
            }
        }

        /**
         * Main body renderer – determines a single child (fragment or row),
         * then appends it once to a new fragment.
         * @param {Array} rows Page rows to render
         */
        _renderBody(rows) {
            var visibleColCount = this._internals.visibleColumnCount;
            var child;
            var isEmpty = !rows || rows.length === 0;

            this.table.classList.toggle(TINY_TABLE_CLASSES.empty, isEmpty);

            // Only auto-expand on the very first render (or after explicit reset)
            var autoExpand = this.childRows && this.childRows.enabled && this.childRows.startExpanded && !this._childRowsInitialized;

            if (rows && rows.length) {

                var hasGrouping = this._hasGrouping();

                // Reset per-page caches (used by selection + grouping)
                this._pageParentRowKeys = [];
                if (hasGrouping) {
                    this._pageGroupRowKeyMap = {};
                    child = this._renderGroupedBodyFragment(rows, visibleColCount, autoExpand); // DocumentFragment
                } else {
                    child = this._renderFlatBodyFragment(rows, autoExpand); // DocumentFragment
                }
            } else {
                child = this._renderEmptyBody(visibleColCount); // <tr>
            }

            var frag = document.createDocumentFragment();
            // Works for both: DocumentFragment and HTMLElement are Nodes
            frag.appendChild(child);

            this.tbody.replaceChildren(frag);

            // After first auto-expand render, avoid re-forcing expansion on future renders
            if (autoExpand) {
                this._childRowsInitialized = true;
            }
        }

        /**
         * Operations that should run after the body has been rendered.
         * This is shared between a full draw() and a fast re-render.
         * @param {Array} pageRows Current page rows
         * @private
         */
        _postBodyRender(pageRows) {
            // _renderBody replaces tbody on every draw. New rows require marks
            // even if the query did not change; empty queries only need cleanup
            // when transitioning from a non-empty search.
            if (this.highlight && this.highlight.enabled) {
                var q = (this.state.searchText || '').trim();
                if (q || q !== this._internals.lastHighlightQuery) {
                    this._applyHighlight();
                }
                this._internals.lastHighlightQuery = q;
            }

            // Sync row checkboxes + header checkbox with selection state
            this._syncSelectionDomAndHeader();
        }

        /**
         * Fast path: re-render only the tbody using the last loaded page rows.
         * Does NOT hit the data source, does NOT touch pager/footer.
         * Used for child row expand/collapse where data is unchanged.
         * @private
         */
        _rerenderBodyOnly() {
            // If we have no cached rows yet (first draw not done), fall back to full draw.
            if (!Array.isArray(this._lastPageRows)) {
                this.draw();
                return;
            }

            // Rebuild body based on current expand/collapse state and cached page rows
            this._renderBody(this._lastPageRows);

            // Minimal post-render work: highlight + selection sync
            this._postBodyRender(this._lastPageRows);
        }

        _addCustomClasses(tr, classes) {
            if (!classes) return;

            // allow string or array
            if (isStr(classes)) {
                classes = classes.trim().split(/\s+/);
            }
            if (!Array.isArray(classes)) return;

            classes.forEach(function (c) {
                if (c && isStr(c)) {
                    tr.classList.add(c);
                }
            });
        }

        /**
         * kind: 'row' | 'childRow' | 'groupRow'
         * cfg:  string | string[] | function(data, meta)
         */
        _applyCustomClass(tr, kind, data, meta) {
            if (!this.customClass) return;

            var cfg = this.customClass[kind];
            if (!cfg) return;

            var classes = isFn(cfg) ? cfg(data, meta || {}) : cfg;

            this._addCustomClasses(tr, classes);
        }

        _applyRowCustomClass(tr, row, meta) {
            if (!this.customClass) return;

            var kind;
            if (meta && meta.isGroupHeader) {
                kind = 'groupRow';
            } else if (meta && meta.isChild) {
                kind = 'childRow';
            } else {
                kind = 'row';
            }

            this._applyCustomClass(tr, kind, row, meta);
        }


        _renderDataRow(row, index, rowKey, isChild, columns, meta) {
            const tr = _dtCreateElement('tr');
            tr.dataset.rowKey = rowKey;
            tr._data = row;

            if (isChild) {
                tr.classList.add(TINY_TABLE_CLASSES.childRow);
            } else {
                this._rowDataByKey[rowKey] = row;  // Store row data for selection API (parents only)
            }

            var visibleIndex = 0;
            var self = this;

            // Count how many cells we actually render for this row (select + data cells)
            var renderedCellCount = 0;

            // Selection column:
            // - Parent rows: checkbox or group-level selection cell
            // - Child rows: empty cell to keep alignment
            if (this.select && this.select.enabled) {
                if (!isChild) {
                    var selTd = this._renderSelectCell(row, rowKey, meta);
                    if (selTd) {
                        tr.appendChild(selTd);
                        renderedCellCount++;
                    }
                } else {
                    // Child row: keep same grid position with an empty select cell
                    var emptySelTd = _dtCreateElement('td', TINY_TABLE_CLASSES.selectCell);
                    tr.appendChild(emptySelTd);
                    renderedCellCount++;
                }
            }

            const onCreatedRow = isFn(this.options.createdRow) ? this.options.createdRow : null;
            const onCreatedCell = isFn(this.options.createdCell) ? this.options.createdCell : null;

            // Data cells for each visible column (for parent or child)
            columns.forEach(function (col) {
                if (col.visible === false) return;

                var isFirstVisible = (self.select && self.select.enabled ? visibleIndex === 0 : visibleIndex === 0);

                var cellMeta = Object.assign(col.meta || {},{
                    isFirstVisible: isFirstVisible,
                    hasChildren: meta?.hasChildren,
                    isExpanded: meta?.isExpanded,
                    mergeColumnsSet: meta?.mergeColumnsSet,
                    groupSize: meta?.groupSize,
                    rowIndexInGroup: meta?.rowIndexInGroup
                });

                var td = self._renderCell(tr, row, col, index, isChild, rowKey, cellMeta);
                if (td) {
                    onCreatedCell?.call(this, {td, tr, row, col, index, isChild, meta: cellMeta});
                    tr.appendChild(td);
                    renderedCellCount++;
                }

                visibleIndex++;
            });

            // Total number of visible columns for this table, including select column
            if (isChild) {
                const expectedVisibleCols = this._internals.visibleColumnCount;
                // If this is a child row and it has fewer cells than the table's visible column count,
                // pad the remainder with empty cells so the grid stays aligned.
                if (renderedCellCount < expectedVisibleCols) {
                    const missing = expectedVisibleCols - renderedCellCount;
                    for (let i = 0; i < missing; i++) {
                        tr.appendChild(_dtCreateElement('td', TINY_TABLE_CLASSES.emptyCell));
                    }
                }
            }

            meta.isChild = !!isChild;
            this._applyRowCustomClass(tr, row, meta);

            onCreatedRow?.call(this, tr, row, index, meta);

            return tr;
        }

        _renderSelectCell(row, rowKey, meta) {
            var groupMode = (this._hasGrouping() && this.select.groupMode === 'group') ? 'group' : 'row';
            var groupSize = meta && meta.groupSize;
            var rowIndexInGroup = meta && meta.rowIndexInGroup;

            // For group mode, only first row of group gets the merged checkbox
            if (groupMode === 'group' &&
                isNbr(rowIndexInGroup) &&
                rowIndexInGroup > 0 &&
                groupSize > 1) {
                return null;
            }

            var td = _dtCreateElement('td', TINY_TABLE_CLASSES.selectCell);

            if (groupMode === 'group' &&
                isNbr(rowIndexInGroup) &&
                rowIndexInGroup === 0 &&
                groupSize > 1) {
                td.rowSpan = groupSize;
            }


            var cb = this._createCheckbox(td, {row, rowKey, meta});
            cb.dataset.ttSelect = 'row';
            cb.checked = this._selectedRowKeys.has(rowKey);
            this._applyRowSelectionControlState(cb, rowKey);

            return td;
        }

        _createCheckbox(parent, { row, rowKey, meta } = {}) {
            // Build the element (either custom builder or default checkbox)
            let element = null;

            if (isFn(this.select?.builder)) {
                element = this.select.builder.call(this, { row, rowKey, meta });
                if (isStr(element)) {
                    const t = document.createElement('template');
                    t.innerHTML = element.trim();
                    element = t.content;
                }
            }
            if (!element) {
                element = _dtCreateElement('input', { type: 'checkbox' });
            }
            // Append to parent
            parent.appendChild(element);
            if (element.nodeType === 1 && element.matches('input[type="checkbox"]')) return element;
            return parent.querySelector('input[type="checkbox"]');
        }

        _parseNode(html) {
            if (!this.domParser) this.domParser = new DOMParser();
            try {
                const doc = this.domParser.parseFromString(html, 'text/html');
                return doc.body.firstChild;
            } catch(e) {
            }
        }

        _renderCell(tr, row, col, index, isChild, rowKey, meta) {
            var mergeColsSet = meta && meta.mergeColumnsSet;
            var groupSize = meta && meta.groupSize;
            var rowIndexInGroup = meta && meta.rowIndexInGroup;

            // If this column is merged and this is not the first row of the group, skip the cell
            if (!isChild &&
                mergeColsSet &&
                mergeColsSet.has(col.key) &&
                isNbr(rowIndexInGroup) &&
                rowIndexInGroup > 0 &&
                groupSize > 1) {
                return null;
            }

            var td = _dtCreateElement('td');
            if (col.className?.length) {
                _dtAddClass(td,col.className)
            }

            // If this column is merged and this is the first row of the group, set rowspan
            if (!isChild &&
                mergeColsSet &&
                mergeColsSet.has(col.key) &&
                isNbr(rowIndexInGroup) &&
                rowIndexInGroup === 0 &&
                groupSize > 1) {
                td.rowSpan = groupSize;
            }

            if (!isChild &&
                this.childRows.enabled &&
                this.childRows.toggleIcon &&
                meta &&
                meta.isFirstVisible &&
                meta.hasChildren) {
                var icon = _dtCreateElement('a', TINY_TABLE_CLASSES.toggleIcon, {'data-tt-toggle':'row'});
                if (meta.isExpanded) icon.classList.add('expanded');

                var toggleOpt = this.childRows.toggleIcon;
                var html;
                if (isFn(toggleOpt)) {
                    html = toggleOpt({ row, expanded: meta.isExpanded, table: this });
                } else if (isStr(toggleOpt)) {
                    html = toggleOpt;
                }
                if (html!=null) {
                    icon.insertAdjacentHTML('afterbegin', html);
                    icon.classList.add('custom');
                }

                td.appendChild(icon);
                td.appendChild(document.createTextNode(' '));
            }

            var rawValue = row[col.key];

            // Tooltip for cell
            if (col.tooltip) {
                var tip = isFn(typeof col.tooltip)
                    ? col.tooltip(row, rawValue, { rowKey, rowIndex: index, isChild })
                    : col.tooltip;
                if (tip != null && tip !== "") {
                    td.setAttribute("data-tooltip", String(tip));
                }
            }

            var content = this._renderValue(col, rawValue, row, index, "display", { isChild, rowKey, td, tr});

            if (content != null) {
                if (content instanceof Node) {
                    td.appendChild(content);
                } else if (isObj(content) && content.html != null) {
                    // Explicit legacy HTML wrapper support
                    // If TD already has nodes (e.g. toggle icon), don't wipe them.
                    if (td.childNodes?.length) {
                        td.insertAdjacentHTML('beforeend', String(content.html));
                    } else {
                        td.innerHTML = String(content.html);
                    }
                } else if (isStr(content) && _looksLikeHtml(content)) {
                        // Auto-detect HTML strings in display phase only
                        if (td.childNodes?.length) {
                            td.insertAdjacentHTML('beforeend', content);
                        } else {
                            td.innerHTML = content;
                        }
                } else // could be number...
                    td.appendChild(document.createTextNode(String(content)));

            }

            if (this.inlineEdit && col.editable) {
                this.inlineEdit.decorateCell(td, {
                    td, tr, row, col, index, isChild, rowKey, meta
                });
            }

            return td;
        }

        _updateSortIndicators() {
            if (!this.thead) return;

            const orders = Array.isArray(this.state.sortOrders) ? this.state.sortOrders : [];
            const hasMultiSort = orders.length > 1;

            // Build lookup: key -> { dir, rank }
            const map = Object.create(null);
            for (let i = 0; i < orders.length; i++) {
                const o = orders[i];
                if (!o || !o.key) continue;
                const dir = String(o.dir || o.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
                map[o.key] = { dir, rank: i + 1 };
            }

            this.thead.querySelectorAll('th').forEach(th => {
                th.classList.remove(TINY_TABLE_CLASSES.sortedAsc, TINY_TABLE_CLASSES.sortedDesc);

                // Remove rank marker if previously set
                if (th.dataset && th.dataset.sortRank) delete th.dataset.sortRank;

                const key = th.getAttribute('data-key') || th.dataset.key;
                if (!key) return;

                const info = map[key];
                if (info) {
                    th.classList.add(info.dir === 'asc' ? TINY_TABLE_CLASSES.sortedAsc : TINY_TABLE_CLASSES.sortedDesc);
                    // Expose rank (1 = primary, 2+ = secondary)
                    if (hasMultiSort) {
                        th.dataset.sortRank = String(info.rank);
                    } else if (th.dataset.sortRank) {
                        delete th.dataset.sortRank;
                    }
                }
            });
        }

        _getAllVisibleRowsForAggregates(pageRows) {
            if (!this.footer?.enabled) return null;

            const aggs = this.footer.aggregates;
            const hasAggregates = isPlainObject(aggs) && Object.keys(aggs).length > 0;

            if (!hasAggregates) return null;

            // Local mode: aggregate on all filtered rows (not just current page)
            if (this.dataSource instanceof LocalDataSource && isFn(this.dataSource.getFilteredRows)) {
                return this.dataSource.getFilteredRows(this.state, this.columns);
            }

            // Ajax mode: fallback to current page only (unless server provides aggregates separately)
            return Array.isArray(pageRows) ? pageRows : [];
        }

        _updateFooterVisibility() {
            if (!this.footer?.enabled) return false;

            const hideWhenEmpty = this.footer?.hideWhenEmpty ?? true;
            const rowCount = this.state?.totalRows;
            const showFooter = !hideWhenEmpty || rowCount > 0;
            _setDisplayElement(this.tfoot, showFooter);
            return showFooter;
        }

        _updateFooterAggregates(allRows) {
            const self = this;
            if (!this.footer?.enabled || !this.footerRow) return;

            const aggregates = isPlainObject(this.footer.aggregates) ? this.footer.aggregates : {};

            const aggKeys = Object.keys(aggregates);

            const getFooterCells = () => this.footerRow.querySelectorAll('th');
            const getVisibleStartIndex = () => (this.select?.enabled ? 1 : 0);

            const clearFooter = () => {
                const cells = getFooterCells();
                let idx = getVisibleStartIndex();

                this.columns.forEach(col => {
                    if (col.visible === false) return;
                    const cell = cells[idx++];
                    if (cell) cell.textContent = '';
                });
            };

            const collectValuesByKey = (rows, keys) => {
                const map = {};
                keys.forEach(k => (map[k] = []));

                rows.forEach(row => {
                    if (!row) return;
                    keys.forEach(k => map[k].push(row[k]));
                });

                return map;
            };

            const resolveAggregator = (def) => {
                if (isFn(def)) return def;
                const name = String(def);
                return TinyDataTable.aggregators?.[name];
            };

            const computeAggregates = (valuesByKey) => {
                const results = {};

                aggKeys.forEach(k => {
                    const fn = resolveAggregator(aggregates[k]);

                    if (!isFn(fn)) {
                        console.warn(`TinyDataTable: unknown footer aggregator "${aggregates[k]}" for column "${k}"`);
                        results[k] = null;
                        return;
                    }

                    try {
                        results[k] = fn(valuesByKey[k] || [], {
                            key: k,
                            rows: allRows,
                            table: self
                        });
                    } catch (e) {
                        results[k] = null;
                    }
                });

                return results;
            };

            const renderFooterCell = (col, value, cell) => {
                let v = value;
                if (isFn(col.render)) {
                    try {
                        // using 'display' phase rather than 'footer' to use the render.
                        v = self._renderValue(col, v, null, -1, 'display', {td: cell, rowKey: col.key, isChild: false});
                    } catch (e) {}
                }
                cell.textContent = (v == null) ? '' : String(v);
            };

            // ---- main flow ----

            if (!aggKeys.length || !Array.isArray(allRows) || !allRows.length) {
                clearFooter();
                return;
            }

            // Only aggregate visible columns
            const visibleAggKeys = aggKeys.filter(k =>
                this.columns.some(col => col.key === k && col.visible !== false)
            );

            if (!visibleAggKeys.length) {
                clearFooter();
                return;
            }

            const valuesByKey = collectValuesByKey(allRows, visibleAggKeys);
            const results = computeAggregates(valuesByKey);

            const cells = getFooterCells();
            let idx = getVisibleStartIndex();

            this.columns.forEach(col => {
                if (col.visible === false) return;

                const cell = cells[idx++];
                if (!cell) return;

                if (Object.prototype.hasOwnProperty.call(results, col.key)) {
                    renderFooterCell(col, results[col.key], cell);
                } else {
                    cell.textContent = '';
                }
            });

            if (isFn(this.footer?.callback)) {
                this.footer.callback.call(this,{
                    table: this,
                    tfoot: this.tfoot,
                    columns: this.columns,
                    state: this.state
                });
            }
        }

        _applyHighlight() {
            if (!MARK_CTOR || !this.highlight.enabled) return;
            const keyword = (this.state.searchText || '').trim();
            const highlightId = this._internals.highlightSeq = (this._internals.highlightSeq || 0) + 1;

            let context = this.tbody;
            if ( this.highlight.contextSelector &&  this.highlight.contextSelector !=='tbody') {
                context = this.table.querySelector(this.highlight.contextSelector);
                if (!context) return;
            }

            const instance = new MARK_CTOR(context);
            const markOptions = this.highlight.markOptions || {};

            try {
                instance.unmark({
                    done: () => {
                        // Old async unmark callbacks cannot restore cleared text.
                        if (keyword && highlightId === this._internals.highlightSeq
                            && keyword === (this.state.searchText || '').trim()) {
                            instance.mark(keyword, markOptions);
                        }
                    }
                });
            } catch (e) {
                try {
                    instance.unmark();
                    if (keyword && highlightId === this._internals.highlightSeq) {
                        instance.mark(keyword, markOptions);
                    }
                } catch (e2) {
                    // ignore
                }
            }
        }

        /**
         * Apply the current selection policy to one rendered row checkbox.
         *
         * A custom builder may still provide its own disabled/title state. The
         * component remembers that base state and layers the dynamic policy on top.
         * Rejection reasons are exposed through both native title and the existing
         * TinyDataTable tooltip convention.
         *
         * @param {HTMLInputElement} checkbox
         * @param {string|number} rowKey
         * @private
         */
        _applyRowSelectionControlState(checkbox, rowKey) {
            if (!checkbox) return;

            if (checkbox._ttBaseDisabled === undefined) {
                checkbox._ttBaseDisabled = !!checkbox.disabled;
                checkbox._ttBaseTitle = checkbox.getAttribute('title') || '';

                var baseTarget = checkbox.closest?.('label') || checkbox;
                checkbox._ttSelectionTooltipTarget = baseTarget;
                checkbox._ttBaseTooltip = baseTarget.getAttribute('data-tooltip') || '';
                checkbox._ttBaseTooltipTitle = baseTarget.getAttribute('title') || '';
            }

            var key = String(rowKey);
            var selected = this._selectedRowKeys.has(key);
            var state = selected
                ? { selectable: true, reason: '' }
                : this.getRowSelectionState(key, { mode: 'row' });
            var denied = !state.selectable;
            var reason = denied ? state.reason : '';
            var tooltipTarget = checkbox._ttSelectionTooltipTarget || checkbox;

            checkbox.disabled = !!checkbox._ttBaseDisabled || denied;
            checkbox.setAttribute('aria-disabled', checkbox.disabled ? 'true' : 'false');

            if (reason) {
                tooltipTarget.setAttribute('data-tooltip', reason);
                tooltipTarget.setAttribute('title', reason);
            } else {
                if (checkbox._ttBaseTooltip) {
                    tooltipTarget.setAttribute('data-tooltip', checkbox._ttBaseTooltip);
                } else {
                    tooltipTarget.removeAttribute('data-tooltip');
                }

                if (checkbox._ttBaseTooltipTitle) {
                    tooltipTarget.setAttribute('title', checkbox._ttBaseTooltipTitle);
                } else {
                    tooltipTarget.removeAttribute('title');
                }

                if (checkbox._ttBaseTitle) {
                    checkbox.setAttribute('title', checkbox._ttBaseTitle);
                } else if (tooltipTarget !== checkbox) {
                    checkbox.removeAttribute('title');
                }
            }
        }

        _handleRowCheckboxChange(rowKey, checked, tr) {
            var mode = (this._hasGrouping() && this.select.groupMode === 'group') ? 'group' : 'row';
            var affectedKeys = [];
            var self = this;

            if (mode === 'group') {
                var groupKey = tr && tr.dataset.groupKey;
                if (groupKey && this._pageGroupRowKeyMap && this._pageGroupRowKeyMap[groupKey]) {
                    affectedKeys = this._pageGroupRowKeyMap[groupKey].slice();
                } else {
                    affectedKeys = [rowKey];
                }
            } else {
                affectedKeys = [rowKey];
            }

            var changedKeys = [];

            affectedKeys.forEach(function (k) {
                var key = String(k);

                if (checked) {
                    if (!self.isRowSelectable(key, { mode: mode })) return;
                    if (!self._selectedRowKeys.has(key)) changedKeys.push(key);
                    self._selectedRowKeys.add(key);
                } else {
                    if (self._selectedRowKeys.delete(key)) changedKeys.push(key);
                }
            });

            this._syncSelectionDomAndHeader();

            this._emit('select', {
                mode: mode,
                rowKey: rowKey,
                checked: checked,
                affectedRowKeys: changedKeys,
                selectedRowKeys: this.getSelectedRowKeys()
            });
        }

        _handleHeaderSelectAll(checked) {
            var self = this;
            if (!this._pageParentRowKeys) return;

            var changedKeys = [];

            this._pageParentRowKeys.forEach(function (k) {
                var key = String(k);

                if (checked) {
                    if (!self.isRowSelectable(key, { mode: 'page' })) return;
                    if (!self._selectedRowKeys.has(key)) changedKeys.push(key);
                    self._selectedRowKeys.add(key);
                } else {
                    if (self._selectedRowKeys.delete(key)) changedKeys.push(key);
                }
            });

            this._syncSelectionDomAndHeader();

            this._emit('select', {
                mode: 'page',
                rowKey: null,
                checked: checked,
                affectedRowKeys: changedKeys,
                selectedRowKeys: this.getSelectedRowKeys()
            });
        }

        _updateHeaderSelectCheckboxState() {
            var cb = this._headerSelectCheckbox;
            if (!cb || !this._pageParentRowKeys) return;

            var self = this;
            var selectableKeys = this._pageParentRowKeys.filter(function (k) {
                return self.isRowSelectable(k, { mode: 'page' });
            });
            var total = selectableKeys.length;

            cb.disabled = total === 0;
            cb.setAttribute('aria-disabled', cb.disabled ? 'true' : 'false');

            if (total === 0) {
                cb.checked = false;
                cb.indeterminate = false;
                return;
            }

            var selectedCount = 0;
            selectableKeys.forEach(function (k) {
                if (self._selectedRowKeys.has(String(k))) selectedCount++;
            });

            if (selectedCount === 0) {
                cb.checked = false;
                cb.indeterminate = false;
            } else if (selectedCount === total) {
                cb.checked = true;
                cb.indeterminate = false;
            } else {
                cb.checked = false;
                cb.indeterminate = true;
            }
        }

        _syncSelectionDomAndHeader() {
            if (!this.select.enabled) return;

            var body = this.tbody;
            if (body) {
                var inputs = body.querySelectorAll('input[type="checkbox"][data-tt-select="row"]');
                for (var i = 0; i < inputs.length; i++) {
                    var cb = inputs[i];
                    var tr = cb.closest('tr');
                    if (!tr) continue;
                    var key = tr.dataset.rowKey;
                    cb.checked = key && this._selectedRowKeys.has(key);
                    if (key) this._applyRowSelectionControlState(cb, key);
                }
            }

            this._updateHeaderSelectCheckboxState();
        }

        exportTo(format, ...args) {
            if (!format) throw new Error('exportTo(format, ...) requires a format');
            const exporter = TinyDataTable.exporters?.[format.toLowerCase()];
            if (!exporter) throw new Error(`No exporter registered for format "${format}", did you import the TinyDataTable.export.js file ?`);
            return exporter.export(this, ...args);
        };
    }

    // -----------------------------
    // Pager helper class
    // -----------------------------

    class Pager {
        /**
         * @param {HTMLElement} container
         * @param {Function} getState        () => { page, pageSize, totalRows }
         * @param {Function} onPageChange    (newPage)
         * @param {Function} onPageSizeChange(newPageSize)
         * @param {number[]} pageSizeOptions
         */
        constructor(table, container, getState, onPageChange, onPageSizeChange, pageSizeOptions, showInfoOnly) {
            this.table = table;
            this.container = container;
            this.getState = getState;
            this.onPageChange = onPageChange;
            this.onPageSizeChange = onPageSizeChange;
            this.pageSizeOptions = pageSizeOptions ?? [10, 25, 50, 100];
            this.texts = table.texts;
            this.infoOnly = showInfoOnly;
            this.init();
        }

        /**
         * Initialize table structure and perform initial draw.
         * This is automatically called by the constructor.
         */

        init() {
            const state = this.getState();
            const maxPage = Math.max(1, Math.ceil(state.totalRows / state.pageSize));

            if (!this.infoOnly) {
                this.container.appendChild(this._buildPageSize(state));
            }

            this.container.appendChild(this._buildPageInfo());

            if (!this.infoOnly) {
                var pagination = _dtCreateElement('div', TINY_TABLE_CLASSES.pages);
                this.container.appendChild(pagination);
                this.pagination = pagination;

                this._initPaginationShell();
                this._updatePageNumberList(); // first render
            }
        }

        _buildPageSize(state) {
            var self = this;

            var lengthWrapper = _dtCreateElement('div', TINY_TABLE_CLASSES.length);

            var lengthLabel = _dtCreateElement('span', { text : this.texts.pagerShowPrefix || 'Show '});

            var pageSize = state.pageSize;
            // Ensure the pageSize is part of the pageSizeOptions array
            if (!this.pageSizeOptions.includes(pageSize)) {
                this.pageSizeOptions.push(pageSize);
                this.pageSizeOptions.sort((a, b) => a - b);  // Sort the array numerically
            }

            const onLengthChange = function () {
                //const selectedValue = event.target.value;
                var newSize = parseInt(this.value, 10) || pageSize;
                self.onPageSizeChange(newSize);
            }

            const lengthSelect = TinyDataTable.buildSelect(this.pageSizeOptions, pageSize, onLengthChange);
            _dtAddClass(lengthSelect, this.table.customClass?.select);

            var lengthSuffix = _dtCreateElement('span', { text : this.texts.pagerEntriesSuffix || ' entries'});

            lengthWrapper.appendChild(lengthLabel);
            lengthWrapper.appendChild(lengthSelect);
            lengthWrapper.appendChild(lengthSuffix);

            this.pageLengthSelect = lengthSelect;

            return lengthWrapper;
        }

        // Update page info
        _updatePageInfo() {
            const {start, end, totalRows} = this.getState();
            const tpl = this.texts.pagerInfo || 'Showing {start} to {end} of {total} entries';
            this.pageInfo.textContent = totalRows>0 ? formatText(tpl, { start, end, total: totalRows }) : '';
        }

        _buildPageInfo() {
            this.pageInfo = _dtCreateElement('div', TINY_TABLE_CLASSES.info);
            this._updatePageInfo();
            return this.pageInfo;
        }

        // Update pager components
        /**
         * Update options/state and re-draw.
         * Intended for small incremental updates (for larger changes, rebuild the table).
         * @param {Object} newOptions
         */

        update() {
            const showPager = this._updateVisibility();
            if (!showPager) return;

            this._updatePageInfo();

            if (!this.infoOnly) {
                this._updatePageNumberList();
            }
        }

        _createButton(label, opts) {
            opts = opts || {};
            const btn = _dtCreateElement('button', { type: 'button' });

            // label can be string/number or { html }
            if (isObj(label) && label.html != null) {
                btn.innerHTML = label.html;
            } else {
                btn.textContent = label != null ? String(label) : '';
            }

            if (opts.activeClass) btn.classList.add(opts.activeClass);
            if (opts.disabled) btn.disabled = true;

            if (isFn(opts.onClick)) {
                btn.addEventListener('click', opts.onClick);
            }

            return btn;
        }

        _initPaginationShell() {
            const self = this;
            const pagination = this.pagination;
            pagination.innerHTML = '';

            this._btnFirst = this._createButton(this.texts.pagerFirst || '«', {
                onClick: () => self.onPageChange(1)
            });

            this._btnPrev = this._createButton(this.texts.pagerPrev || '‹', {
                onClick: () => {
                    const { page } = self.getState();
                    self.onPageChange(page - 1);
                }
            });

            this._btnNext = this._createButton(this.texts.pagerNext || '›', {
                onClick: () => {
                    const { page } = self.getState();
                    self.onPageChange(page + 1);
                }
            });

            this._btnLast = this._createButton(this.texts.pagerLast || '»', {
                onClick: () => {
                    const { totalPages } = self.getState();
                    self.onPageChange(totalPages);
                }
            });

            this._pagesSlot = _dtCreateElement('span', TINY_TABLE_CLASSES.pagesSlot);

            pagination.appendChild(this._btnFirst);
            pagination.appendChild(this._btnPrev);
            pagination.appendChild(this._pagesSlot);
            pagination.appendChild(this._btnNext);
            pagination.appendChild(this._btnLast);
        }

        _renderPageItemsIntoSlot(currentPage, items) {
            const self = this;
            const slot = this._pagesSlot;
            slot.innerHTML = '';

            items.forEach(function (item) {
                if (item.type === 'page') {
                    const isActive = item.number === currentPage;

                    slot.appendChild(self._createButton(item.number, {
                        disabled: isActive,
                        activeClass: isActive ? TINY_TABLE_CLASSES.pageButtonActive : null,
                        onClick: isActive ? null : () => self.onPageChange(item.number)
                    }));
                } else {
                    slot.appendChild(
                        _dtCreateElement('span', TINY_TABLE_CLASSES.ellipsis, {
                            text: self.texts.pagerEllipsis || '…'
                        })
                    );
                }
            });
        }

        _updateVisibility() {
            const hideWhenEmpty = this.table.options?.paging?.hideWhenEmpty ?? true;
            const pagingThreshold = this.table.options?.paging?.pagingThreshold ?? 0;
            const rowCount = this.getState().totalRows;
            const showPager = rowCount > pagingThreshold || !hideWhenEmpty;

            _setDisplayElement(this.container, showPager);

            return showPager;
        }

        _updatePageNumberList() {
            const { page, totalPages } = this.getState();

            this._btnFirst.disabled = page <= 1;
            this._btnPrev.disabled  = page <= 1;
            this._btnNext.disabled  = page >= totalPages;
            this._btnLast.disabled  = page >= totalPages;

            // build items (your existing logic)
            const items = [];
            if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) items.push({ type: 'page', number: i });
            } else {
                items.push({ type: 'page', number: 1 });
                let left = Math.max(2, page - 1);
                let right = Math.min(totalPages - 1, page + 1);
                if (left > 2) items.push({ type: 'ellipsis' });
                for (let i = left; i <= right; i++) items.push({ type: 'page', number: i });
                if (right < totalPages - 1) items.push({ type: 'ellipsis' });
                items.push({ type: 'page', number: totalPages });
            }

            this._renderPageItemsIntoSlot(page, items);
        }

    }

    class Popup {
        /**
         * @param {string|HTMLElement} popupSelector - Popup container selector or element.
         * @param {Object} options
         * @param {string|string[]} options.triggerSelector - CSS selector(s) for triggers that open this popup.
         * @param {function} options.onClick - Callback invoked on item click, (event, dataset) => {}
         */
        constructor(popupSelector, { triggerSelector, onClick }) {
            this.popup = isStr(popupSelector)
                ? document.querySelector(popupSelector)
                : popupSelector;

            if (!this.popup) {
                throw new Error('Popup element not found');
            }

            if (triggerSelector instanceof Node) {
                this.triggers = [triggerSelector];
            } else if (
                NodeList.prototype.isPrototypeOf(triggerSelector) ||
                HTMLCollection.prototype.isPrototypeOf(triggerSelector) ||
                Array.isArray(triggerSelector)
            ) {
                // Array-like collection of nodes
                this.triggers = Array.from(triggerSelector);
            } else if (isStr(triggerSelector)) {
                this.triggers = Array.from(document.querySelectorAll(triggerSelector));
            } else {
                throw new Error('triggerSelector must be a CSS selector string, Node, or array/NodeList of Nodes');
            }

            if (!this.triggers.length) {
                throw new Error('No triggers found for popup');
            }

            if (typeof onClick !== 'function') {
                throw new Error('onClick callback is required');
            }

            this.onClick = onClick;
            this.isVisible = false;
            this.boundDocClick = this.handleDocumentClick.bind(this);

            this.init();
        }

        init() {
            // Bind triggers click
            this.triggers.forEach(trigger => {
                trigger.addEventListener('click', e => {
                    e.preventDefault();
                    this.toggle(trigger);
                });
            });

            // Bind clicks inside popup items
            this.popup.addEventListener('click', e => {
                const item = e.target.closest('li');
                if (item && this.popup.contains(item)) {
                    this.onClick(e, item.dataset);
                    this.hide();
                }
            });
        }

        show(trigger) {
            if (this.isVisible) return;

            this.popup.classList.add('invisible');
            this.positionPopup(trigger);
            this.popup.classList.remove('invisible');
            this.popup.classList.add('visible');

            this.isVisible = true;

            // Listen for clicks outside to close
            document.addEventListener('click', this.boundDocClick);
        }

        hide() {
            if (!this.isVisible) return;

            this.popup.classList.remove('visible');
            this.isVisible = false;

            document.removeEventListener('click', this.boundDocClick);
        }

        toggle(trigger) {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show(trigger);
            }
        }

        positionPopup(trigger) {
            if (!trigger || !this.popup) return;

            // The popup's offset parent (could be the container with relative position)
            const offsetParent = this.popup.offsetParent || document.body;

            // Get bounding rects relative to viewport
            const triggerRect = trigger.getBoundingClientRect();
            const parentRect = offsetParent.getBoundingClientRect();

            // Calculate position relative to offset parent
            let top = triggerRect.bottom - parentRect.top;
            let left = triggerRect.left - parentRect.left;

            const popupWidth = this.popup.offsetWidth || 200;
            const parentWidth = this.popup.offsetParent ? this.popup.offsetParent.clientWidth : window.innerWidth;
            if (left + popupWidth > parentWidth) {
                left = Math.max(0, parentWidth - popupWidth - 10);
            }

            this.popup.style.position = 'absolute';
            this.popup.style.top = `${top}px`;
            this.popup.style.left = `${left}px`;
            this.popup.style.minWidth = `${triggerRect.width}px`;
            this.popup.style.zIndex = 1000;
        }



        handleDocumentClick(e) {
            if (
                !this.popup.contains(e.target) &&
                !this.triggers.some(trigger => trigger.contains(e.target))
            ) {
                this.hide();
            }
        }
    }

    // -----------------------------
    // i18n defaults (texts)
    // -----------------------------

    TinyDataTable.defaults = TinyDataTable.defaults || {};

    TinyDataTable.defaults.texts = Object.assign({
        emptyMessage: "No data available",
        searchPlaceholder: "Search...",
        pagerShowPrefix: "Show ",
        pagerEntriesSuffix: " entries",
        pagerInfo: "Showing {start} to {end} of {total} entries",
        pagerFirst: "«",
        pagerPrev: "‹",
        pagerNext: "›",
        pagerLast: "»",
        pagerEllipsis: "…",

        exportButton: {
            label: (fmt) => {
                const labels = {
                    xlsx: 'Excel (.xlsx)',
                    pdf: 'PDF Document',
                    csv: 'CSV File',
                };
                return labels[fmt];
            }
        }
    }, TinyDataTable.defaults.texts || {});

    // Pager end

    // Expose a way to override mark.js constructor if needed
    TinyDataTable.setMarkConstructor = function (ctor) {
        MARK_CTOR = ctor || null;
    };

    TinyDataTable.setTooltipAdapter = function (fn) {
        if (fn != null && typeof fn !== 'function') {
            const isObj = isObj(fn) && (isFn(fn.bind) || isFn(fn.delegate));
            if (!isObj) {
                throw new Error("Tooltip adapter must be a function, an object { bind, delegate }, or null.");
            }
        }
        GLOBAL_TOOLTIP_ADAPTER = fn;
    };


    TinyDataTable.typeRenderers = {
        digits({value, ctx}) {
            if (ctx._blank(value)) return '';
            if (ctx.phase == 'display') {
                return to_digits(value,this.locale,2,false);
            }
            return value;
        },
        ng_digits({value, ctx}) {
            if (ctx._blank(value)) return '';
            if (ctx.phase == 'display') {
                return to_digits(value,this.locale,2,true);
            }
            return value;
        },
        percent({value, ctx}) {
            if (ctx._blank(value)) return '';
            if (ctx.phase == 'display') {
                var num = Number(value);
                if (!Number.isNaN(num)) return num.toFixed(1) + ' %';
            }
            return value;
        },

        money({value, ctx}) {
            if (ctx._blank(value)) return '';
            if (ctx.phase == 'display') {
                var num = Number(value);
                if (!Number.isNaN(num)) return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'") + '.-';
            }
            return value;
        },
        ng_money({ value, ctx }) {
            if (ctx._blank(value)) return '';
            if (ctx.phase === 'display') {
                const num = Number(value);
                if (!Number.isNaN(num)) {
                    return (-num).toFixed(2) + '.-';
                }
            }
            return value;
        },
        ellipsis: (max = 40) => ({ value, ctx }) => {
            if (ctx._blank(value)) return '';
            if (ctx.phase !== 'display') return value;
            max = Number(max);
            if (!Number.isFinite(max) || max <= 0) max = 40;
            const full = String(value);
            const isTruncated = full.length > max;
            const span = document.createElement('span');
            span.textContent = isTruncated ? (full.slice(0, max) + '…') : full;
            if (isTruncated) span.dataset.tooltip = full;
            return span;
        }
    };

    TinyDataTable.appendTypeRenderers = function (renderers) {
        TinyDataTable.typeRenderers = Object.assign({}, TinyDataTable.typeRenderers, renderers);
    };

    TinyDataTable.aggregators = {

        /* ---------- BASIC ---------- */

        sum(values) {
            let s = 0;
            for (const v of values) {
                const n = Number(v);
                if (Number.isFinite(n)) s += n;
            }
            return s;
        },

        avg(values) {
            let s = 0, c = 0;
            for (const v of values) {
                const n = Number(v);
                if (Number.isFinite(n)) {
                    s += n;
                    c++;
                }
            }
            return c ? (s / c) : null;
        },

        min(values) {
            let m = null;
            for (const v of values) {
                const n = Number(v);
                if (!Number.isFinite(n)) continue;
                m = (m === null) ? n : Math.min(m, n);
            }
            return m;
        },

        max(values) {
            let m = null;
            for (const v of values) {
                const n = Number(v);
                if (!Number.isFinite(n)) continue;
                m = (m === null) ? n : Math.max(m, n);
            }
            return m;
        },

        /* ---------- COUNTING ---------- */

        count(values) {
            return values.length;
        },

        countNonNull(values) {
            let c = 0;
            for (const v of values) {
                if (v != null && v !== '') c++;
            }
            return c;
        },

        countDistinct(values) {
            const set = new Set();
            for (const v of values) {
                if (v != null) set.add(v);
            }
            return set.size;
        },

        /* ---------- STATISTICAL ---------- */

        median(values) {
            const arr = values
                .map(v => Number(v))
                .filter(n => Number.isFinite(n))
                .sort((a, b) => a - b);

            if (!arr.length) return null;

            const mid = Math.floor(arr.length / 2);
            return (arr.length % 2)
                ? arr[mid]
                : (arr[mid - 1] + arr[mid]) / 2;
        },

        variance(values) {
            let mean = 0, count = 0;

            for (const v of values) {
                const n = Number(v);
                if (Number.isFinite(n)) {
                    mean += n;
                    count++;
                }
            }
            if (!count) return null;
            mean /= count;

            let sumSq = 0;
            for (const v of values) {
                const n = Number(v);
                if (Number.isFinite(n)) {
                    const d = n - mean;
                    sumSq += d * d;
                }
            }
            return sumSq / count;
        },

        stddev(values) {
            const v = TinyDataTable.aggregators.variance(values);
            return v == null ? null : Math.sqrt(v);
        },

        /* ---------- EXTREMES ---------- */

        first(values) {
            for (const v of values) {
                if (v != null) return v;
            }
            return null;
        },

        last(values) {
            for (let i = values.length - 1; i >= 0; i--) {
                const v = values[i];
                if (v != null) return v;
            }
            return null;
        }
    };


    TinyDataTable.registerAggregator = function (name, fn) {
        if (!name || typeof name !== 'string') throw new Error('Aggregator name must be a string');
        if (typeof fn !== 'function') throw new Error('Aggregator must be a function');
        TinyDataTable.aggregators[name] = fn;
    };

    TinyDataTable._normalizeOptions = (options) => {
        // Check if the options are already in the correct format (array of objects with value and label)
        if (Array.isArray(options) && options.length > 0 && options[0].hasOwnProperty('value') && options[0].hasOwnProperty('label')) {
            // If options is already an array of objects with value and label, return it as is
            return options;
        } else if (Array.isArray(options)) {
            // If options is an array of values, map it to an array of { value, label }
            return options.map(option => ({
                value: option,
                label: option
            }));
        } else if (isObj(options)) {
            // If options is an object, map its entries to { value, label }
            return Object.entries(options).map(([key, value]) => ({
                value: key,
                label: value
            }));
        } else {
            throw new Error('Invalid options format. Expected an array or object.');
        }
    };

    TinyDataTable.buildSelect = (options, defaultValue, onChange) => {
        // Normalize options to a consistent array of { value, label }
        const normalizedOptions = TinyDataTable._normalizeOptions(options);
        const select = _dtCreateElement('select', 'tt-select-default');
        // Loop through the normalized options and create option elements
        normalizedOptions.forEach(option => {
            const optionElement = _dtCreateElement('option', { value : String(option.value), text : String(option.label)});
            if (String(option.value) === String(defaultValue)) optionElement.selected = true;
            select.appendChild(optionElement);
        });
        // If no default value is provided, select the first option
        if (!defaultValue && select.options.length > 0) select.options[0].selected = true;
        if (isFn(onChange)) {
            select.addEventListener('change', onChange);
        }
        return select;
    }

    TinyDataTable.registerExporter = function (format, exporter) {
        if (!format || typeof exporter?.export !== 'function') {
            throw new Error('Invalid exporter');
        }
        TinyDataTable.exporters = TinyDataTable.exporters || {};
        TinyDataTable.exporters[String(format).toLowerCase()] = exporter;
    };

    TinyDataTable._dtCreateElement = _dtCreateElement;
    // Also expose the semantic version on the constructor itself for
    // easier access when using TinyDataTable without modules.
    TinyDataTable.VERSION = TINYDATATABLE_VERSION;

    return TinyDataTable;
}));
