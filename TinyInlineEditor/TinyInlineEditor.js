/**
 * TinyInlineEditor 2.1 — jQuery inline rich-text editor.
 * The historical $.fn.inLine API remains supported.
 * Uses document.execCommand for editing (deprecated browser API).
 */

function TinyInlineEditor() {
    "use strict";

    const CLASS = {
        panelContainer: "il__panel__container",
        visible: "il--visible",
        hidden: 'il--hidden'
    };

    const icons = {
        bold: '<path d="M14 10h9.68a7.04 7.04 0 010 14.08H14h0V10zM14 24.08h12.32a7.04 7.04 0 010 14.08H14h0V24.08z"/>',
        italic: '<path d="M28.134 9.757l-7.61 28.401M31.219 9.757h-6.917M24.242 38.158h-6.917"/>',
        underline: '<path d="M14 39h20M34 9.435v11.38C34 26.44 29.523 31 24 31s-10-4.56-10-10.186V9.435"/>',
        strikeThrough: '<path d="M9 24h30M32.5 16.5c0-4.142-3.806-7.5-8.5-7.5s-8.5 3.358-8.5 7.5c0 4.142 3.806 7.5 8.5 7.5M15.5 31.5c0 4.142 3.806 7.5 8.5 7.5s8.5-3.358 8.5-7.5c0-4.142-3.806-7.5-8.5-7.5"/>',

        unorderedList: '<path d="M22.5 32.5h13.177M22.5 15.5h13.177M13 32.5h1.78M13 15.5h1.78"/>',
        orderedList: '<path d="M16.114 37h-5.12l4.475-6.08a1.959 1 0 00-.467-2.773 2.938 2.938 0 00-3.33-.003l-.003.003a1.89 1 0 00-.41 2.733M10.636 10h2.408v9.295M23.74 32.5h13.177M23.74 15.5h13.177"/>',

        alignLeft: '<path d="M11 14h26M11 24.5h16M11 35h6"/>',
        alignCenter: '<path d="M11 14h26M16 24.5h16M21 35h6"/>',
        alignRight: '<path d="M11 14h26M21 24.5h16M31 35h6"/>',
        alignFull: '<path d="M11 14h26M11 24.5h26M11 35h18.023"/>',

        format: '<path d="M10 12h28M18 12v24M14 36h8M30 20h10M30 28h8M30 36h6"/>',
        heading1: '<path d="M10 10v28M10 24h16M26 10v28M34 18l6-4v20"/>',
        heading2: '<path d="M10 10v28M10 24h16M26 10v28M33 18c0-2.5 2-4 4.5-4S42 15.5 42 18c0 2-1 3.5-2.5 5L33 30h9"/>',
        heading3: '<path d="M10 10v28M10 24h16M26 10v28M33 16h9l-5 6c3 .5 5 2.7 5 5.5 0 3.3-2.7 5.5-6.5 5.5-3 0-5.4-1.2-6.5-3"/>',
        blockquote: '<path d="M12 16h10v10H12zM26 16h10v10H26zM14 26c0 6-2.5 9.5-7 12M28 26c0 6-2.5 9.5-7 12"/>',

        // Link / Back
        removeLink : '<path d="M16 24h16M19 34.221h-3.731C9.598 34.221 5 29.624 5 23.952c0-5.177 3.83-9.459 8.812-10.166M35.798 33.734c4.138-1.325 7.134-5.204 7.134-9.782 0-5.671-4.598-10.268-10.269-10.268h-3.731M7 7l34 34"/>',
        confirmLink : '<path d="M16 24h16M19 34.221h-3.731C9.598 34.221 5 29.624 5 23.952c0-5.671 4.598-10.268 10.269-10.268H19M28.932 34.221h3.731c5.671 0 10.269-4.597 10.269-10.269 0-5.671-4.598-10.268-10.269-10.268h-3.731"/>',
        link: '<path d="M16 24h16M19 34.221h-3.731C9.598 34.221 5 29.624 5 23.952c0-5.671 4.598-10.268 10.269-10.268H19M28.932 34.221h3.731c5.671 0 10.269-4.597 10.269-10.269 0-5.671-4.598-10.268-10.269-10.268h-3.731"/>',

        back: '<path d="M17 24h16M23 33.9L13.1 24l9.9-9.9"/>',

        color: '<g transform="translate(5 5)"><circle cx="15" cy="11" r="3" fill="currentColor"/><circle cx="23" cy="11" r="3" fill="currentColor"/><circle cx="29" cy="17" r="3" fill="currentColor"/><circle cx="9" cy="17" r="3" fill="currentColor"/><path stroke="currentColor" stroke-width="4.5" d="M19 0C8.444 0 0 8.444 0 19s8.444 19 19 19c1.689 0 3.167-1.478 3.167-3.167 0-.844-.211-1.477-.845-2.11-.422-.634-.844-1.267-.844-2.112 0-1.689 1.478-3.167 3.166-3.167h3.8C33.356 27.444 38 22.8 38 16.89 38 7.6 29.556 0 19 0z"/></g>',

        textColor: '<rect class="line" width="26" height="4" x="11" y="37" fill="currentColor" rx="2"/><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4.5"><path d="M14 31l9.03-19.995a1 1 0 011.821-.004L34 31h0M19 22.5h10"/></g>',
        backgroundColor: '<path d="M30.816 7.946l8.836 8.836-17.09 19.679-11.425-11.424zM12.299 35.299L8.718 38.88"/><path d="M30.157 38.88h10" class="line" />'
    };

    const defaults = {
        document: null,
        window: null,
        textarea: false,
        timeout: null,
        onBlur: null,

        options: {
            autoInit: true,
            theme: "light",
            output: false,
            html: false,
            toolbar: [
                "bold",
                "italic",
                "underline",
                "strikeThrough",
                "format",
                "align",
                "unorderedList",
                "orderedList",
                "color",
                "link"
            ],
            formats: [
                "bigTitle",
                "mediumTitle",
                "smallTitle",
                "blockquote"
            ],
            colors: [
                "#199AA8",
                "#ABD356",
                "#F9C909",
                "#F45945",
                "#222C3A",
                "#4A5360",
                "#727985",
                "#99A0AB",
                "#C1C6D0"
            ],
            labels: {
                back: "Back",
                indexPanel: "inLine editor toolbar",
                bold: "Bold",
                italic: "Italic",
                underline: "Underline",
                strikeThrough: "Strike",
                unorderedList: "Unordered list",
                orderedList: "Ordered list",
                format: "Format",
                formatPanel: "Format panel",
                bigTitle: "Big title",
                mediumTitle: "Medium title",
                smallTitle: "Small title",
                blockquote: "Blockquote",
                align: "Align",
                alignment: "Text alignment",
                alignPanel: "Align panel",
                justifyLeft: "Left",
                justifyCenter: "Center",
                justifyRight: "Right",
                justifyFull: "Justified",
                link: "Link",
                color: "Color",
                colorPanel: "Color panel",
                colorPalette: "Color palette",
                textColor: "Text color",
                backgroundColor: "Background color",
                linkPlaceholder: "Your link here",
                linkPanel: "Link panel",
                removeLink: "Remove link",
                confirmLink: "Confirm link",
                removeStyle: "Remove style"
            },
            onChange: false,
            onReady: false,
            onDestroy: false,
            onToolbarOpen: false,
            onToolbarClose: false,
            onSave: false,
            autosaveOn: true,
            pasteAsPlainText: true,
            sanitizeHTML: false // Optional DOMPurify-backed sanitizer for untrusted HTML
        }
    };

    const Events = {
        _map: new Map(),

        on(node, events, handler, capture = false) {
            if (!node || !events || typeof handler !== "function") return;

            events.split(/\s+/).filter(Boolean).forEach((evt) => {
                const parts = evt.split(".");
                const event = parts[0] || "";
                const ns = parts[1] || "";

                if (!event) return;

                const rec = { event, ns, handler, capture };
                if (!this._map.has(node)) this._map.set(node, []);
                this._map.get(node).push(rec);
                node.addEventListener(event, handler, capture);
            });
        },

        onMany(nodes, events, handler, capture = false) {
            (nodes || []).forEach((node) => this.on(node, events, handler, capture));
        },

        off(node, filter) {
            if (!node || !this._map.has(node)) return;

            const records = this._map.get(node);
            const removeListener = (r) => {
                node.removeEventListener(r.event, r.handler, r.capture);
            };

            if (!filter) {
                records.forEach(removeListener);
                this._map.delete(node);
                return;
            }

            let eventFilter = "";
            let nsFilter = "";

            if (filter.indexOf(".") === 0) {
                nsFilter = filter.slice(1);
            } else if (filter.indexOf(".") > -1) {
                const parts = filter.split(".");
                eventFilter = parts[0] || "";
                nsFilter = parts[1] || "";
            } else {
                eventFilter = filter;
            }

            const keep = [];

            for (let i = 0; i < records.length; i++) {
                const rec = records[i];
                const eventMatch = eventFilter ? rec.event === eventFilter : true;
                const nsMatch = nsFilter ? rec.ns === nsFilter : true;

                if (eventMatch && nsMatch) {
                    removeListener(rec);
                } else {
                    keep.push(rec);
                }
            }

            if (keep.length) this._map.set(node, keep);
            else this._map.delete(node);
        }
    };

    const Editor = {
        uuid: guid(),
        trigger: null,
        output: null,
        overlay: null,
        iframe: null, // kept for compatibility
        toolbar: null,
        dropdown: null,
        selection: null,
        savedRange: null,
        iDocument: null,
        content: "",
        _isDestroyed: false,
        _saveTimer: null,
        _saveInFlight: false,
        _savePending: false,
        _savedRevision: 0,
        _savePromise: null,
        _flushWaiters: [],
        _lastSaveSucceeded: true,
        dirty: false,
        _revision: 0,
        _lastNotifiedContent: null,
        _initialAttributes: null,
        _tooltips: new Set(),
        _tooltipCleanups: new Set(),

        set: function (options) {
            if (this._isDestroyed || !options) return;
            const previousAutosave = defaults.options.autosaveOn;
            const previousOptions = defaults.options;
            defaults.options = mergeOptions(defaults.options, options);
            if (previousAutosave && !defaults.options.autosaveOn && this._saveTimer) {
                defaults.window.clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }
            if (!defaults.options.autosaveOn) this._savePending = false;
            if (!previousOptions.autosaveOn && defaults.options.autosaveOn && this.dirty && typeof defaults.options.onSave === "function") {
                this._scheduleSave();
            }
            // A form-only editor has no persistence handler: never display save status.
            if (typeof defaults.options.onSave !== "function") {
                if (this._saveTimer) defaults.window.clearTimeout(this._saveTimer);
                this._saveTimer = null;
                this._savePending = false;
                this.trigger.classList.remove("il__modified", "il__saving", "il__saved", "il__save_error");
            } else if (typeof previousOptions.onSave !== "function" && this.dirty) {
                this.trigger.classList.add("il__modified");
                if (defaults.options.autosaveOn) this._scheduleSave();
            }
            // Switch the active theme without closing the toolbar or losing the selection.
            [this.toolbar, this.dropdown].filter(Boolean).forEach(function (root) {
                [root, ...root.querySelectorAll(".il__panel, .il__dropdown")].forEach(function (el) {
                    el.classList.remove("il--light", "il--dark", "il--purple");
                    el.classList.add("il--" + defaults.options.theme);
                });
            });
        },

        destroy: function () {
            if (this._isDestroyed) return;
            this._isDestroyed = true;
            if (this._saveTimer) defaults.window.clearTimeout(this._saveTimer);
            // Pending asynchronous requests may still finish server-side; never claim
            // they were canceled. Call await editor.flush() before destroy if needed.
            this._flushWaiters.splice(0).forEach(waiter => waiter(false));
            if (defaults.timeout) defaults.window.clearTimeout(defaults.timeout);
            if (this.dropdown) this.dropdown.exit();
            if (this.toolbar) this.toolbar.remove();
            this.toolbar = null;
            Events.off(defaults.document, ".inline");
            Events.off(defaults.document, ".inlineDropdown");
            Events.off(defaults.window, ".inline");
            Events.off(defaults.window, ".inlineToolbar");
            Events.off(defaults.window, ".inlineDropdown");
            Events.off(this.trigger, ".inline");
            Events.off(this.trigger, ".inlineToolbar");
            this._tooltipCleanups.forEach((cleanup) => cleanup());
            this._tooltips.forEach((el) => el.remove());
            this._tooltips.clear();
            if (this.overlay) this.overlay.remove();
            if (defaults.textarea) {
                if (this.trigger) this.trigger.remove();
                if (this.output) {
                    this.output.style.display = this._initialAttributes.display;
                    this.output.classList.remove("il__editor", "il__output");
                }
            } else if (this.trigger && this._initialAttributes) {
                const old = this._initialAttributes;
                if (old.contenteditable === null) this.trigger.removeAttribute("contenteditable");
                else this.trigger.setAttribute("contenteditable", old.contenteditable);
                if (old.spellcheck === null) this.trigger.removeAttribute("spellcheck");
                else this.trigger.setAttribute("spellcheck", old.spellcheck);
                this.trigger.style.display = old.display;
                this.trigger.classList.remove("il__editor", "il__trigger", "il__modified", "il__saved", "il__saving", "il__save_error", "il__focus");
            }
            // The original plugin stores instances under 'inLine' for both API aliases.
            if (typeof jQuery !== "undefined" && (this.output || this.trigger)) {
                jQuery.removeData(this.output || this.trigger, "inLine");
            }
            notifyCallback("onDestroy", this);
            this.dropdown = this.overlay = this.iframe = this.iDocument = null;
            this.trigger = this.output = this.selection = this.savedRange = null;
        },

        // The HTML snapshot and external change notification have separate contracts.
        // No synthetic change event is dispatched for init or unchanged commits.
        commitChange: function () {
            if (this._isDestroyed || !this.trigger) return;
            this.updateContent();
            if (this.content === this._lastNotifiedContent) return;
            this._lastNotifiedContent = this.content;
            this._revision += 1;
            this.dirty = true;
            // Save-status classes apply only when the editor owns persistence.
            // In a form, the parent form is responsible for saving.
            if (typeof defaults.options.onSave === "function") {
                this.trigger.classList.add("il__modified");
                this.trigger.classList.remove("il__saved", "il__save_error");
            } else {
                this.trigger.classList.remove("il__modified", "il__saving", "il__saved", "il__save_error");
            }
            if (this.output) this._dispatchChange();
            if (typeof defaults.options.onSave === "function" && defaults.options.autosaveOn) this._scheduleSave();
            notifyCallback("onChange", this);
        },

        _scheduleSave: function () {
            if (this._saveTimer) defaults.window.clearTimeout(this._saveTimer);
            this._saveTimer = defaults.window.setTimeout(() => {
                this._saveTimer = null;
                if (defaults.options.autosaveOn) this._performSave();
            }, 1000);
        },

        // Resolve true only once the newest revision has been saved successfully.
        // Failure resolves false: the integrator decides whether to retry or block navigation.
        flush: function () {
            if (this._isDestroyed || !this.trigger) return Promise.resolve(false);
            if (this._saveTimer) {
                defaults.window.clearTimeout(this._saveTimer);
                this._saveTimer = null;
            }
            if (!this.dirty && !this._saveInFlight) return Promise.resolve(true);
            if (typeof defaults.options.onSave !== "function") return Promise.resolve(false);
            const promise = new Promise(resolve => this._flushWaiters.push(resolve));
            this._performSave(true);
            return promise;
        },

        save: function () { return this.flush(); },

        _resolveFlushWaiters: function (value) {
            this._flushWaiters.splice(0).forEach(resolve => resolve(value));
        },

        _performSave: function (manual = false) {
            if (this._isDestroyed || !this.trigger || typeof defaults.options.onSave !== "function") {
                this._resolveFlushWaiters(false);
                return;
            }
            if (!manual && !defaults.options.autosaveOn) return;
            if (this._saveInFlight) {
                // Do not send a duplicate revision; wait until in-flight save resolves.
                this._savePending = this._savePending || this._revision > this._savedRevision;
                return;
            }
            if (!this.dirty) {
                this._resolveFlushWaiters(true);
                return;
            }
            const revision = this._revision;
            const content = this.content;
            this._saveInFlight = true;
            this.trigger.classList.add("il__saving");
            let request;
            try {
                request = defaults.options.onSave(this, content);
            } catch (error) {
                request = Promise.reject(error);
            }
            this._savePromise = Promise.resolve(request).then(
                value => this._finishSave(value !== false, revision),
                () => this._finishSave(false, revision)
            );
        },

        _finishSave: function (success, revision) {
            if (this._isDestroyed || !this.trigger) return;
            this._saveInFlight = false;
            this._savePromise = null;
            this.trigger.classList.remove("il__saving");
            this._lastSaveSucceeded = success;
            if (success) this._savedRevision = Math.max(this._savedRevision, revision);
            this.dirty = this._savedRevision < this._revision;
            if (this._revision === revision) {
                this.trigger.classList.toggle("il__saved", success);
                this.trigger.classList.toggle("il__save_error", !success);
                this.trigger.classList.toggle("il__modified", !success);
            }
            const mustFlush = this._flushWaiters.length > 0;
            const shouldContinue = this.dirty && (this._savePending || mustFlush || (defaults.options.autosaveOn && this._revision !== revision && !this._saveTimer));
            this._savePending = false;
            if (shouldContinue && (success || this._revision !== revision)) {
                if (!this._saveTimer) this._performSave(mustFlush);
            } else if (mustFlush) {
                this._resolveFlushWaiters(!this.dirty && success);
            }
        },

        init: function (element, options) {
            const self = this;

            const ownerDocument = resolveDocument(element);
            const ownerWindow = getDocumentWindow(ownerDocument);

            this.trigger = (
                element &&
                (
                    isHTMLElement(element, ownerWindow)
                        ? element
                        : ownerDocument.querySelector(element)
                )
            );

            if (!this.trigger) {
                console.error("Invalid selector, inLine must be initialized on a textarea or div/span.");
                return;
            }

            const tagName = this.trigger.tagName;
            if (!["TEXTAREA", "DIV", "SPAN"].includes(tagName)) {
                console.error("TinyInlineEditor supports only textarea, div or span elements.");
                return;
            }
            this._initialAttributes = {
                contenteditable: this.trigger.getAttribute("contenteditable"),
                spellcheck: this.trigger.getAttribute("spellcheck"),
                display: this.trigger.style.display
            };
            // Reject bad settings before attaching DOM state or listeners.
            if (options) defaults.options = mergeOptions(defaults.options, options);
            this.trigger.classList.add("il__editor");

            defaults.document = this.trigger.ownerDocument;
            defaults.window = getDocumentWindow(defaults.document);

            if (tagName && ["TEXTAREA", "DIV", "SPAN"].includes(tagName)) {
                switch (tagName) {
                    case "TEXTAREA":
                        defaults.textarea = true;
                        this.output = this.trigger;
                        this.trigger = defaults.document.createElement("div");
                        this.trigger.innerHTML = sanitizeInput(this.output.value);
                        this.trigger.classList.add("il__trigger");
                        this.output.parentNode.insertBefore(this.trigger, this.output.nextSibling);
                        this.output.classList.add("il__output");
                        this.output.style.display = "none";
                        break;

                    case "SPAN":
                        this.trigger.style.display = "block";
                    // falls through
                    case "DIV":
                        this.trigger.setAttribute("contenteditable", "true");
                        this.trigger.classList.add("il__trigger");
                        defaults.options.output &&
                        (this.output = defaults.document.querySelector(defaults.options.output));
                        break;
                }

                if (defaults.options.html) this.trigger.innerHTML = sanitizeInput(defaults.options.html);
                else if (!defaults.textarea && typeof defaults.options.sanitizeHTML === "function") {
                    this.trigger.innerHTML = sanitizeInput(this.trigger.innerHTML);
                }

                this.updateContent();

                this._lastNotifiedContent = this.content;
                Events.on(this.trigger, "input.inline", function () {
                    self.commitChange();
                });
                if (defaults.options.pasteAsPlainText) {
                    Events.on(this.trigger, "paste.inline", function (ev) {
                        const plain = ev.clipboardData && ev.clipboardData.getData("text/plain");
                        if (typeof plain !== "string") return;
                        ev.preventDefault();
                        // Keep the normal browser undo stack where execCommand supports it.
                        restoreOrSaveCaret();
                        if (!execCommand("insertText", plain)) {
                            const selection = getNativeSelection();
                            if (selection && selection.rangeCount) {
                                const range = selection.getRangeAt(0);
                                if (rangeInsideTrigger(range)) {
                                    range.deleteContents();
                                    range.insertNode(defaults.document.createTextNode(plain));
                                    range.collapse(false);
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                }
                            }
                        }
                        self.commitChange();
                    });
                }

                Events.on(this.trigger, "focusin.inline focusout.inline", function (e) {
                    self.trigger.classList.toggle("il__focus", e.type === "focusin");
                });

                this.overlay = createOverlay();
                this.iframe = this.overlay; // compatibility alias

                if (defaults.options.autoInit) initialize();
                notifyCallback("onReady", this);
            } else {
                console.error("Invalid selector, you can initialize inLine only on textarea or div/span tags.");
            }
        },

        updateContent: function () {
            if (!this.trigger || this._isDestroyed) return;
            this.content = this.trigger.innerHTML;
            if (this.output) {
                if ("value" in this.output) this.output.value = this.content;
                else this.output.innerHTML = this.content;
            }
        },

        _dispatchChange: function () {
            if (!this.output) return;
            const Ev = defaults.window.Event;
            this.output.dispatchEvent(new Ev("change", { bubbles: true }));
        },

        setContent: function (html) {
            if (this._isDestroyed || !this.trigger) return;
            this.trigger.innerHTML = sanitizeInput(html);
            this.commitChange();
        },

        showFrame: function (visible) {
            if (this.overlay) this.overlay.style.display = visible ? "block" : "none";
        },

        dropDownExit: function () {
            if (this.dropdown && typeof this.dropdown.exit === "function") {
                this.dropdown.exit();
            }
        }
    };

    function resolveDocument(element) {
        if (typeof document !== "undefined") {
            if (element && element.ownerDocument) return element.ownerDocument;
            return document;
        }
        return null;
    }

    function getDocumentWindow(doc) {
        return doc ? (doc.defaultView || doc.parentWindow) : window;
    }

    function guid() {
        const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
    }

    function svgContent(inner) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="4.5">${inner}</g></svg>`;
    }

    function execCommand(commandId, value) {
        try {
            return defaults.document.execCommand(commandId, false, value);
        } catch (_) {
            return false;
        }
    }

    function queryCommandState(commandId) {
        try {
            return !!defaults.document.queryCommandState(commandId);
        } catch (_) {
            return false;
        }
    }

    function debounce(fn, wait) {
        let t = null;
        const delay = typeof wait === "number" ? wait : 150;

        return function () {
            const args = arguments;
            const ctx = this;

            if (t) defaults.window.clearTimeout(t);
            t = defaults.window.setTimeout(function () {
                fn.apply(ctx, args);
            }, delay);
        };
    }

    function isHTMLElement(value, ownerWindow) {
        const win = ownerWindow || defaults.window || window;
        const HTMLElementCtor = win && win.HTMLElement ? win.HTMLElement : HTMLElement;
        try {
            return value instanceof HTMLElementCtor;
        } catch (_) {
            return !!(value && value.nodeType === 1 && typeof value.style === "object");
        }
    }

    function createElement(tagName, options) {
        const element = defaults.document.createElement(tagName);
        const opts = options || {};

        Object.keys(opts).forEach(function (key) {
            const value = opts[key];

            switch (key) {
                case "html":
                    element.innerHTML = value;
                    break;
                case "text":
                    element.textContent = value;
                    break;
                case "class":
                    element.className = value;
                    break;
                case "style":
                    Object.keys(value || {}).forEach(function (prop) {
                        element.style[prop] = value[prop];
                    });
                    break;
                case "value":
                    element.value = value;
                    break;
                case "tabIndex":
                    element.tabIndex = value;
                    break;
                default:
                    if (value !== false && value != null) element.setAttribute(key, value);
                    break;
            }
        });

        return element;
    }
    // Only documented configuration keys can be copied; never traverse untrusted prototypes.
    // Throws before mutating the currently active configuration.
    function isValidColor(value) {
        return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);
    }

    function mergeOptions(base, patch) {
        if (patch == null) return { ...base, labels: { ...base.labels } };
        if (Object.prototype.toString.call(patch) !== "[object Object]") {
            throw new TypeError("TinyInlineEditor: options must be an object");
        }
        const next = { ...base, labels: { ...base.labels } };
        const controls = new Set(["bold", "italic", "underline", "strikeThrough", "format", "align", "unorderedList", "orderedList", "color", "link"]);
        const formats = new Set(["bigTitle", "mediumTitle", "smallTitle", "blockquote"]);
        const allowed = Object.keys(base);
        const forbidden = new Set(["__proto__", "prototype", "constructor"]);
        for (const key of Object.keys(patch)) {
            if (forbidden.has(key) || !allowed.includes(key)) continue;
            const value = patch[key];
            if (key === "labels") {
                if (Object.prototype.toString.call(value) !== "[object Object]") throw new TypeError("TinyInlineEditor: labels must be an object");
                for (const label of Object.keys(value)) {
                    if (forbidden.has(label) || !Object.prototype.hasOwnProperty.call(base.labels, label)) continue;
                    if (typeof value[label] !== "string") throw new TypeError("TinyInlineEditor: invalid label " + label);
                    next.labels[label] = value[label];
                }
            } else if (key === "theme") {
                if (!["light", "dark", "purple"].includes(value)) throw new TypeError("TinyInlineEditor: invalid theme");
                next[key] = value;
            } else if (key === "toolbar" || key === "formats") {
                const whitelist = key === "toolbar" ? controls : formats;
                if (!Array.isArray(value) || value.some(item => !whitelist.has(item))) throw new TypeError("TinyInlineEditor: invalid " + key);
                next[key] = [...value];
            } else if (key === "colors") {
                if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !isValidColor(item))) {
                    throw new TypeError("TinyInlineEditor: invalid colors");
                }
                next.colors = [...value];
            } else if (["autoInit", "autosaveOn", "pasteAsPlainText"].includes(key)) {
                if (typeof value !== "boolean") throw new TypeError("TinyInlineEditor: invalid " + key);
                next[key] = value;
            } else if (["html", "output"].includes(key)) {
                if (value !== false && value !== null && typeof value !== "string") throw new TypeError("TinyInlineEditor: invalid " + key);
                next[key] = value;
            } else if (key === "sanitizeHTML") {
                if (value !== false && typeof value !== "function") throw new TypeError("TinyInlineEditor: sanitizeHTML must be a function or false");
                next[key] = value;
            } else if (key.startsWith("on")) {
                if (value !== false && typeof value !== "function") throw new TypeError("TinyInlineEditor: invalid callback " + key);
                next[key] = value;
            }
        }
        return next;
    }

    function sanitizeInput(html) {
        const sanitizer = defaults.options.sanitizeHTML;
        if (typeof sanitizer !== "function") return String(html);
        const result = sanitizer(String(html));
        if (typeof result !== "string") throw new TypeError("TinyInlineEditor: sanitizeHTML must return a string");
        return result;
    }

    function notifyCallback(name, ...args) {
        const callback = defaults.options[name];
        if (typeof callback !== "function") return;
        try {
            callback(...args);
        } catch (error) {
            // Client callback failure must not corrupt the editor or prevent saving.
            defaults.window.setTimeout(() => { console.error("TinyInlineEditor " + name + " callback failed", error); }, 0);
        }
    }

    function isTouchEnable() {
        const nav = defaults.window.navigator || navigator;
        return (
            "ontouchstart" in defaults.window ||
            (nav.maxTouchPoints || 0) > 0 ||
            (nav.msMaxTouchPoints || 0) > 0
        );
    }

    function addRumbleEffect(el) {
        if (!el) return;
        el.classList.add("il--rumble");
        defaults.window.setTimeout(function () {
            el.classList.remove("il--rumble");
        }, 300);
    }

    function nodeContains(parent, child) {
        return !!(parent && child && (parent === child || parent.contains(child)));
    }

    function rangeInsideTrigger(range) {
        if (!range || !Editor.trigger) return false;
        const node = range.commonAncestorContainer || range.startContainer;
        return !!(node && nodeContains(Editor.trigger, range.startContainer) && nodeContains(Editor.trigger, range.endContainer));
    }

    function cloneRangeSafe(range) {
        if (!range || typeof range.cloneRange !== "function") return null;
        try {
            return range.cloneRange();
        } catch (_) {
            return null;
        }
    }

    function getNativeSelection() {
        return defaults.window.getSelection ? defaults.window.getSelection() : null;
    }

    function saveSelection() {
        const sel = getNativeSelection();
        if (!sel || sel.rangeCount === 0) return null;

        const range = sel.getRangeAt(0);
        if (!rangeInsideTrigger(range)) return null;

        Editor.savedRange = cloneRangeSafe(range);
        return Editor.savedRange;
    }

    function restoreOrSaveCaret() {
        const selection = getNativeSelection();
        if (selection && selection.rangeCount && rangeInsideTrigger(selection.getRangeAt(0))) {
            Editor.savedRange = cloneRangeSafe(selection.getRangeAt(0));
        } else {
            restoreSelection();
        }
    }

    function restoreSelection() {
        if (!Editor.savedRange) return false;

        try {
            Editor.trigger.focus();

            const sel = getNativeSelection();
            if (!sel) return false;

            sel.removeAllRanges();
            sel.addRange(Editor.savedRange);
            return true;
        } catch (_) {
            return false;
        }
    }

    function clearSelection() {
        const sel = getNativeSelection();
        if (!sel) return;

        if (sel.empty) sel.empty();
        else if (sel.removeAllRanges) sel.removeAllRanges();
        Editor.selection = null;
    }

    function getRangeContextNode(range) {
        if (!range) return null;
        const node = range.startContainer || range.commonAncestorContainer;
        return node && node.nodeType === 3 ? node.parentNode : node;
    }

    function getEditorRange(allowSaved) {
        const sel = getNativeSelection();

        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (!range.collapsed && rangeInsideTrigger(range)) {
                return range;
            }
        }

        if (allowSaved && Editor.savedRange && !Editor.savedRange.collapsed && rangeInsideTrigger(Editor.savedRange)) {
            return Editor.savedRange;
        }

        return null;
    }

    function getSelectionData(allowSaved) {
        const range = getEditorRange(!!allowSaved);
        if (!range) return false;

        const rect = range.getBoundingClientRect();
        const text = range.toString();

        return {
            text: text,
            offset: rect,
            node: getRangeContextNode(range),
            range: range
        };
    }

    function getCurrentContextNode() {
        const live = getSelectionData(false);
        if (live && live.node) return live.node;

        if (Editor.savedRange) return getRangeContextNode(Editor.savedRange);
        return null;
    }

    function getCSSProperty(element, prop) {
        if (!isHTMLElement(element, defaults.window)) return "";
        return defaults.window.getComputedStyle(element, null).getPropertyValue(prop);
    }

    function findNodeByTagName(element, tagName) {
        if (!element || !Editor.trigger) return false;

        const needle = String(tagName).toLowerCase();
        let node = element;

        while (node && node !== Editor.trigger) {
            if (node.tagName && node.tagName.toLowerCase() === needle) return node;
            node = node.parentNode;
        }

        return (node === Editor.trigger && node.tagName && node.tagName.toLowerCase() === needle) ? node : false;
    }

    function nodeMatchTag(node, tagName) {
        return !!findNodeByTagName(node, tagName);
    }

    function unwrapNode(element) {
        if (!element || !element.parentNode) return;

        const parent = element.parentNode;
        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }
        element.remove();
    }

    function onScroll() {
        if (!this || !this.parentNode) return;
        const maxScrollLeft = Math.max(0, this.scrollWidth - this.clientWidth);
        const hasOverflow = maxScrollLeft > 1;
        const scrollLeft = Math.max(0, Math.round(this.scrollLeft));
        if (hasOverflow) {
            this.parentNode.classList.toggle("il__panel--left", scrollLeft > 1);
            this.parentNode.classList.toggle("il__panel--right", scrollLeft < maxScrollLeft - 1);
        } else {
            this.parentNode.classList.remove("il__panel--left");
            this.parentNode.classList.remove("il__panel--right");
        }
    }

    function setButtonColor(button, rgbColor) {
        if (!button) return;

        button.classList.remove("il--light");
        button.style.color = "";

        if (
            rgbColor &&
            rgbColor !== "rgba(0, 0, 0, 0)" &&
            rgbColor !== "rgb(0, 0, 0)"
        ) {
            button.classList.toggle("il--light", !isBrightColor(rgbColor));
            button.style.color = rgbColor;
        }
    }

    function parseColor(color) {
        let match;
        const p = parseInt;
        const normalized = String(color || "").replace(/\s/g, "");

        if ((match = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})?$/.exec(normalized))) {
            return [
                p(match[1], 16),
                p(match[2], 16),
                p(match[3], 16),
                match[4] ? p(match[4], 16) / 255 : 1
            ];
        }

        if ((match = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])?$/.exec(normalized))) {
            return [
                p(match[1], 16) * 17,
                p(match[2], 16) * 17,
                p(match[3], 16) * 17,
                match[4] ? (p(match[4], 16) * 17) / 255 : 1
            ];
        }

        if ((match = /^rgba\(([\d]+),([\d]+),([\d]+),([\d]*\.?[\d]+)\)$/.exec(normalized))) {
            return [+match[1], +match[2], +match[3], +match[4]];
        }

        if ((match = /^rgb\(([\d]+),([\d]+),([\d]+)\)$/.exec(normalized))) {
            return [+match[1], +match[2], +match[3], 1];
        }

        throw new Error(color + " is not supported by parseColor");
    }

    function rgba2hexa(color, backgroundColor) {
        if (!color) return false;
        if (String(color).charAt(0) === "#") return color;

        let rgba = parseColor(color);
        let red = rgba[0];
        let green = rgba[1];
        let blue = rgba[2];
        let alpha = typeof rgba[3] === "number" ? rgba[3] : 1;

        if (backgroundColor && alpha < 1) {
            const bg = parseColor(backgroundColor);
            red = Math.round(alpha * red + (1 - alpha) * bg[0]);
            green = Math.round(alpha * green + (1 - alpha) * bg[1]);
            blue = Math.round(alpha * blue + (1 - alpha) * bg[2]);
            alpha = 1;
        }

        const rgbHex = [red, green, blue]
            .map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0"))
            .join("");

        const alphaHex = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
            .toString(16)
            .padStart(2, "0");

        return "#" + rgbHex + alphaHex;
    }

    function getColorBrightness(colorHex) {
        const hex = String(colorHex).replace("#", "");
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    function isBrightColor(color) {
        try {
            return getColorBrightness(rgba2hexa(color, "#ffffff")) > 155;
        } catch (_) {
            return true;
        }
    }

    function createOverlay() {
        let overlay;
        {
            overlay = createElement("div", {
                id: guid(),
                class: "il__frame",
                style: {
                    position: "fixed",
                    width: "100%",
                    height: "100%",
                    border: 0,
                    top: 0,
                    left: 0,
                    display: "none",
                    pointerEvents: "none"
                }
            });

            defaults.document.body.appendChild(overlay);
        }

        initOverlay();
        return overlay;
    }

    function initOverlay() {
        const iDocument = defaults.document;

        defaults.onBlur = function (ev) {
            if (!Editor.toolbar) return;

            const target = ev.target;
            const inToolbar = Editor.toolbar && (target === Editor.toolbar || Editor.toolbar.contains(target));
            const inDropdown = Editor.dropdown && (target === Editor.dropdown || Editor.dropdown.contains(target));
            const inTrigger = Editor.trigger && (target === Editor.trigger || Editor.trigger.contains(target));

            if (!inToolbar && !inDropdown && !inTrigger) {
                hideToolbar();
            }
        };

        Events.off(iDocument, "mousedown.inline");
        Events.on(iDocument, "mousedown.inline", defaults.onBlur);

        if ("contentEditable" in Editor.trigger) {
            Editor.trigger.contentEditable = "true";
        }

        Editor.iDocument = iDocument;
    }

    function createPanel(panelOptions) {
        const panel = createElement("div", {
            class: `il__panel il__panel--${panelOptions.id} ${panelOptions.class || ""} il--${defaults.options.theme}`,
            "aria-label": panelOptions.label,
            tabIndex: 0
        });

        const panelContainer = createElement("div", {
            class: CLASS.panelContainer
        });

        panel.appendChild(panelContainer);

        defaults.window.setTimeout(function () {
            panelContainer.addEventListener("scroll", onScroll);
            onScroll.call(panelContainer);
        }, 10);

        return panel;
    }

    function updateToolbarPosition() {
        if (!Editor.toolbar) return;

        const selection = getSelectionData(true);
        if (!selection) return;

        const panelEl = Editor.toolbar.querySelector(".il__panel." + CLASS.visible + ":not(.il--hidden)");
        if (!panelEl) return;

        const toolBarRect = panelEl.getBoundingClientRect();
        const pos = {
            top: selection.offset.top + selection.offset.height + 4,
            left: selection.offset.left + selection.offset.width / 2
        };

        if (pos.left - toolBarRect.width / 2 < 0) {
            pos.left = toolBarRect.width / 2 + 16;
        }

        if (pos.left + toolBarRect.width / 2 > defaults.window.innerWidth) {
            pos.left = defaults.window.innerWidth - toolBarRect.width / 2 - 16;
        }

        if (pos.top + toolBarRect.height > defaults.window.innerHeight) {
            pos.top = selection.offset.top - toolBarRect.height - 4;
        }

        if (pos.top < 0) pos.top = 16;

        Editor.toolbar.style.top = pos.top + "px";
        Editor.toolbar.style.left = pos.left + "px";
    }

    function removeToolBarEvents() {
        Events.off(defaults.window, ".inlineToolbar");
        Events.off(defaults.document, ".inlineToolbar");
        Events.off(Editor.trigger, ".inlineToolbar");
        Editor._tooltipCleanups.forEach((cleanup) => cleanup());
        notifyCallback("onToolbarClose", Editor);
    }

    function addToolbarEvents() {
        const debouncedUpdate = debounce(function () {
            if (Editor.toolbar) {
                updateToolbarPosition();
                Editor.toolbar.classList.add(CLASS.visible);
            }
        }, 80);
        Events.on(defaults.window, "resize.inlineToolbar", updateToolbarPosition);
        // Scroll does not bubble from arbitrary overflow containers. Capture at
        // document level also catches modal / nested scroll containers.
        Events.on(defaults.document, "scroll.inlineToolbar", function (event) {
            if (!Editor.toolbar || Editor.dropdown) return;
            if (Editor.toolbar.contains(event.target)) return; // internal toolbar scroller
            Editor.toolbar.classList.remove(CLASS.visible);
            debouncedUpdate();
        }, true);
        Events.on(defaults.window, "scroll.inlineToolbar", debouncedUpdate);

        const openingToolbar = Editor.toolbar;
        defaults.window.setTimeout(function () {
            if (Editor.toolbar !== openingToolbar || Editor._isDestroyed) return;
            updateToolbarPosition();
            Editor.toolbar.classList.add(CLASS.visible);
            notifyCallback("onToolbarOpen", Editor, getSelectionData(true));
        }, 10);
    }

    function hideToolbar(callback) {
        if (!Editor.toolbar) {
            if (typeof callback === "function") callback();
            return;
        }

        if (Editor.dropdown) Editor.dropDownExit();

        const toolbar = Editor.toolbar;
        Editor.toolbar = null;

        toolbar.classList.remove(CLASS.visible);
        removeToolBarEvents();
        Editor.showFrame(false);

        defaults.window.setTimeout(function () {
            toolbar.remove();
            if (typeof callback === "function") callback();
        }, 250);
    }

    function displayToolBarPanel() {
        const selection = getSelectionData(false);

        if (!selection || !selection.text) {
            hideToolbar();
            return;
        }

        saveSelection();
        Editor.selection = selection;

        if (Editor.dropdown) Editor.dropDownExit();

        if (Editor.toolbar) {
            const oldToolbar = Editor.toolbar;
            Editor.toolbar = null;
            removeToolBarEvents();
            oldToolbar.remove();
        }

        Editor.toolbar = createElement("div", {
            class: "il__toolbar il--" + defaults.options.theme,
            role: "toolbar",
            "aria-label": defaults.options.labels.indexPanel
        });

        Editor.toolbar.appendChild(createIndexPanel());
        Editor.iDocument.body.appendChild(Editor.toolbar);

        addToolbarEvents();
        Editor.showFrame(true);
    }
    function showTooltip(obj) {
        if (isTouchEnable()) return;
        if (!Editor.iDocument || !Editor.toolbar) return;

        const targetRect = obj.target ? obj.target.getBoundingClientRect() : null;
        if (!targetRect) return;

        const toolbarRect = Editor.toolbar.getBoundingClientRect();
        const tooltipEl = createElement("div", {
            class: "il__tooltip il--" + defaults.options.theme,
            text: obj.text
        });

        Editor.iDocument.body.appendChild(tooltipEl);
        Editor._tooltips.add(tooltipEl);
        tooltipEl.style.position = "fixed";

        tooltipEl.style.top =
            targetRect.top + targetRect.height + tooltipEl.offsetHeight + 8 > defaults.window.innerHeight
                ? (toolbarRect.top - tooltipEl.offsetHeight - 8) + "px"
                : (targetRect.top + targetRect.height) + "px";

        tooltipEl.style.left = (targetRect.left + targetRect.width / 2) + "px";

        defaults.window.setTimeout(function () {
            tooltipEl.classList.add(CLASS.visible);
        }, 10);

        const cleanup = function () {
            tooltipEl.classList.remove(CLASS.visible);
            defaults.window.setTimeout(function () {
                    tooltipEl.remove();
                    Editor._tooltips.delete(tooltipEl);
                }, 300);

            obj.target.removeEventListener("mouseleave", cleanup);
            Editor.iDocument.removeEventListener("mousedown", cleanup);
            Editor._tooltipCleanups.delete(cleanup);
        };

        Editor._tooltipCleanups.add(cleanup);
        obj.target.addEventListener("mouseleave", cleanup);
        Editor.iDocument.addEventListener("mousedown", cleanup);
    }


    function getClosestBlockCandidate(node) {
        if (!node || !Editor.trigger) return null;

        let current = node;

        while (current && current !== Editor.trigger) {
            if (
                current.nodeType === 1 &&
                /^(H1|H2|H3|BLOCKQUOTE|DIV|P|LI)$/i.test(current.tagName)
            ) {
                return current;
            }
            current = current.parentNode;
        }

        return null;
    }

    function getCurrentBlockTag() {
        const node = getCurrentContextNode();
        // Quotes are wrappers; their child <p> is not the active structural format.
        if (node && findNodeByTagName(node, "blockquote")) return "blockquote";
        const block = getClosestBlockCandidate(node);
        return block && block.tagName ? block.tagName.toLowerCase() : null;
    }

    function toggleBlockFormat(tagName) {
        if (!restoreSelection()) return false;

        const node = getCurrentContextNode();
        const currentTag = getCurrentBlockTag();
        const targetTag = String(tagName).toLowerCase();

        if (["h1", "h2", "h3", "blockquote"].includes(targetTag)) {
            if (nodeMatchTag(node, "ul")) execCommand("insertUnorderedList");
            if (nodeMatchTag(node, "ol")) execCommand("insertOrderedList");
        }

        if (targetTag === "blockquote" && currentTag === "blockquote") {
            // formatBlock('<div>') on an inner <p> produces nested quotes in Chromium.
            // Remove the existing semantic wrapper instead; its children are retained.
            const quote = findNodeByTagName(node, "blockquote");
            if (quote && quote !== Editor.trigger) unwrapNode(quote);
        } else if (currentTag === targetTag) {
            execCommand("formatBlock", "<div>");
        } else {
            execCommand("formatBlock", `<${targetTag}>`);
        }
        saveSelection();
        Editor.commitChange();
        return true;
    }

        function updateButtonCommandState(buttonEl, obj) {
        let state = false;
        const node = getCurrentContextNode();

        if (!node) {
            buttonEl.classList.remove("il--active");
            buttonEl.setAttribute("aria-pressed", "false");
            return;
        }

        if (typeof obj.isActive === "function") {
            state = !!obj.isActive();
            buttonEl.classList.toggle("il--active", state);
            buttonEl.setAttribute("aria-pressed", String(state));
            return;
        }

        if (obj.command) {
            switch (obj.command) {
                case "insertUnorderedList":
                    state = nodeMatchTag(node, "ul");
                    break;
                case "insertOrderedList":
                    state = nodeMatchTag(node, "ol");
                    break;
                case "bold":
                    state = nodeMatchTag(node, "strong") || nodeMatchTag(node, "b");
                    break;
                case "underline":
                    state = !nodeMatchTag(node, "a") && queryCommandState("underline");
                    break;
                default:
                    state = queryCommandState(obj.command);
                    break;
            }
        }

        if (obj.blockTag) {
            state = getCurrentBlockTag() === obj.blockTag.toLowerCase();
        }

        buttonEl.classList.toggle("il--active", !!state);
        buttonEl.setAttribute("aria-pressed", String(!!state));
    }

    function createButton(obj) {
        const button = createElement("button", {
            class: `il__button il__button--${obj.id}${obj.class ? ' '+obj.class:''}${obj.custom ? ' il__button--multi':''}`,
            tabIndex: 0,
            "aria-label": obj.label,
            role: "button",
            "aria-pressed": "false",
            html: obj.svg ? svgContent(obj.svg) : obj.html
        });

        button.addEventListener("mousedown", function (e) {
            e.preventDefault();
        });

        updateButtonCommandState(button, obj);

        if (obj.label) {
            button.addEventListener("mouseenter", function () {
                showTooltip({ text: obj.label, target: button });
            });
        }

        button.addEventListener("click", function () {
            if (Editor.dropdown && !Editor.dropdown.contains(button)) {
                Editor.dropdown.exit();
            }

            if (typeof obj.onclick === "function") {
                obj.onclick(button);
            }

            if (obj.blockTag) {
                toggleBlockFormat(obj.blockTag);
                updateButtonCommandState(button, obj);
                hideToolbar();
                return;
            }

            if (obj.command) {
                restoreSelection();
                execCommand("styleWithCSS", false);
                execCommand(obj.command, null);
                saveSelection();
                Editor.commitChange();
                updateButtonCommandState(button, obj);
            }
        });

        return button;
    }

    function createBackButton(onClickCallback) {
        return createButton({
            svg: icons.back,
            label: defaults.options.labels.back,
            id: "back",
            onclick: onClickCallback
        });
    }

     function displayDropdown(obj) {
         const boundRect = obj.target.getBoundingClientRect();
         const scrollX = defaults.window.pageXOffset || defaults.window.scrollX || 0;
         const scrollY = defaults.window.pageYOffset || defaults.window.scrollY || 0;

         const dropdownContent = createElement("div", {
             class: `il__dropdown il__dropdown--${obj.id} ${obj.class || ""} il--${defaults.options.theme}`,
             "aria-label": obj.label,
             role: "dialog",
             "aria-modal": "false",
             tabIndex: -1
         });

         if (obj.append) obj.append(dropdownContent);
         Editor.iDocument.body.appendChild(dropdownContent);

         defaults.window.setTimeout(function () {
             dropdownContent.focus();
         }, 10);

         (function () {
             const dropdownRect = dropdownContent.getBoundingClientRect();

             let position = {
                 top: boundRect.top + boundRect.height + scrollY,
                 left: boundRect.left + (boundRect.width / 2) + scrollX
             };

             if (position.left - (dropdownRect.width / 2) < scrollX + 16) {
                 position.left = scrollX + (dropdownRect.width / 2) + 16;
             }

             if (position.left + (dropdownRect.width / 2) > scrollX + defaults.window.innerWidth - 16) {
                 position.left = scrollX + defaults.window.innerWidth - (dropdownRect.width / 2) - 16;
             }

             if (position.top + dropdownRect.height + 32 > scrollY + defaults.window.innerHeight) {
                 position.top = boundRect.top + scrollY - dropdownRect.height - 16;
             }

             if (position.top < scrollY + 16) {
                 position.top = scrollY + 16;
             }

             dropdownContent.style.top = position.top + "px";
             dropdownContent.style.left = position.left + "px";
         })();

         function dropdownClose() {
             if (Editor.dropdown !== dropdownContent) return;

             Editor.dropdown = null;
             dropdownContent.classList.remove(CLASS.visible);
             obj.target.classList.remove("il--open");
             obj.target.setAttribute("aria-pressed", "false");

             Events.off(defaults.window, ".inlineDropdown");
             Events.off(Editor.iDocument, ".inlineDropdown");
             Events.off(dropdownContent, ".inlineDropdown");
             defaults.window.setTimeout(function () {
                 dropdownContent.remove();
             }, 250);
         }

         Object.defineProperty(dropdownContent, "exit", {
             value: dropdownClose,
             configurable: true
         });

         Events.on(Editor.iDocument, "mousedown.inlineDropdown", function (e) {
             const target = e.target;
             const insideTarget = target === obj.target || obj.target.contains(target);
             const insideDropdown = target === dropdownContent || dropdownContent.contains(target);

             if (!insideTarget && !insideDropdown) {
                 dropdownClose();
             }
         });

         Events.on(defaults.document, "scroll.inlineDropdown", function (event) {
             if (dropdownContent.contains(event.target) || dropdownContent.contains(defaults.document.activeElement) || defaults.document.activeElement === obj.target) return;
             dropdownClose();
         }, true);
         Events.on(defaults.window, "scroll.inlineDropdown", function () {
             if (dropdownContent.contains(defaults.document.activeElement) || defaults.document.activeElement === obj.target) return;
             dropdownClose();
         });

         Events.on(defaults.window, "resize.inlineDropdown", function () {
             dropdownClose();
         });
         Events.on(dropdownContent, "keydown.inlineDropdown", function (event) {
             if (event.key === "Escape") {
                 event.preventDefault();
                 dropdownClose();
                 obj.target.focus();
             }
         });

         defaults.window.setTimeout(function () {
             dropdownContent.classList.add(CLASS.visible);
         }, 10);

         return dropdownContent;
     }

    function displayColorsDropDown(obj) {
        if (obj.target.classList.contains("il--open")) {
            obj.target.classList.remove("il--open");
            obj.target.setAttribute("aria-pressed", "false");
            Editor.dropDownExit();
            return;
        }

        saveSelection();

        function execStyleColor(color) {
            const value = String(color || "").trim();
            if (!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
                const input = Editor.dropdown && Editor.dropdown.querySelector("input.il__input");
                if (input) {
                    input.setAttribute("aria-invalid", "true");
                    addRumbleEffect(input);
                    input.focus();
                }
                return;
            }
            const input = Editor.dropdown && Editor.dropdown.querySelector("input.il__input");
            if (input) input.removeAttribute("aria-invalid");
            restoreSelection();
            execCommand("styleWithCSS", true);
            execCommand(obj.command, value);
            saveSelection();
            setButtonColor(obj.target, value);
                Editor.commitChange();
            }

            obj.target.classList.add("il--open");
        obj.target.setAttribute("aria-pressed", "true");

        Editor.dropdown = displayDropdown({
            label: defaults.options.labels.colorPalette,
            target: obj.target,
            id: "color",
            append: function (content) {
                const colorInput = createElement("input", {
                    class: "il__input",
                    placeholder: "#000000"
                });

                colorInput.addEventListener("keypress", function (e) {
                    if (e.key === "Enter" || e.keyCode === 13) {
                        execStyleColor(this.value);
                    }
                });

                content.appendChild(colorInput);

                const groupPanel = createElement("div", { class: "il__group" });
                content.appendChild(groupPanel);

                const resetButton = createElement("button", {
                    class: "il--resetStyle",
                    "aria-label": defaults.options.labels.removeStyle
                });

                resetButton.addEventListener("mousedown", function (e) {
                    e.preventDefault();
                });

                resetButton.addEventListener("click", function () {
                    restoreSelection();
                    execCommand("styleWithCSS", true);
                    execCommand(obj.command, "inherit");
                    saveSelection();
                    colorInput.value = "";
                    obj.target.setAttribute("style", "");
                    setButtonColor(obj.target, "");
                        Editor.commitChange();
                    });

                    resetButton.addEventListener("mouseenter", function () {
                    showTooltip({ text: defaults.options.labels.removeStyle, target: resetButton });
                });

                groupPanel.appendChild(resetButton);

                defaults.options.colors.forEach(function (color) {
                    const colorButton = createElement("button", { "aria-label": color });
                    colorButton.style.color = color;

                    colorButton.addEventListener("mousedown", function (e) {
                        e.preventDefault();
                    });

                    colorButton.addEventListener("click", function () {
                        colorInput.value = color;
                        execStyleColor(color);
                    });

                    groupPanel.appendChild(colorButton);
                });
            }
        });
    }

    function isSafeLink(href) {
        const trimmed = String(href || "").trim();
        if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
        try {
            const url = new URL(trimmed, defaults.document.baseURI);
            // A relative URL has no explicit scheme and is safe even in a file:// demo.
            // Explicit schemes are allowlisted to rule out javascript:, data:, etc.
            const explicitScheme = /^[a-z][a-z0-9+.-]*:/i.exec(trimmed);
            return !explicitScheme || ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
        } catch (_) {
            return false;
        }
    }

    function createLinkButton(obj) {
        obj.onclick = function (buttonLink) {
            const currentNode = getCurrentContextNode();
            const linkNode = currentNode && findNodeByTagName(currentNode, "a");
            const isSelectionLink = !!linkNode;

            if (buttonLink.classList.contains("il--open")) {
                buttonLink.classList.remove("il--open");
                Editor.dropDownExit();
                return;
            }

            saveSelection();

            buttonLink.classList.add("il--open");
            buttonLink.setAttribute("aria-pressed", "true");

            Editor.dropdown = displayDropdown({
                label: defaults.options.labels.linkPanel,
                target: buttonLink,
                id: "link",
                append: function (dropdownLink) {
                    const linkInput = createElement("input", {
                        class: "il__input",
                        value: linkNode ? (linkNode.getAttribute("href") || "") : "",
                        placeholder: defaults.options.labels.linkPlaceholder
                    });

                    function closeAll() {
                        if (Editor.dropdown) Editor.dropdown.exit();
                        hideToolbar();
                    }

                    function onConfirm() {
                        const linkHref = (linkInput.value || "").trim();

                        if (!isSafeLink(linkHref)) {
                            linkInput.setAttribute("aria-invalid", "true");
                            linkInput.focus();
                            addRumbleEffect(linkInput);
                            return;
                        }

                        linkInput.removeAttribute("aria-invalid");
                        restoreSelection();

                        if (isSelectionLink && linkNode && linkNode.isConnected) {
                            linkNode.setAttribute("href", linkHref);
                        } else {
                            execCommand("CreateLink", linkHref);
                        }

                        saveSelection();
                        Editor.commitChange();
                        closeAll();
                    }

                    linkInput.addEventListener("keypress", function (e) {
                        if (e.key === "Enter" || e.keyCode === 13) onConfirm();
                        if (e.key === "Escape" || e.keyCode === 27) Editor.dropDownExit();
                    });

                    dropdownLink.appendChild(linkInput);

                    defaults.window.setTimeout(function () {
                        linkInput.focus();
                    }, 10);

                    const footer = createElement("div", { class: "il__footer" });
                    dropdownLink.appendChild(footer);

                    const footerButtons = {
                        cancel: {
                            visible: isSelectionLink,
                            id: "cancel",
                            label: defaults.options.labels.removeLink,
                            svg: icons.removeLink,
                            onclick: function () {
                                if (linkNode && linkNode.isConnected) {
                                    unwrapNode(linkNode);
                                        Editor.commitChange();
                                    }
                                    closeAll();
                            }
                        },
                        confirm: {
                            visible: true,
                            id: "confirm",
                            label: defaults.options.labels.confirmLink,
                            svg: icons.confirmLink,
                            onclick: onConfirm
                        }
                    };

                    Object.keys(footerButtons).forEach(function (name) {
                        const def = footerButtons[name];
                        if (def.visible) footer.appendChild(createButton(def));
                    });
                }
            });
        };

        const buttonLink = createButton({ ...obj, svg: icons.link });
        const currentNode = getCurrentContextNode();

        if (currentNode && nodeMatchTag(currentNode, "a")) {
            buttonLink.classList.add("il--active");
            buttonLink.setAttribute("aria-pressed", "true");
        }

        return buttonLink;
    }

    // Shared navigation/focus/transition for Color, Format and Align panels.
    function openSubPanel(config) {
        const parent = config.parent;
        if (!Editor.toolbar) return null;
        parent.classList.add(CLASS.hidden);
        const panel = createPanel({ id: config.id, label: config.label });
        const back = createBackButton(function () {
            panel.classList.remove(CLASS.visible);
            defaults.window.setTimeout(() => panel.remove(), 250);
            if (Editor.toolbar && parent.isConnected) {
                parent.classList.remove(CLASS.hidden);
                parent.focus();
                if (config.onBack) config.onBack();
            }
        });
        panel.querySelector("." + CLASS.panelContainer).appendChild(back);
        Editor.toolbar.appendChild(panel);
        if (config.render) config.render(panel.querySelector("." + CLASS.panelContainer));
        defaults.window.setTimeout(() => {
            if (!panel.isConnected || !Editor.toolbar) return;
            panel.classList.add(CLASS.visible);
            panel.focus();
            if (config.onOpen) config.onOpen();
        }, 25);
        return panel;
    }

    function createColorButton(obj) {
        const colorPanelCommands = {
            textColor: {
                class: "il--unstyled il--colorPicker",
                id: "textColor",
                label: defaults.options.labels.textColor,
                property: "color",
                svg: icons.textColor,
                onclick: function (target) {
                    displayColorsDropDown({
                        id: "textColor",
                        target: target,
                        command: "foreColor",
                        property: "color"
                    });
                }
            },
            backgroundColor: {
                class: "il--unstyled il--colorPicker",
                id: "backgroundColor",
                label: defaults.options.labels.backgroundColor,
                property: "background-color",
                svg: icons.backgroundColor,
                onclick: function (target) {
                    displayColorsDropDown({
                        id: "backgroundColor",
                        target: target,
                        command: "hiliteColor",
                        property: "background-color"
                    });
                }
            }
        };
        obj.onclick = function () {
            openSubPanel({
                parent: obj.panel, id: obj.id, label: defaults.options.labels.colorPanel,
                render(container) {
                    const node = getCurrentContextNode();
                    Object.keys(colorPanelCommands).forEach(function (commandName) {
                        const cmd = colorPanelCommands[commandName];
                        const colorPickerButton = createButton(cmd);
                        if (node) setButtonColor(colorPickerButton, getCSSProperty(node, cmd.property));
                        container.appendChild(colorPickerButton);
                    });
                }
            });
        };

        return createButton(obj);
    }


     function createFormatButton(obj) {
         const formatCommands = {
             bigTitle: {
                 id: "bigTitle",
                 label: defaults.options.labels.bigTitle,
                 svg: icons.heading1,
                 blockTag: "h1"
             },
             mediumTitle: {
                 id: "mediumTitle",
                 label: defaults.options.labels.mediumTitle,
                 svg: icons.heading2,
                 blockTag: "h2"
             },
             smallTitle: {
                 id: "smallTitle",
                 label: defaults.options.labels.smallTitle,
                 svg: icons.heading3,
                 blockTag: "h3"
             },
             blockquote: {
                 id: "blockquote",
                 label: defaults.options.labels.blockquote,
                 svg: icons.blockquote,
                 blockTag: "blockquote"
             }
         };

         obj.isActive = function () {
             const currentBlockTag = getCurrentBlockTag();
             return ["h1", "h2", "h3", "blockquote"].includes(currentBlockTag);
         };

         function syncMainFormatIcon(button) {
             const currentBlockTag = getCurrentBlockTag();

             if (currentBlockTag === "h1") {
                 button.innerHTML = svgContent(icons.heading1);
             } else if (currentBlockTag === "h2") {
                 button.innerHTML = svgContent(icons.heading2);
             } else if (currentBlockTag === "h3") {
                 button.innerHTML = svgContent(icons.heading3);
             } else if (currentBlockTag === "blockquote") {
                 button.innerHTML = svgContent(icons.blockquote);
             } else {
                 button.innerHTML = svgContent(icons.format);
             }
         }

         obj.svg = icons.format;

         obj.onclick = function (button) {
             const sync = () => {
                 syncMainFormatIcon(button);
                 updateButtonCommandState(button, obj);
             };
             openSubPanel({
                 parent: obj.panel, id: obj.id, label: defaults.options.labels.formatPanel,
                 onBack: sync, onOpen: sync,
                 render(container) {
                     defaults.options.formats.forEach(function (key) {
                         const command = formatCommands[key];
                         const formatButton = createButton(command);
                         formatButton.addEventListener("click", sync);
                         container.appendChild(formatButton);
                     });
                 }
             });
         };

         const formatButton = createButton(obj);
         syncMainFormatIcon(formatButton);
         updateButtonCommandState(formatButton, obj);

         return formatButton;
     }

    function createAlignButton(obj) {
        const alignCommands = {
            justifyLeft: {
                id: "justifyLeft",
                label: defaults.options.labels.justifyLeft,
                svg: icons.alignLeft,
                command: "justifyLeft"
            },
            justifyCenter: {
                id: "justifyCenter",
                label: defaults.options.labels.justifyCenter,
                svg: icons.alignCenter,
                command: "justifyCenter"
            },
            justifyRight: {
                id: "justifyRight",
                label: defaults.options.labels.justifyRight,
                svg: icons.alignRight,
                command: "justifyRight"
            },
            justifyFull: {
                id: "justifyFull",
                label: defaults.options.labels.justifyFull,
                svg: icons.alignFull,
                command: "justifyFull"
            }
        };

        let currentCommand = "justifyLeft";

        Object.keys(alignCommands).forEach(function (command) {
            if (queryCommandState(command)) currentCommand = command;
        });

        obj.svg = alignCommands[currentCommand].svg;

        obj.onclick = function (button) {
            openSubPanel({
                parent: obj.panel, id: obj.id, label: defaults.options.labels.alignPanel,
                render(container) {
                    Object.keys(alignCommands).forEach(function (key) {
                        const command = alignCommands[key];
                        command.onclick = function () { button.innerHTML = svgContent(command.svg); };
                        container.appendChild(createButton(command));
                    });
                }
            });
        };

        return createButton(obj);
    }

    function createCustomButton(obj) {
        switch (obj.id) {
            case "format":
                return createFormatButton(obj);
            case "align":
                return createAlignButton(obj);
            case "link":
                return createLinkButton(obj);
            case "color":
                return createColorButton(obj);
            default:
                return null;
        }
    }

    function createIndexPanel() {
        const indexCommands = {
            bold: {
                id: "bold",
                command: "bold",
                label: defaults.options.labels.bold,
                svg: icons.bold
            },
            italic: {
                id: "italic",
                command: "italic",
                label: defaults.options.labels.italic,
                svg: icons.italic
            },
            underline: {
                id: "underline",
                command: "underline",
                label: defaults.options.labels.underline,
                svg: icons.underline
            },
            strikeThrough: {
                id: "strikeThrough",
                command: "strikeThrough",
                label: defaults.options.labels.strikeThrough,
                svg: icons.strikeThrough
            },
            unorderedList: {
                id: "unorderedList",
                command: "insertUnorderedList",
                label: defaults.options.labels.unorderedList,
                svg: icons.unorderedList,
                onclick: function () {
                    const olBtn = Editor.toolbar && Editor.toolbar.querySelector(".il__button--orderedList");
                    if (olBtn) {
                        olBtn.classList.remove("il--active");
                        olBtn.setAttribute("aria-pressed", "false");
                    }
                }
            },
            orderedList: {
                id: "orderedList",
                command: "insertOrderedList",
                label: defaults.options.labels.orderedList,
                svg: icons.orderedList,
                onclick: function () {
                    const ulBtn = Editor.toolbar && Editor.toolbar.querySelector(".il__button--unorderedList");
                    if (ulBtn) {
                        ulBtn.classList.remove("il--active");
                        ulBtn.setAttribute("aria-pressed", "false");
                    }
                }
            },
            format: {
                id: "format",
                label: defaults.options.labels.format,
                custom: true
            },
            align: {
                id: "align",
                label: defaults.options.labels.align,
                custom: true
            },
            link: {
                id: "link",
                label: defaults.options.labels.link,
                svg: icons.link,
                custom: true
            },
            color: {
                id: "color",
                label: defaults.options.labels.color,
                html: svgContent(icons.color),
                custom: true,
            }
        };

        const indexPanel = createPanel({
            id: "index",
            label: defaults.options.labels.indexPanel,
            class: CLASS.visible
        });

        defaults.options.toolbar.forEach(function (id) {
            const command = indexCommands[id];
            if (!command) return;

            command.panel = indexPanel;
            const button = command.custom ? createCustomButton(command) : createButton(command);
            if (button) {
                indexPanel.querySelector("." + CLASS.panelContainer).appendChild(button);
            }
        });

        return indexPanel;
    }

    function initialize() {
        if (isTouchEnable()) {
            Events.on(defaults.document, "selectionchange.inline", function (ev) {
                if (!Editor || !Editor.trigger) return;

                if (defaults.timeout) defaults.window.clearTimeout(defaults.timeout);

                defaults.timeout = defaults.window.setTimeout(function () {
                    const active = defaults.document.activeElement;
                    if (active === Editor.trigger || nodeContains(Editor.trigger, active)) {
                        displayToolBarPanel();
                    }
                }, 250);
            });
        }

        Events.on(Editor.trigger, "mouseup.inline keyup.inline", function (ev) {
            if (ev.type === "keyup" && ev.key === "Meta") {
                ev.preventDefault();
                return;
            }

            if (defaults.timeout) defaults.window.clearTimeout(defaults.timeout);

            defaults.timeout = defaults.window.setTimeout(function () {
                displayToolBarPanel();
            }, 10);
        });
    }

    Editor.init(arguments[0], arguments[1]);
    return Editor;
}
// Original direct factory name retained for integrations that called it directly.
function inlineEditor(element, options) {
    return TinyInlineEditor(element, options);
}

/* ============================================================================
 * jQuery Plugin Wrapper (public API unchanged)
 * ========================================================================== */
(function ($) {
    const plugin_name = "inLine";
    // Shallow merge at the jQuery boundary: no user-controlled recursive merge.
    // Validation and typed copying occur inside TinyInlineEditor.init().
    function mergePluginOptions(...parts) {
        const result = Object.create(null);
        for (const part of parts) {
            if (part == null) continue;
            if (Object.prototype.toString.call(part) !== "[object Object]") throw new TypeError("TinyInlineEditor: invalid options");
            for (const key of Object.keys(part)) {
                if (["__proto__", "prototype", "constructor"].includes(key)) continue;
                if (key === "labels") {
                    if (Object.prototype.toString.call(part[key]) !== "[object Object]") throw new TypeError("TinyInlineEditor: invalid labels");
                    const labels = Object.assign(Object.create(null), result.labels || {});
                    for (const label of Object.keys(part[key])) {
                        if (!["__proto__", "constructor", "prototype"].includes(label)) labels[label] = part[key][label];
                    }
                    result.labels = labels;
                } else {
                    result[key] = part[key];
                }
            }
        }
        return result;
    }

    $.fn[plugin_name] = function (options) {
        if (options === undefined || typeof options === "object") {
            return this.each(function () {
                const $this = $(this);

                if (!$this.data(plugin_name)) {
                    const opts = {};

                    if ($this.data("url")) {
                        opts.onSave = function (api) {
                            const payload = {
                                [$this.data("name") || $this.attr("name") || "value"]: api.content
                            };
                            if ($this.data("idName")) payload[$this.data("idName")] = $this.data("id");
                            return $.ajax({
                                url: $this.data("url"),
                                data: $.param(payload),
                                dataType: "json",
                                type: $this.data("method") || "POST",
                                cache: false
                            }).then(
                                function (resolve) {
                                    return resolve && resolve.success === true;
                                },
                                function () {
                                    return false;
                                }
                            );
                        };
                    }

                    $.data(
                        this,
                        plugin_name,
                        new TinyInlineEditor(this, mergePluginOptions(opts, $.fn[plugin_name].settings || {}, options))
                    );
                }
            });
        }

            if (typeof options === "string") {
                const method = options;
                if (!["destroy", "set", "flush", "save", "setContent"].includes(method)) {
                    throw new Error("TinyInlineEditor: unsupported method " + method);
                }
                const args = Array.prototype.slice.call(arguments, 1);
                if (method === "flush" || method === "save") {
                    return Promise.all(this.toArray().map(element => {
                        const instance = $.data(element, plugin_name);
                        return instance ? instance[method]() : false;
                    })).then(results => results.every(Boolean));
                }
                return this.each(function () {
                    const instance = $.data(this, plugin_name);
                    if (instance && typeof instance[method] === "function") instance[method].apply(instance, args);
                });
            }
            return this;
        };

        // Descriptive new name; the historical 'inLine' method remains fully compatible.
        $.fn.tinyInlineEditor = function () {
            return $.fn[plugin_name].apply(this, arguments);
        };

        $.fn[plugin_name].settings = {
        labels: {
            back: "Retour",
            indexPanel: "Barre d'outils TinyInlineEditor",
            bold: "Gras",
            italic: "Italique",
            underline: "Souligné",
            strikeThrough: "Barré",
            unorderedList: "Liste non ordonnée",
            orderedList: "Liste ordonnée",
            format: "Format",
            formatPanel: "Panneau de format",
            bigTitle: "Grand titre",
            mediumTitle: "Titre moyen",
            smallTitle: "Petit titre",
            blockquote: "Citation",
            align: "Alignement",
            alignment: "Alignement du texte",
            alignPanel: "Panneau d'alignement",
            justifyLeft: "Gauche",
            justifyCenter: "Centre",
            justifyRight: "Droite",
            justifyFull: "Justifié",
            link: "Lien",
            color: "Couleur",
            colorPanel: "Panneau de couleurs",
            colorPalette: "Palette de couleurs",
            textColor: "Couleur du texte",
            backgroundColor: "Couleur d'arrière-plan",
            linkPlaceholder: "Votre lien ici",
            linkPanel: "Panneau de liens",
            removeLink: "Supprimer le lien",
            confirmLink: "Confirmer le lien",
            removeStyle: "Supprimer le style"
        }
        };
       })(jQuery);



