/* ==========================================================================
   File: TinySwal.js
   Version: 1.4.2

   TinySwal is a lightweight modal / toast dialog utility inspired by SweetAlert2.
   Goal: Provide a small, dependency-free API to show dialogs and toasts with:
     - Dynamic DOM: optional elements are created/removed via _updateDom()
     - Safe update(): unbind -> updateDom -> applyOptions -> bind (no duplicate listeners)
     - Toast stacking: per target + position, with automatic reposition on resize
     - Multiple outcomes: confirm / deny / delete / cancel / close / esc / backdrop / timer
     - Nested dialogs: pass `parent` as a node inside the parent popup (parent stays locked)
     - Timer + optional progress bar
     - Input support (e.g. input: "text") + async preConfirm
     - Loading state (showLoaderOnConfirm + showLoading/hideLoading)

   Public API:
     TinySwal.fire(title, text?, icon?)
     TinySwal.fire(options)
     TinySwal.getTop()
     TinySwal.closeTop(reason?)
     TinySwal.closeAll(reason?)

   Result object (Promise resolves with):
     {
       isConfirmed: boolean,
       isDenied: boolean,
       isDeleted: boolean,
       isCallToAction: boolean,
       isDismissed: boolean,
       value?: any,
       dismiss?: "cancel"|"deny"|"delete"|"close"|"esc"|"backdrop"|"timer"
     }

   Key options (non-exhaustive):
     - toast: boolean
     - position: "top"|"top-start"|"top-end"|...|"bottom-end"
     - title: string (HTML allowed if titleIsHtml or contains "<")
     - text: string
     - html: string
     - icon: "success"|"error"|"warning"|"info"|"question"
     - footer: string (HTML)
     - showConfirmButton/showCancelButton/showDenyButton/showDeleteButton/showCloseButton
     - confirmButtonText/cancelButtonText/denyButtonText/deleteButtonText
     - allowEscapeKey/allowOutsideClick/focusConfirm/showOverlay
     - timer: number (ms)
     - timerProgressBar: boolean
     - draggable: boolean
     - showCallToActionButton: boolean (toast only)
     - callToActionButtonText / callToActionButtonAriaLabel
     - callToActionUrl / callToActionTarget
     - preCallToAction: function
     - target / targetEl: HTMLElement | selector
     - parent: HTMLElement | selector (nesting signal)
     - closeOnClick: boolean (toast only; default true when toast && !showCloseButton)
     - input: "text" (basic input support)
     - inputAttributes: object (e.g. { autocapitalize: "off" })
     - inputPlaceholder, inputValue
     - showLoaderOnConfirm: boolean
     - preConfirm: async (value) => any
     - didOpen / willClose hooks

   ========================================================================== */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TinySwal = factory();
  }
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * Global CSS namespace/prefix used by TinySwal.
   * Keep this in one place so class strings remain consistent and maintainable.
   */
  const namespace = "tiny-swal-";

  /** Dismiss reasons exposed as TinySwal.DismissReason */
  const DISMISS = {
    cancel: "cancel",
    deny: "deny",
    delete: "delete",
    close: "close",
    esc: "esc",
    backdrop: "backdrop",
    timer: "timer"
  };

  /** Simple glyph mapping for semantic icons */
  const ICON_GLYPH = {
    success: "✓",
    error: "×",
    warning: "!",
    info: "i",
    question: "?"
  };

  /** Small helpers */
  const isFn = f => f && typeof f === "function";
  const isStr = s => typeof s === "string";
  const isHtml = s => typeof s === 'string' && /<[^>]+>/.test(s);

  /**
   * TinySwalInstance
   * Internal instance class representing one open popup/toast.
   */
  class TinySwalInstance {
    /**
     * @param {object} options Normalized options object
     * @param {number} stackIndex Index in global stack (z-index ordering)
     */
    constructor(options, stackIndex) {
      this.options = TinySwal._normalizeOptions(options);
      this.stackIndex = stackIndex;

      // Mode flags
      this._isToast = !!this.options.toast;

      // Promise lifecycle
      this._resolve = null;
      this.promise = new Promise((resolve) => (this._resolve = resolve));

      // State
      this._isOpen = false;
      this._previousActive = null;

      // Timer state
      this._timerId = null;
      this._timerStart = 0;
      this._timerDelay = 0;

      // Nested dialog support
      this._parent = null; // set by TinySwal.fire when nested (TinySwal parent)

      // Drag state (for draggable popup)
      this._drag = {
        enabled: false,
        pending: false,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        popupWidth: 0,
        popupHeight: 0
      };

      // Tracks whether this modal owns one document scroll lock.
      this._scrollLockAcquired = false;

      // Loading state (for async confirmations)
      this._isLoading = false;

      /**
       * Cached DOM references. Optional nodes are created/removed in _updateDom().
       * Keep all references here to avoid repeated querySelector calls.
       */
      this._els = {
        container: null,
        overlay: null,
        modal: null,
        popup: null,
        icon: null,
        body: null,
        title: null,
        content: null,
        contentBody: null,
        imageWrap: null,
        image: null,
        footer: null,
        actions: null,
        confirmBtn: null,
        denyBtn: null,
        deleteBtn: null,
        cancelBtn: null,
        callToActionBtn: null,
        closeBtn: null,
        input: null,
        loader: null,
        validation: null,
        timerBarContainer: null,
        timerBar: null,
        form: null,
      };

      // Bind event handlers once (safe add/remove listeners)
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onOverlayClick = this._onOverlayClick.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
      this._onConfirmClick = this._onConfirmClick.bind(this);
      this._onCancelClick = this._onCancelClick.bind(this);
      this._onDenyClick = this._onDenyClick.bind(this);
      this._onDeleteClick = this._onDeleteClick.bind(this);
      this._onCloseClick = this._onCloseClick.bind(this);
      this._onCallToActionClick = this._onCallToActionClick.bind(this);
      this._onToastClick = this._onToastClick.bind(this);
    }

    /**
     * Build the hook context object passed to didOpen/willClose callbacks.
     * This keeps hook signatures stable while giving access to the instance.
     */
    _getHookContext() {
      return {
        popup: this._els.popup,
        form: this._els.form,
        swal: this
      };
    }

    async _runWillOpenHook() {
      if (isFn(this.options.willOpen)) {

        const r = await this.options.willOpen.call(this, this._getHookContext());
        if (r === false) {
          this._isOpen = false;

          // Remove DOM (if mounted) to avoid leftovers
          try {
            this._els?.container?.remove?.();
          } catch (_) {
          }

          this._releaseDocumentScrollLock();
          if (this._parent) this._parent._unlock();
          TinySwal._removeInstance(this);
          this._resolve({
            isConfirmed: false,
            isDenied: false,
            isDeleted: false,
            isCallToAction: false,
            isDismissed: true,
            dismiss: DISMISS.close
          });

          return false;
        }
      }

      return true;
    }

    _show() {
      const container = this._els?.container;
      if (!container) return;

      container.classList.remove("is-closing");
      container.classList.add("is-open");
    }

    /**
     * Open the popup/toast and return its promise.
     */
    async open() {
      if (this._isOpen) return this.promise;
      this._isOpen = true;

      if (!this._isToast) {
        this._previousActive = document.activeElement;
      }

      this._buildDom();
      this._applyOptions();
      this._applyPosition();
      this._applyZIndex();

      // Mount first (DOM exists for willOpen, like Swal2)
      this._mount();

      // Bind events after mount so delegated handlers can rely on DOM
      this._bindEvents();

      // willOpen hook (DOM exists now)
      const ok = await this._runWillOpenHook();
      if (!ok) return this.promise;

      // Show after willOpen (CSS transition starts here)
      this._show();

      // Toast stacking registration
      if (this._isToast) {
        TinySwal._toastRegister(this);
      }

      // Timer (if configured)
      this._startTimerIfNeeded();

      // didOpen hook
      if (isFn(this.options.didOpen)) {
        this.options.didOpen.call(this, this._getHookContext());
      }

      // Focus handling for modal mode
      if (!this._isToast) {
        setTimeout(() => {
          const focusTarget = this._chooseInitialFocus();
          focusTarget?.focus?.();
        }, 0);
      }

      this._scheduleIconShow();
      return this.promise;
    }

    _scheduleIconShow() {
      if (!this._els?.icon) return;
      this._els.icon.classList.remove('show');
      requestAnimationFrame(() => {
        if (!this._isOpen) return;
        this._els.icon.classList.add('show');
      });
    }

    /**
     * Update options for an already open instance.
     * Pattern: unbind -> update DOM nodes -> apply options -> rebind.
     */
    update(partialOptions = {}) {
      if (!this._isOpen) return;

      const wasToast = this._isToast;

      // Unbind first: DOM structure may change
      this._unbindEvents();

      this.options = TinySwal._normalizeOptions({ ...this.options, ...partialOptions });
      this._isToast = !!this.options.toast;

      // Create/remove optional DOM nodes
      this._updateDom();

      // Apply content/attributes
      this._applyOptions();
      this._applyPosition();
      this._applyZIndex();

      // Rebind to current nodes
      this._bindEvents();

      // Ensure toast groups are correct
      if (this._isToast) {
        TinySwal._toastRegister(this);
      } else if (wasToast && !this._isToast) {
        TinySwal._toastUnregister(this);
      }
    }

    /**
     * Close the popup/toast and resolve promise with final result.
     * @param {object} result Result object, if not provided a dismiss result is used.
     */
    close(result) {
      if (!this._isOpen) return;
      this._isOpen = false;

      this._stopTimer();

      // willClose hook (bound to instance via call)
      if (isFn(this.options.willClose)) {
        this.options.willClose.call(this, this._getHookContext());
      }

      this._unbindEvents();
      this._unmount();

      if (!this._isToast) {
        this._previousActive?.focus?.();
      }

      const finalResult = result || {
        isConfirmed: false,
        isDenied: false,
        isDeleted: false,
        isCallToAction: false,
        isDismissed: true,
        dismiss: DISMISS.close
      };

      this._resolve(finalResult);
    }

    /**
     * Finalize lifecycle: remove from stack, unlock parent if nested, then close.
     */
    _finalizeAndClose(result) {
      TinySwal._removeInstance(this);
      if (this._parent) this._parent._unlock();
      this.close(result);
    }

    /** Confirm action (resolves with isConfirmed) */
    _confirm(value = true) {
      this._finalizeAndClose({
        isConfirmed: true,
        isDenied: false,
        isDeleted: false,
        isCallToAction: false,
        isDismissed: false,
        value
      });
    }

    /** Deny action (resolves with isDenied) */
    _deny(value) {
      this._finalizeAndClose({
        isConfirmed: false,
        isDenied: true,
        isDeleted: false,
        isCallToAction: false,
        isDismissed: false,
        dismiss: DISMISS.deny,
        value
      });
    }

    /** Delete action (resolves with isDeleted) */
    _delete(value) {
      this._finalizeAndClose({
        isConfirmed: false,
        isDenied: false,
        isDeleted: true,
        isCallToAction: false,
        isDismissed: false,
        dismiss: DISMISS.delete,
        value
      });
    }

    /** Call-to-action result (toast only) */
    _callToAction(value = true) {
      this._finalizeAndClose({
        isConfirmed: false,
        isDenied: false,
        isDeleted: false,
        isCallToAction: true,
        isDismissed: false,
        value
      });
    }

    /** Dismiss action with a specific reason */
    _dismiss(reason) {
      this._finalizeAndClose({
        isConfirmed: false,
        isDenied: false,
        isDeleted: false,
        isCallToAction: false,
        isDismissed: true,
        dismiss: reason
      });
    }

    _formToNestedObject(form) {
      const fd = new FormData(form);
      const out = {};

      for (const [name, raw] of fd.entries()) {
        const isFile = raw instanceof File;
        const value = isFile ? raw : String(raw);

        const path = parsePath(name);

        // We must create the structure even if empty,
        // so we pass value + a flag to indicate emptiness.
        setDeep(out, path, value, isFile);
      }

      return out;

      function parsePath(name) {
        const parts = [];
        name.replace(/^([^\[]+)|\[([^\]]*)\]/g, (_, head, key) => {
          parts.push(head ?? (key === "" ? null : key));
        });
        return parts;
      }

      function setDeep(obj, path, value, isFile) {
        let cur = obj;

        for (let i = 0; i < path.length; i++) {
          const key = path[i];
          const last = i === path.length - 1;
          const next = path[i + 1];

          if (last) {
            if (key === null) {
              // Only push non-empty values (but array container already exists)
              if (!isFile && value === "") return;
              cur.push(value);
            } else {
              cur[key] = cur[key] === undefined
                  ? value
                  : [].concat(cur[key], value);
            }
            return;
          }

          const wantArray = next === null;
          const make = () => (wantArray ? [] : {});

          if (key === null) {
            if (!Array.isArray(cur)) throw new Error("Invalid form path: [] under non-array");

            let slot = cur[cur.length - 1];
            if (
                !slot ||
                typeof slot !== "object" ||
                Array.isArray(slot) ||
                (next !== null && slot[next] !== undefined)
            ) {
              slot = make();
              cur.push(slot);
            }
            cur = slot;
          } else {
            if (cur[key] === undefined) cur[key] = make();
            cur = cur[key];
          }
        }
      }
    }

    /*
    _focusFirstInvalidControl(form) {
      const invalid = Array.from(form.elements).find(el => el.willValidate && !el.checkValidity());
      invalid?.focus({ preventScroll: true });
      invalid?.scrollIntoView({ block: "nearest" });
    }*/

    /**
     * Confirm click handler.
     * Supports:
     *   - input validation (required when input is present)
     *   - async preConfirm(value) with loader
     */
    async _onConfirmClick() {
      if (!this._isOpen) return;

      // Default "value" when no input/form is used (keeps legacy behavior)
      let inputValue = true;

      // 1) Prefer native TinySwal input (existing behavior)
      if (this._els.input) {
        const input = this._els.input;
        inputValue = input.value.trim();

        const isEmpty = !inputValue;

        // Toggle error class (namespace templating)
        input.classList.toggle(`${namespace}input-error`, isEmpty);

        if (isEmpty) {
          this.showValidationMessage("Please fill out this field");
          requestAnimationFrame(() => input.focus({ preventScroll: true }));
          return;
        }
      }

      // 2) Optional: return nested form values from a <form> inside content
      //    Runs only if there is no _els.input (because it's an else-if mode switch).
      else if (this.options.returnFormValues) {
        if (this._els.form) {
          // Build values first so validator can use them
          inputValue = this._formToNestedObject(this._els.form);

          const validateOpt = this.options.validateForm;

          // validateForm can be:
          //  - false/undefined: skip validation
          //  - true: use native form.reportValidity()
          //  - function(form, values): boolean | Promise<boolean>
          if (validateOpt) {
            const validateFn = isFn(validateOpt) ? validateOpt : (f /*, values */) => f.reportValidity();
            let validationOk = false;
            try {
              validationOk = await Promise.resolve(validateFn(this._els.form, inputValue));
            } catch (e) {
              validationOk = false;
            }
            if (!validationOk) {
              return;
            }
          }
        }
      }

      // 3) Run preConfirm if provided (async supported)
      if (isFn(this.options.preConfirm)) {
        try {
          if (this.options.showLoaderOnConfirm) this.showLoading();

          const maybe = await this.options.preConfirm.call(this, inputValue);

          // If preConfirm returns false => keep modal open
          // If user code called showValidationMessage and returned undefined, keep open
          if (maybe === false || (this._els.validation && this._els.validation.style.display !== "none" && (maybe === undefined))) {
            this.hideLoading();
            return;
          }

          // If preConfirm returns a value, prefer it; otherwise keep inputValue
          this._confirm(maybe ?? inputValue);
          return;
        } catch (err) {
          // Intentionally silent: user can call showValidationMessage from preConfirm
          // If desired, you can set a default validation message here.
        } finally {
          this.hideLoading();
        }
      }

      // 4) No preConfirm: confirm with inputValue
      this._confirm(inputValue);
    }


    _onCancelClick() { this._dismiss(DISMISS.cancel); }

    async _preAction(hook, action) {
      // No hook → execute immediately
      if (!isFn(hook)) {
        action.call(this);
        return;
      }

      try {
        if (this.options.showLoaderOnConfirm) {
          this.showLoading();
        }

        const res = await hook.call(this);

        // Explicit block
        if (res === false) return;

        action.call(this, res);

      } catch (e) {
        // Swallow to keep modal open (SweetAlert2 behavior)
      } finally {
        this.hideLoading();
      }
    }

    async _onDenyClick() {
      await this._preAction(this.options.preDeny, this._deny);
    }

    async _onDeleteClick() {
      await this._preAction(this.options.preDelete, this._delete);
    }

    /**
     * Returns the normalized CTA navigation settings.
     * @returns {{url: string, target: string}}
     */
    _getCallToActionNavigation() {
      const url = isStr(this.options.callToActionUrl)
          ? this.options.callToActionUrl.trim()
          : "";
      const target = isStr(this.options.callToActionTarget) && this.options.callToActionTarget.trim()
          ? this.options.callToActionTarget.trim()
          : "_self";

      return { url, target };
    }

    /**
     * Navigates through a temporary anchor so target and security behavior stay native.
     * @param {Document} ownerDocument Document that owns the temporary anchor.
     * @param {string} url Destination URL.
     * @param {string} target Browsing context target.
     * @param {boolean} secureNavigation Applies noopener and noreferrer behavior.
     */
    _navigateCallToAction(ownerDocument, url, target, secureNavigation = false) {
      const link = ownerDocument.createElement("a");
      link.href = url;
      link.target = target;

      if (secureNavigation) {
        link.rel = "noopener noreferrer";
      }

      link.style.display = "none";
      (ownerDocument.body || ownerDocument.documentElement).appendChild(link);
      link.click();
      link.remove();
    }

    /**
     * Opens the configured CTA URL while automatically protecting new tabs
     * from opener access and referrer leakage.
     * @param {Window|null} reservedWindow Window reserved before an async hook resolves.
     */
    _openCallToActionUrl(reservedWindow = null) {
      const { url, target } = this._getCallToActionNavigation();

      if (!url) {
        reservedWindow?.close?.();
        return;
      }

      if (reservedWindow && !reservedWindow.closed) {
        if (reservedWindow.document?.createElement) {
          this._navigateCallToAction(reservedWindow.document, url, "_self", true);
        } else {
          // Fallback for unusual browser environments where the reserved document is unavailable.
          reservedWindow.location.href = url;
        }
        return;
      }

      const opensNewTab = target.toLowerCase() === "_blank";
      this._navigateCallToAction(document, url, target, opensNewTab);
    }

    /**
     * Runs the optional CTA hook, opens the configured URL, and resolves the CTA result.
     * A blank window is reserved before awaiting an asynchronous hook so browsers do not
     * block the final navigation as an unsolicited popup.
     */
    async _onCallToActionClick() {
      const hook = this.options.preCallToAction;

      if (!isFn(hook)) {
        this._openCallToActionUrl();
        this._callToAction();
        return;
      }

      let reservedWindow = null;

      try {
        if (this.options.showLoaderOnConfirm) {
          this.showLoading();
        }

        const pendingValue = hook.call(this);
        const isAsync = pendingValue && typeof pendingValue.then === "function";
        const { url, target } = this._getCallToActionNavigation();

        // Reserve the tab while the click still has user activation.
        if (isAsync && url && target.toLowerCase() === "_blank") {
          reservedWindow = window.open("", "_blank");
          if (reservedWindow) reservedWindow.opener = null;
        }

        const value = isAsync ? await pendingValue : pendingValue;

        if (value === false) {
          reservedWindow?.close?.();
          return;
        }

        this._openCallToActionUrl(reservedWindow);
        this._callToAction(value);
      } catch (error) {
        reservedWindow?.close?.();
        // Keep the toast open when the hook rejects, matching the other pre-action hooks.
      } finally {
        this.hideLoading();
      }
    }

    _onCloseClick() { this._dismiss(DISMISS.close); }

    /**
     * Toast click handler (optional).
     * Closes toast when clicking on non-interactive areas.
     */
    _onToastClick(e) {
      if (!this._isOpen || !this._isToast || !this.options.closeOnClick) return;

      // Don't close on interactive clicks (buttons/links/inputs etc.)
      if (e.target?.closest?.("button, a, input, select, textarea, label, [role='button'], [data-no-toast-close]")) return;

      this._dismiss(DISMISS.close);
    }

    /** Lock the current instance (used for nested dialogs) */
    _lock() {
      if (!this._isOpen) return;
      this._els.container.classList.add("is-locked");
      this._els.popup.setAttribute("aria-hidden", "true");
      this._els.popup.setAttribute("inert", "");
      this._els.container.style.pointerEvents = "none";
    }

    /** Unlock the current instance (used when child closes) */
    _unlock() {
      if (!this._isOpen) return;
      this._els.container.classList.remove("is-locked");
      this._els.popup.removeAttribute("aria-hidden");
      this._els.popup.removeAttribute("inert");
      this._els.container.style.pointerEvents = "";
    }

    /** Return whether this instance is the topmost in the global stack */
    _isTopmost() {
      return TinySwal.getTop() === this;
    }

    /** Choose initial focus target for modal mode */
    _chooseInitialFocus() {
      const o = this.options;
      if (o.focusConfirm && o.showConfirmButton && this._els.confirmBtn) return this._els.confirmBtn;
      return this._els.cancelBtn || this._els.denyBtn || this._els.deleteBtn ||  this._els.popup;
    }

    /** Collect focusable elements inside popup (for focus trap) */
    _getFocusable() {
      const root = this._els.popup;
      const sel = [
        "button:not([disabled])",
        "[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",");
      return Array.from(root.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
    }

    /** Global keydown handler (Esc dismiss + Tab focus trap) */
    _onKeyDown(e) {
      if (!this._isOpen || !this._isTopmost()) return;

      if (e.key === "Escape" && this.options.allowEscapeKey) {
        e.preventDefault();
        this._dismiss(DISMISS.esc);
        return;
      }

      if (e.key === "Tab") {
        const focusables = this._getFocusable();
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    /** Overlay click dismiss (modal only) */
    _onOverlayClick() {
      if (!this._isOpen || !this._isTopmost()) return;

      const allowOutsideClick = isFn(this.options.allowOutsideClick)
          ? this.options.allowOutsideClick.call(this)
          : this.options.allowOutsideClick;

      if (allowOutsideClick) this._dismiss(DISMISS.backdrop);
    }

    /** Start auto-dismiss timer (and optional progress bar) */
    _startTimerIfNeeded() {
      if (!this.options.timer || this.options.timer <= 0) return;

      this._timerStart = Date.now();
      this._timerDelay = this.options.timer;

      if (this.options.timerProgressBar && this._els.timerBar) {
        const bar = this._els.timerBar;

        // Reset
        bar.style.transition = "none";
        bar.style.width = "100%";

        requestAnimationFrame(() => {
          void bar.offsetWidth;
          bar.style.transition = `width ${this.options.timer}ms linear`;
          bar.style.width = "0%";
        });
      }

      this._timerId = setTimeout(() => {
        if (!this._isOpen) return;
        this._dismiss(DISMISS.timer);
      }, this.options.timer);
    }

    /** Stop any running timer and reset timer bar visuals */
    _stopTimer() {
      if (this._timerId) clearTimeout(this._timerId);
      this._timerId = null;

      if (this._els.timerBar) {
        this._els.timerBar.style.transition = "none";
        this._els.timerBar.style.width = "";
      }
    }

    /** Returns remaining timer ms (0 if not running) */
    getTimerLeft() {
      if (!this._timerId || !this._timerDelay) return 0;
      const elapsed = Date.now() - this._timerStart;
      return Math.max(0, this._timerDelay - elapsed);
    }

    /** Returns the popup element */
    getPopup() { return this._els.popup;}

    getForm() { return this._els.form;}

    /**
     * Show loading indicator inside actions and hide confirm button.
     * Used typically when showLoaderOnConfirm + async preConfirm.
     */
    showLoading() {
      if (this._isLoading) return;
      this._isLoading = true;

      const actions = this._els.actions;
      if (!actions) return;

      // Hide confirm button if exists
      if (this._els.confirmBtn) {
        this._els.confirmBtn.style.display = "none";
      }

      // Create loader if not exists
      if (!this._els.loader) {
        const loader = document.createElement("div");
        loader.className = `${namespace}loader`; // keep namespaced for your CSS
        loader.style.display = "flex";
        actions.appendChild(loader);
        this._els.loader = loader;
      } else {
        this._els.loader.style.display = "flex";
      }
    }

    /**
     * Show a validation message (creates node lazily right before actions).
     */
    showValidationMessage(message) {
      if (!this._els.validation) {
        const validation = document.createElement("div");
        validation.className = `${namespace}validation`;
        this._els.body.insertBefore(validation, this._els.actions);
        this._els.validation = validation;
      }
      this._els.validation.textContent = message || "";
      this._els.validation.style.display = message ? "" : "none";
    }

    /** Hide loading indicator and restore confirm button */
    hideLoading() {
      if (!this._isLoading) return;
      this._isLoading = false;

      // Restore confirm button
      if (this._els.confirmBtn) {
        this._els.confirmBtn.style.display = "";
      }

      // Hide loader
      if (this._els.loader) {
        this._els.loader.style.display = "none";
      }
    }

    /** Returns whether instance is currently in loading state */
    isLoading() {
      return !!this._isLoading;
    }

    /** Apply z-index based on stack position */
    _applyZIndex() {
      const base = TinySwal._zIndexBase;
      const step = TinySwal._zIndexStep;
      const z = base + this.stackIndex * step;
      this._els.container.style.zIndex = String(z);
    }

    /** Apply position class used by CSS positioning rules */
    _applyPosition() {
      const pos = this.options.position;
      const c = this._els.container;
      c.classList.remove(
          "pos-top", "pos-top-start", "pos-top-end",
          "pos-center", "pos-center-start", "pos-center-end",
          "pos-bottom", "pos-bottom-start", "pos-bottom-end"
      );
      c.classList.add(`pos-${pos}`);
    }

    /**
     * Apply option values to DOM: text/html, icon glyph, input attrs, button labels, etc.
     */
    _applyOptions() {
      const o = this.options;

      if (o.width !== null && o.width !== "") {
        this._els.container.style.setProperty("--ts-width", TinySwal._cssSize(o.width));
      } else {
        this._els.container.style.removeProperty("--ts-width");
      }

      // Title
      if (o.title) {
        if (isHtml(o.title)) this._els.title.innerHTML = o.title;
        else this._els.title.textContent = o.title;
        this._els.title.style.display = "";
      } else {
        this._els.title.style.display = "none";
      }

      // Icon
      const hasIcon = this._els.icon && o.icon;
      if (this._els.icon && o.icon) {
          this._els.icon.setAttribute("data-icon", o.customIcon ? 'custom' : o.icon);
          this._els.icon.innerHTML = `<span class="${namespace}icon-glyph">${o.customIcon || ICON_GLYPH[o.icon] || ""}</span>`;
      }
      this._els.popup.classList.toggle(`${namespace}icon-${o.icon}`,hasIcon);

      // Image
      if (this._els.image && o.imageUrl) {
        this._els.image.src = o.imageUrl;
        this._els.image.alt = o.imageAlt || "";
        this._els.image.style.height = o.imageHeight
            ? TinySwal._cssSize(o.imageHeight)
            : "";
        this._els.content.style.display = "";
      }

      // Content mode classes
      this._els.content.classList.remove("content-html", "content-text", "content-input");

      // Render user content inside a stable inner node. The outer content element remains
      // the only scroll container and can also safely contain the optional image wrapper.
      const contentBody = this._els.contentBody;
      const hasImage = !!(this._els.imageWrap && o.imageUrl);
      const htmlContent = isStr(o.html) && o.html.trim() ? o.html : (isHtml(o.text) ? o.text : null);

      if (htmlContent) {
        contentBody.innerHTML = htmlContent;
        contentBody.style.display = "";
        this._els.content.style.display = "";
        this._els.content.classList.add("content-html");
        this._els.form = contentBody.querySelector(this.options.formSelector || "form");
        //if (this._els.form) this._els.form.tabIndex = 0; ? Why ??
      } else if (o.text) {
        contentBody.textContent = o.text;
        contentBody.style.display = "";
        this._els.content.style.display = "";
        this._els.content.classList.add("content-text");
      } else {
        // Do not destroy an existing input when there is no text or HTML content.
        if (!this._els.input) {
          contentBody.innerHTML = "";
          contentBody.style.display = "none";
          this._els.content.style.display = hasImage ? "" : "none";
        } else {
          contentBody.style.display = "";
          this._els.content.classList.add("content-input");
          this._els.content.style.display = "";
        }
        this._els.form = null;
      }

      // Footer
      if (this._els.footer && o.footer) this._els.footer.innerHTML = o.footer;

      // Labels (HTML allowed)
      if (this._els.confirmBtn) {
        if (isHtml(o.confirmButtonText)) this._els.confirmBtn.innerHTML = o.confirmButtonText || "OK";
        else this._els.confirmBtn.textContent = o.confirmButtonText || "OK";
        if (o.confirmButtonAriaLabel) this._els.confirmBtn.setAttribute("aria-label", o.confirmButtonAriaLabel);
      }

      if (this._els.cancelBtn) {
        if (isHtml(o.cancelButtonText)) this._els.cancelBtn.innerHTML = o.cancelButtonText || "Cancel";
        else this._els.cancelBtn.textContent = o.cancelButtonText || "Cancel";
        if (o.cancelButtonAriaLabel) this._els.cancelBtn.setAttribute("aria-label", o.cancelButtonAriaLabel);
      }

      if (this._els.denyBtn) {
        if (isHtml(o.denyButtonText)) this._els.denyBtn.innerHTML = o.denyButtonText || "Deny";
        else this._els.denyBtn.textContent = o.denyButtonText || "Deny";
        if (o.denyButtonAriaLabel) this._els.denyBtn.setAttribute("aria-label", o.denyButtonAriaLabel);
      }

      if (this._els.deleteBtn) {
        if (isHtml(o.deleteButtonText)) this._els.deleteBtn.innerHTML = o.deleteButtonText || "Delete";
        else this._els.deleteBtn.textContent = o.deleteButtonText || "Delete";
        if (o.deleteButtonAriaLabel) this._els.deleteBtn.setAttribute("aria-label", o.deleteButtonAriaLabel);
      }

      if (this._els.callToActionBtn) {
        if (isHtml(o.callToActionButtonText)) {
          this._els.callToActionBtn.innerHTML = o.callToActionButtonText || "View";
        } else {
          this._els.callToActionBtn.textContent = o.callToActionButtonText || "View";
        }

        if (o.callToActionButtonAriaLabel) {
          this._els.callToActionBtn.setAttribute("aria-label", o.callToActionButtonAriaLabel);
        } else {
          this._els.callToActionBtn.removeAttribute("aria-label");
        }
      }

      // Draggable
      this._drag.enabled = !!o.draggable;
      this._els.popup.classList.toggle("is-draggable", this._drag.enabled);

      // Actions group marker
      this._els.actions.classList.toggle(
          "no-actions",
          !o.showConfirmButton && !o.showCancelButton && !o.showDenyButton && !o.showDeleteButton
      );

      // Toast clickability is represented by a class so interactive controls keep their own cursor.
      this._els.popup.classList.toggle(
          `${namespace}clickable-toast`,
          this._isToast && this.options.closeOnClick
      );

      // Input
      if (this._els.input) {
        this._els.input.type = this.options.input || "text";
        this._els.input.value = this.options.inputValue ?? "";
        if (this.options.inputPlaceholder) this._els.input.placeholder = this.options.inputPlaceholder;

        // Apply inputAttributes
        const attrs = this.options.inputAttributes || {};
        Object.keys(attrs).forEach((k) => {
          this._els.input.setAttribute(k, String(attrs[k]));
        });

        // Ensure content is visible when input exists
        this._els.content.style.display = "";
      }
    }

    /**
     * Build the base DOM structure (static nodes), then call _updateDom()
     * to create optional nodes (icon, overlay, footer, buttons, input, etc.).
     */
    _buildDom() {
      const container = document.createElement("div");
      container.className = TinySwal._cx(`${namespace}container`, this.options.customClass?.container);

      if (this._isToast) container.classList.add(`${namespace}toast`);

      const modal = document.createElement("div");
      modal.className = TinySwal._cx(`${namespace}modal`, this.options.customClass?.modal);

      const popup = document.createElement("div");
      popup.className = TinySwal._cx(`${namespace}popup`, this.options.customClass?.popup);
      popup.setAttribute("role", this._isToast ? "alert" : "dialog");

      if (!this._isToast) popup.setAttribute("aria-modal", "true");
      else popup.setAttribute("aria-live", "polite");
      popup.tabIndex = -1;

      const body = document.createElement("div");
      body.className = TinySwal._cx(`${namespace}body`, this.options.customClass?.body);

      const title = document.createElement("div");
      title.className = TinySwal._cx(`${namespace}title`, this.options.customClass?.title);

      const content = document.createElement("div");
      content.className = TinySwal._cx(`${namespace}content`, this.options.customClass?.content);

      // Keep rendered text/HTML/input separate from media so content updates never
      // remove the image wrapper. The parent .tiny-swal-content owns scrolling.
      const contentBody = document.createElement("div");
      contentBody.className = `${namespace}content-body`;
      content.appendChild(contentBody);

      const actions = document.createElement("div");
      actions.className = `${namespace}actions`;

      body.appendChild(title);
      body.appendChild(content);
      body.appendChild(actions);

      popup.appendChild(body);
      modal.appendChild(popup);
      container.appendChild(modal);

      // Preserve this._els optional refs by updating known base refs only
      this._els.container = container;
      this._els.modal = modal;
      this._els.popup = popup;
      this._els.body = body;
      this._els.title = title;
      this._els.content = content;
      this._els.contentBody = contentBody;
      this._els.actions = actions;

      this._updateDom();
    }

    /**
     * Create or remove optional DOM nodes depending on options.
     * Ensures elements exist only when needed.
     */
    _updateDom() {
      /**
       * Ensure an action button exists/removed based on `show`.
       * @param {string} key this._els key name
       * @param {boolean} show
       * @param {string} baseClass
       * @param {string|Array} extraClass
       */
      const ensureActionButton = (key, show, baseClass, extraClass) => {
        if (show) {
          if (!this._els[key]) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = TinySwal._cx(baseClass, extraClass);
            this._els.actions.appendChild(btn);
            this._els[key] = btn;
          } else {
            this._els[key].className = TinySwal._cx(baseClass, extraClass);
          }
        } else if (this._els[key]) {
          this._els[key].remove();
          this._els[key] = null;
        }
      };

      /**
       * Ensure a generic element exists/removed based on `show`, and keep className synced.
       * @param {string} key
       * @param {boolean} show
       * @param {string} baseClass
       * @param {string|Array} extraClass
       * @param {function} createFn
       * @param {function} onDeleteFn optional cleanup hook
       */
      const ensureElement = (key, show, baseClass, extraClass, createFn, onDeleteFn) => {
        if (show) {
          if (!this._els[key]) {
            this._els[key] = createFn();
          }
          this._els[key].className = TinySwal._cx(baseClass, extraClass);
        } else if (this._els[key]) {
          this._els[key].remove();
          this._els[key] = null;
          if (isFn(onDeleteFn)) onDeleteFn.call(this);
        }
      };

      // --- ACTION BUTTONS ---
      ensureActionButton("denyBtn",    !!this.options.showDenyButton,    `${namespace}deny`,    this.options.customClass?.denyButton);
      ensureActionButton("deleteBtn",  !!this.options.showDeleteButton,  `${namespace}delete`,  this.options.customClass?.deleteButton);
      ensureActionButton("cancelBtn",  !!this.options.showCancelButton,  `${namespace}cancel`,  this.options.customClass?.cancelButton);
      ensureActionButton("confirmBtn", !!this.options.showConfirmButton, `${namespace}confirm`, this.options.customClass?.confirmButton);

      // --- TOAST CALL-TO-ACTION BUTTON (sibling placed directly after body) ---
      ensureElement(
          "callToActionBtn",
          this._isToast && !!this.options.showCallToActionButton,
          `${namespace}call-to-action`,
          this.options.customClass?.callToActionButton,
          () => {
            const button = document.createElement("button");
            button.type = "button";
            this._els.body.insertAdjacentElement("afterend", button);
            return button;
          }
      );

      // Hide actions container if empty
      if (this._els.actions) {
        const hasButtons = !!(this._els.denyBtn || this._els.deleteBtn || this._els.cancelBtn || this._els.confirmBtn);
        this._els.actions.style.display = hasButtons ? "" : "none";
      }

      // --- CLOSE BUTTON (in popup) ---
      ensureElement(
          "closeBtn",
          !!this.options.showCloseButton,
          `${namespace}close`,
          this.options.customClass?.closeButton,
          () => {
            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.setAttribute("aria-label", "Close");
            closeBtn.innerHTML = "&times;";
            this._els.popup.appendChild(closeBtn);
            return closeBtn;
          }
      );

      // --- FOOTER (in body) ---
      ensureElement(
          "footer",
          !!this.options.footer,
          `${namespace}footer`,
          this.options.customClass?.footer,
          () => {
            const footer = document.createElement("div");
            this._els.body.appendChild(footer);
            return footer;
          }
      );

      // --- IMAGE (inside the scrollable content area) ---
      if (!!this.options.imageUrl) {
        if (!this._els.imageWrap) {
          const imageWrap = document.createElement("div");
          const image = document.createElement("img");
          imageWrap.appendChild(image);

          // Keep the title and actions fixed. Large images scroll together with the
          // central content instead of expanding or scrolling the entire popup body.
          this._els.content.insertBefore(imageWrap, this._els.contentBody);
          this._els.imageWrap = imageWrap;
          this._els.image = image;
        }

        // sync classes
        this._els.imageWrap.className = TinySwal._cx(`${namespace}image-wrap`, this.options.customClass?.imageWrap);
        this._els.image.className = TinySwal._cx(`${namespace}image`, this.options.customClass?.image);

        // sync src
        this._els.image.src = this.options.imageUrl;
      } else if (this._els.imageWrap) {
        this._els.imageWrap.remove();
        this._els.imageWrap = null;
        this._els.image = null;
      }

      // --- OVERLAY (disabled in toast mode) ---
      const shouldShowOverlay = !!this.options.showOverlay && !this._isToast;
      ensureElement(
          "overlay",
          shouldShowOverlay,
          `${namespace}overlay`,
          this.options.customClass?.overlay,
          () => {
            const overlay = document.createElement("div");
            this._els.container.insertBefore(overlay, this._els.modal);
            return overlay;
          }
      );

      // --- ICON (first child in popup) ---
      ensureElement(
          "icon",
          !!this.options.icon,
          `${namespace}icon`,
          this.options.customClass?.icon,
          () => {
            const icon = document.createElement("div");
            this._els.popup.insertBefore(icon, this._els.popup.firstChild);
            return icon;
          }
      );

      // --- TIMER PROGRESS BAR (last element in popup) ---
      const shouldShowTimerBar = !!this.options.timerProgressBar && !!this.options.timer && this.options.timer > 0;
      ensureElement(
          "timerBarContainer",
          shouldShowTimerBar,
          "tt-timer-progress-bar-container",
          this.options.customClass?.timerProgressBarContainer,
          () => {
            const container = document.createElement("div");
            const bar = document.createElement("div");

            bar.className = "tt-timer-progress-bar";
            container.appendChild(bar);

            this._els.popup.appendChild(container);

            this._els.timerBar = bar;
            return container;
          },
          () => {
            this._els.timerBar = null;
          }
      );

      // Ensure timer bar container remains last element (if present)
      if (this._els.timerBarContainer && this._els.popup.lastChild !== this._els.timerBarContainer) {
        this._els.popup.appendChild(this._els.timerBarContainer);
      }

      // Sync bar/container classes (BUGFIX: container class must be applied to container)
      if (this._els.timerBarContainer) {
        this._els.timerBarContainer.className = TinySwal._cx(
            "tt-timer-progress-bar-container",
            this.options.customClass?.timerProgressBarContainer
        );
      }
      if (this._els.timerBar) {
        this._els.timerBar.className = TinySwal._cx(
            "tt-timer-progress-bar",
            this.options.customClass?.timerProgressBar
        );
      }

      // --- INPUT (inside content) ---
      ensureElement(
          "input",
          !!this.options.input,
          `${namespace}input`,
          this.options.customClass?.input,
          () => {
            const el = document.createElement("input");
            el.type = this.options.input || "text";
            this._els.contentBody.appendChild(el);
            return el;
          }
      );
    }

    /** Bind all event listeners relevant for the current DOM configuration */
    _bindEvents() {
      if (!this._isToast) {
        document.addEventListener("keydown", this._onKeyDown, true);
      }

      this._els.overlay?.addEventListener("click", this._onOverlayClick);

      this._els.confirmBtn?.addEventListener("click", this._onConfirmClick);
      this._els.cancelBtn?.addEventListener("click", this._onCancelClick);
      this._els.denyBtn?.addEventListener("click", this._onDenyClick);
      this._els.deleteBtn?.addEventListener("click", this._onDeleteClick);
      this._els.callToActionBtn?.addEventListener("click", this._onCallToActionClick);
      this._els.closeBtn?.addEventListener("click", this._onCloseClick);

      // Toast click-to-close (if enabled)
      if (this._isToast && this.options.closeOnClick) {
        this._els.popup?.addEventListener("click", this._onToastClick);
      }

      // Draggable popup. Dragging starts only from the title so controls remain clickable.
      if (this._drag.enabled) {
        this._els.popup?.addEventListener("pointerdown", this._onPointerDown);
      }
    }

    /** Unbind all listeners (safe to call even if not bound) */
    _unbindEvents() {
      document.removeEventListener("keydown", this._onKeyDown, true);

      this._els.overlay?.removeEventListener("click", this._onOverlayClick);

      this._els.confirmBtn?.removeEventListener("click", this._onConfirmClick);
      this._els.cancelBtn?.removeEventListener("click", this._onCancelClick);
      this._els.denyBtn?.removeEventListener("click", this._onDenyClick);
      this._els.deleteBtn?.removeEventListener("click", this._onDeleteClick);
      this._els.callToActionBtn?.removeEventListener("click", this._onCallToActionClick);
      this._els.closeBtn?.removeEventListener("click", this._onCloseClick);

      this._els.popup?.removeEventListener("click", this._onToastClick);

      this._els.popup?.removeEventListener("pointerdown", this._onPointerDown);
      document.removeEventListener("pointermove", this._onPointerMove);
      document.removeEventListener("pointerup", this._onPointerUp);
      document.removeEventListener("pointercancel", this._onPointerUp);
    }

    /** Begin a potential drag operation from the title only. */
    _onPointerDown(e) {
      if (!this._isOpen || !this._isTopmost() || !this._drag.enabled) return;
      if (e.button !== 0 || e.isPrimary === false) return;

      const title = e.target?.closest?.(`.${namespace}title`);
      if (!title || !this._els.popup.contains(title)) return;

      // Never let drag handling steal pointer/click events from interactive controls.
      if (e.target.closest("button, a, input, select, textarea, label, [role='button']")) return;

      const rect = this._els.popup.getBoundingClientRect();

      this._drag.pending = true;
      this._drag.dragging = false;
      this._drag.pointerId = e.pointerId;
      this._drag.startX = e.clientX;
      this._drag.startY = e.clientY;
      this._drag.startLeft = rect.left;
      this._drag.startTop = rect.top;
      this._drag.popupWidth = rect.width;
      this._drag.popupHeight = rect.height;

      document.addEventListener("pointermove", this._onPointerMove, { passive: false });
      document.addEventListener("pointerup", this._onPointerUp);
      document.addEventListener("pointercancel", this._onPointerUp);
    }

    /** Move the popup after a small threshold to preserve normal clicks. */
    _onPointerMove(e) {
      if (!this._drag.pending || e.pointerId !== this._drag.pointerId) return;

      const deltaX = e.clientX - this._drag.startX;
      const deltaY = e.clientY - this._drag.startY;

      if (!this._drag.dragging && Math.hypot(deltaX, deltaY) < 4) return;

      this._drag.dragging = true;
      e.preventDefault();

      const maxLeft = Math.max(0, window.innerWidth - this._drag.popupWidth);
      const maxTop = Math.max(0, window.innerHeight - this._drag.popupHeight);
      const left = Math.min(maxLeft, Math.max(0, this._drag.startLeft + deltaX));
      const top = Math.min(maxTop, Math.max(0, this._drag.startTop + deltaY));

      this._els.popup.classList.add("is-dragging");
      this._els.popup.style.position = "fixed";
      this._els.popup.style.left = `${left}px`;
      this._els.popup.style.top = `${top}px`;
      this._els.popup.style.transform = "none";
    }

    /** End a pending or active drag operation. */
    _onPointerUp(e) {
      if (e?.pointerId != null && e.pointerId !== this._drag.pointerId) return;

      this._drag.pending = false;
      this._drag.dragging = false;
      this._drag.pointerId = null;
      this._els.popup?.classList.remove("is-dragging");

      document.removeEventListener("pointermove", this._onPointerMove);
      document.removeEventListener("pointerup", this._onPointerUp);
      document.removeEventListener("pointercancel", this._onPointerUp);
    }

    /** Acquire a shared document scroll lock for viewport-level modals. */
    _acquireDocumentScrollLock() {
      if (this._scrollLockAcquired) return;
      if (this._isToast || (this.options.targetEl && this.options.targetEl !== document.body)) return;

      TinySwal._lockDocumentScroll();
      this._scrollLockAcquired = true;
    }

    /** Release this instance's document scroll lock exactly once. */
    _releaseDocumentScrollLock() {
      if (!this._scrollLockAcquired) return;

      this._scrollLockAcquired = false;
      TinySwal._unlockDocumentScroll();
    }

    /**
     * Mount container into target element and trigger open transition.
     * Adds .is-open and removes .is-closing defensively.
     */
    _mount() {
      const target = this.options.targetEl || document.body;

      this._acquireDocumentScrollLock();

      if (target !== document.body) {
        const cs = window.getComputedStyle(target);
        if (cs.position === 'static') target.style.position = 'relative';
      }

      const c = this._els.container;

      if (this._isToast) {
        const key = TinySwal._toastKeyFor(this);
        const pos = this.options.position || 'top-end';
        const group = TinySwal._toastEnsureStack(key, target, pos);
        group.stackEl.appendChild(c);
      } else {
        target.appendChild(c);
      }
    }


    /**
     * Unmount container with transition handling.
     * Adds .is-closing, removes .is-open, then removes DOM.
     */
    _unmount() {
      const container = this._els.container;
      const popup = this._els.popup;
      if (!container) return;

      container.classList.add("is-closing");
      container.classList.remove("is-open");

      this.hideLoading();

      let done = false;

      const finish = () => {
        if (done) return;
        done = true;

        popup?.removeEventListener("animationend", finish);
        container.remove();
        this._releaseDocumentScrollLock();

        if (this._isToast) TinySwal._toastUnregister(this);

        if (isFn(this.options.didClose)) {
          this.options.didClose.call(this, this._getHookContext());
        }
      };

      popup?.addEventListener("animationend", finish, { once: true });
      setTimeout(finish, 250);
    }
  }

  /**
   * TinySwal (static)
   * Global API + stack management + toast stacking
   */
  class TinySwal {
    static _stack = [];
    static _zIndexBase = 100;
    static _zIndexStep = 1;

    // Shared viewport scroll lock for one or more open document-level modals.
    static _scrollLockCount = 0;
    static _scrollLockState = null;

    // Toast stacking (per target + position) using a CSS-driven stack container
    static _toastGroups = new Map(); // key -> { instances: TinySwalInstance[], stackEl: HTMLElement }
    static _toastTargetIds = new WeakMap();
    static _toastTargetSeq = 1;

    static _toastGetTargetId(targetEl) {
      const t = targetEl || document.body;
      let id = TinySwal._toastTargetIds.get(t);
      if (!id) {
        id = `t${TinySwal._toastTargetSeq++}`;
        TinySwal._toastTargetIds.set(t, id);
      }
      return id;
    }

    static _toastKeyFor(instance) {
      const targetId = TinySwal._toastGetTargetId(instance.options.targetEl);
      const pos = instance.options.position || "top-end";
      return `${targetId}::${pos}`;
    }

    static _toastEnsureStack(key, targetEl, pos) {
      let group = TinySwal._toastGroups.get(key);
      if (group?.stackEl && group.stackEl.isConnected) return group;

      const stackEl = document.createElement("div");
      stackEl.className = `${namespace}toast-stack`;
      stackEl.setAttribute("data-toast-position", pos);

      const t = targetEl || document.body;
      if (t !== document.body) {
        const cs = window.getComputedStyle(t);
        if (cs.position === "static") t.style.position = "relative";
      }

      t.appendChild(stackEl);

      if (!group) group = { instances: [] };
      group.stackEl = stackEl;
      TinySwal._toastGroups.set(key, group);
      return group;
    }

    static _toastRegister(instance) {
      if (!instance || !instance._isToast || !instance._isOpen) return;

      const newKey = TinySwal._toastKeyFor(instance);
      const oldKey = instance._toastKey;

      if (oldKey && oldKey !== newKey) {
        TinySwal._toastUnregister(instance);
      }

      instance._toastKey = newKey;

      const target = instance.options.targetEl || document.body;
      const pos = instance.options.position || "top-end";
      const group = TinySwal._toastEnsureStack(newKey, target, pos);

      if (!group.instances.includes(instance)) {
        group.instances.unshift(instance);
      }

      const c = instance._els?.container;
      if (c) {
        // Newest closest to the edge: prepend works for top; for bottom we use column-reverse in CSS.
        group.stackEl.prepend(c);
      }
    }

    static _toastUnregister(instance) {
      const key = instance?._toastKey;
      if (!key) return;

      const group = TinySwal._toastGroups.get(key);
      if (!group) return;

      group.instances = group.instances.filter((x) => x !== instance);

      if (!group.instances.length) {
        if (group.stackEl && group.stackEl.isConnected) group.stackEl.remove();
        TinySwal._toastGroups.delete(key);
      }
    }

    /** Lock document scrolling without shifting the page when the scrollbar disappears. */
    static _lockDocumentScroll() {
      TinySwal._scrollLockCount += 1;
      if (TinySwal._scrollLockCount > 1) return;

      const body = document.body;
      const root = document.documentElement;
      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
      const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

      TinySwal._scrollLockState = {
        bodyOverflow: body.style.overflow,
        bodyPaddingRight: body.style.paddingRight,
        rootOverflow: root.style.overflow
      };

      root.style.overflow = "hidden";
      body.style.overflow = "hidden";

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
      }
    }

    /** Restore document scrolling after the final viewport-level modal closes. */
    static _unlockDocumentScroll() {
      TinySwal._scrollLockCount = Math.max(0, TinySwal._scrollLockCount - 1);
      if (TinySwal._scrollLockCount !== 0 || !TinySwal._scrollLockState) return;

      const body = document.body;
      const root = document.documentElement;
      const state = TinySwal._scrollLockState;

      body.style.overflow = state.bodyOverflow;
      body.style.paddingRight = state.bodyPaddingRight;
      root.style.overflow = state.rootOverflow;

      TinySwal._scrollLockState = null;
    }

    /**
     * TinySwal.fire(title, text?, icon?)
     * TinySwal.fire(options)
     */
    static fire(arg1, arg2, arg3) {
      const options = TinySwal._coerceArgs(arg1, arg2, arg3);

      const parentEl = TinySwal._resolveEl(options.parent);
      const top = TinySwal.getTop();

      // nested if parent is inside a TinySwal popup OR inside a SweetAlert2 popup
      const isNestedInTiny = !!top && !!parentEl && !!top._els?.popup && top._els.popup.contains(parentEl);
      const isInsideSwal2 = !!parentEl && !!parentEl.closest?.(".swal2-popup");
      const isNested = isNestedInTiny || isInsideSwal2;

      const tinyParent = (isNestedInTiny ? top : null);
      if (tinyParent && !options.toast) tinyParent._lock();

      const instance = new TinySwalInstance(options, TinySwal._stack.length);
      instance._parent = options.toast ? null : tinyParent;

      TinySwal._stack.push(instance);
      return instance.open();
    }

    /** Return the popup element of the topmost TinySwal instance. */
    static getPopup() {
      return TinySwal.getTop()?.getPopup() || null;
    }

    /** Return the form element of the topmost TinySwal instance. */
    static getForm() {
      return TinySwal.getTop()?.getForm() || null;
    }

    /** Return the remaining timer duration of the topmost instance. */
    static getTimerLeft() {
      return TinySwal.getTop()?.getTimerLeft() || 0;
    }

    /** Show the loading indicator on the topmost instance. */
    static showLoading() {
      TinySwal.getTop()?.showLoading();
    }

    /** Hide the loading indicator on the topmost instance. */
    static hideLoading() {
      TinySwal.getTop()?.hideLoading();
    }

    /** Return whether the topmost instance is in a loading state. */
    static isLoading() {
      return TinySwal.getTop()?.isLoading() || false;
    }

    /** Show a validation message on the topmost instance. */
    static showValidationMessage(message) {
      TinySwal.getTop()?.showValidationMessage(message);
    }

    /** Returns the topmost instance (or null) */
    static getTop() {
      return TinySwal._stack.length ? TinySwal._stack[TinySwal._stack.length - 1] : null;
    }

    /** Dismiss the topmost instance */
    static closeTop(dismiss = DISMISS.close) {
      const top = TinySwal.getTop();
      if (!top) return;
      top._finalizeAndClose({ isConfirmed: false, isDenied: false, isDeleted: false, isCallToAction: false, isDismissed: true, dismiss });
    }

    /** Dismiss all instances */
    static closeAll(dismiss = DISMISS.close) {
      while (TinySwal._stack.length) TinySwal.closeTop(dismiss);
    }

    /** Remove instance from stack and re-index z-order */
    static _removeInstance(instance) {
      const idx = TinySwal._stack.indexOf(instance);
      if (idx === -1) return;
      TinySwal._stack.splice(idx, 1);

      TinySwal._stack.forEach((inst, i) => {
        inst.stackIndex = i;
        inst._applyZIndex();
      });
    }

    /** Join class names safely */
    static _cx(base, extra) {
      if (!extra) return base;
      if (Array.isArray(extra)) return [base, ...extra].filter(Boolean).join(" ");
      return `${base} ${extra}`;
    }

    static _cssSize(value) {
      if (value == null || value === "") return "";
      if (typeof value === "number") return `${value}px`;
      const text = String(value).trim();
      if (/^\d+(\.\d+)?$/.test(text)) return `${text}px`;
      return text;
    }

    /** Resolve an element reference from selector/jQuery/HTMLElement */
    static _resolveEl(v) {
      if (!v) return null;
      if (v.jquery) return v[0];
      if (typeof v === "string") return document.querySelector(v);
      if (v instanceof HTMLElement) return v;
      return null;
    }

    /** Support TinySwal.fire(title, text, icon) shorthand */
    static _coerceArgs(arg1, arg2, arg3) {
      if (typeof arg1 === "object") return arg1 || {};
      const title = arg1;
      const text = arg2;
      const icon = arg3;
      return { title, text, icon };
    }

    /**
     * Normalize and default options.
     * Keep defaulting logic centralized.
     */
    static _normalizeOptions(o) {
      const opt = { ...o };

      // Mode
      opt.toast = opt.toast ?? false;

      // Core fields
      opt.title = opt.title ?? "";
      opt.text = opt.text ?? "";
      opt.html = opt.html ?? "";

      opt.footer = opt.footer ?? "";
      opt.icon = opt.icon ?? undefined;

      // Position
      opt.position = opt.position ?? (opt.toast ? "top-end" : "center");
      // Layout
      opt.width = opt.width ?? null;

      // Buttons
      opt.showConfirmButton = opt.showConfirmButton ?? !opt.toast;
      opt.showCancelButton = opt.showCancelButton ?? false;
      opt.showDenyButton = opt.showDenyButton ?? false;
      opt.showDeleteButton = opt.showDeleteButton ?? false;
      opt.showCloseButton = opt.showCloseButton ?? false;

      opt.confirmButtonText = opt.confirmButtonText ?? "OK";
      opt.cancelButtonText = opt.cancelButtonText ?? "Cancel";
      opt.denyButtonText = opt.denyButtonText ?? "Deny";
      opt.deleteButtonText = opt.deleteButtonText ?? "Delete";

      opt.confirmButtonAriaLabel = opt.confirmButtonAriaLabel ?? "";
      opt.cancelButtonAriaLabel = opt.cancelButtonAriaLabel ?? "";
      opt.denyButtonAriaLabel = opt.denyButtonAriaLabel ?? "";
      opt.deleteButtonAriaLabel = opt.deleteButtonAriaLabel ?? "";

      // Toast-only call-to-action button
      opt.showCallToActionButton = opt.showCallToActionButton ?? false;
      opt.callToActionButtonText = opt.callToActionButtonText ?? "View";
      opt.callToActionButtonAriaLabel = opt.callToActionButtonAriaLabel ?? "";
      opt.callToActionUrl = opt.callToActionUrl ?? "";
      opt.callToActionTarget = opt.callToActionTarget ?? "_self";

      // Behavior
      opt.allowEscapeKey = opt.allowEscapeKey ?? !opt.toast;
      opt.allowOutsideClick = opt.allowOutsideClick ?? !opt.toast;
      opt.focusConfirm = opt.focusConfirm ?? !opt.toast;
      opt.showOverlay = opt.showOverlay ?? !opt.toast;

      // Timer
      opt.timer = opt.timer ?? 0;
      opt.timerProgressBar = opt.timerProgressBar ?? false;

      // Toast click behavior (default: clickable when no close button)
      opt.closeOnClick = opt.closeOnClick ?? (opt.toast && !opt.showCloseButton);

      // Draggable
      opt.draggable = opt.draggable ?? false;

      // Mounting
      opt.targetEl = TinySwal._resolveEl(opt.target) || null; // alias for `target`
      opt.parent = opt.parent ?? null;

      // Styling
      opt.customClass = opt.customClass ?? {};

      // Input
      opt.input = opt.input ?? null;                    // e.g. "text"
      opt.inputAttributes = opt.inputAttributes ?? {};  // e.g. { autocapitalize: "off" }
      opt.inputPlaceholder = opt.inputPlaceholder ?? "";
      opt.inputValue = opt.inputValue ?? "";
      opt.inputAutoFocus = opt.inputAutoFocus ?? true;

      // Async confirm
      opt.showLoaderOnConfirm = opt.showLoaderOnConfirm ?? false;

      // Hooks
      opt.willOpen   = opt.willOpen   ?? null;
      opt.didOpen    = opt.didOpen    ?? null;
      opt.willClose  = opt.willClose  ?? null;
      opt.didClose   = opt.didClose   ?? null;

      opt.preConfirm = opt.preConfirm ?? null; // function(value) => value|Promise
      opt.preDeny    = opt.preDeny    ?? null;
      opt.preDelete  = opt.preDelete  ?? null;
      opt.preCallToAction = opt.preCallToAction ?? null;

      return opt;
    }
  }

  // Public constants
  TinySwal.DismissReason = DISMISS;

  return TinySwal;
}));
