/**
 * Optional TinyDataTable inline editing support.
 *
 * Activated automatically when a table is configured with `inlineEdit` and
 * at least one column has an `editable` definition. No consumer-side plugin
 * registration is required.
 */
(function () {
    'use strict';

    if (typeof TinyDataTable === 'undefined') {
        throw new Error('TinyDataTable.inlineEdit.js requires TinyDataTable.js to be loaded first.');
    }

    const isFn = value => typeof value === 'function';
    const isObj = value => value != null && typeof value === 'object' && !Array.isArray(value);
    const toStr = value => value == null ? '' : String(value);

    class TinyDataTableInlineEdit {
        constructor(table, config) {
            this.table = table;
            this.config = isObj(config) ? config : {};
            this.idKey = this.config.idKey || 'id';
            this.active = null;
            this.pendingOpen = null;

            this._onClick = this._onClick.bind(this);
            this._onKeyDown = this._onKeyDown.bind(this);

            table.table.addEventListener('click', this._onClick);
            table.table.addEventListener('keydown', this._onKeyDown);
        }

        decorateCell(td, context) {
            const editable = context?.col?.editable;
            if (!editable) return;

            const cfg = editable === true ? { type: 'text' } : editable;
            if (!isObj(cfg)) return;

            if (cfg.when === false) return;
            if (isFn(cfg.when) && !cfg.when(context)) return;

            const type = String(cfg.type || 'text').toLowerCase();

            td.classList.add('tt-inline-editable', `tt-inline-editable--${type}`);
            td.dataset.ttInlineEdit = context.col.key;
            td._ttInlineEdit = Object.assign({}, context, { editable: cfg, type });

            if (type === 'date') {
                this._renderDateDisplay(td, td._ttInlineEdit);
            }
        }

        _renderDateDisplay(td, context) {
            const value = context?.row?.[context?.col?.key];
            const wrapper = document.createElement('div');
            wrapper.className = 'tt-date-field';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tt-date-input browser-default';
            input.readOnly = true;
            input.tabIndex = 0;

            if (value) {
                input.value = typeof formatDate === 'function'
                    ? formatDate(value, MC.m_date_locale_format)
                    : toStr(value);
            }

            wrapper.appendChild(input);
            td.replaceChildren(wrapper);
        }

        _onClick(event) {
            const action = event.target.closest?.('[data-tt-inline-action]');
            if (action && this.table.table.contains(action)) {
                event.preventDefault();
                event.stopPropagation();

                if (action.dataset.ttInlineAction === 'save') this._saveActive();
                if (action.dataset.ttInlineAction === 'cancel') this._cancelActive();
                return;
            }

            let td = event.target.closest?.('td[data-tt-inline-edit]');
            if (!td || !this.table.table.contains(td)) return;

            let context = td._ttInlineEdit;
            if (!context) return;

            if (this.active?.td === td) return;

            const locator = this._createLocator(context);

            if (this.active?.saving) {
                this.pendingOpen = locator;
                return;
            }

            if (this.active) {
                // Cancelling redraws tbody to restore the previous cell. That makes
                // the clicked `td` stale, so resolve the target again afterwards.
                this._cancelActive();
                const resolved = this._resolveLocator(locator);
                if (!resolved) return;
                td = resolved.td;
                context = resolved.context;
            }

            this._openEditor(td, context);
        }

        _onKeyDown(event) {
            if (!this.active) return;
            if (!this.active.td.contains(event.target)) return;

            if (event.key === 'Escape') {
                event.preventDefault();
                this._cancelActive();
                return;
            }

            // Text inputs can use Enter as an explicit commit shortcut.
            // Select editors keep Enter for TinyDataTable.buildSelect() keyboard handling;
            // committing a select remains an explicit check-button action.
            if (event.key === 'Enter' && this.active.type === 'text') {
                event.preventDefault();
                this._saveActive();
            }
        }


        _createLocator(context) {
            return {
                row: context?.row || null,
                id: context?.row?.[this.idKey],
                key: context?.col?.key
            };
        }

        _resolveLocator(locator) {
            if (!locator?.key || !this.table.tbody) return null;

            const rows = Array.from(this.table.tbody.rows || []);
            let tr = rows.find(row => row._data === locator.row);

            if (!tr && locator.id != null) {
                tr = rows.find(row => this._valuesEqual(row._data?.[this.idKey], locator.id));
            }

            if (!tr) return null;

            const td = Array.from(tr.cells || []).find(cell => cell.dataset.ttInlineEdit === locator.key);
            if (!td?._ttInlineEdit) return null;

            return { td, context: td._ttInlineEdit };
        }

        _openEditor(td, context) {
            if (context.type === 'date') {
                this._openDateEditor(td, context);
                return;
            }

            this._openExplicitEditor(td, context);
        }

        _openPendingEditor() {
            if (!this.pendingOpen) return;

            const locator = this.pendingOpen;
            this.pendingOpen = null;

            const resolved = this._resolveLocator(locator);
            if (resolved) this._openEditor(resolved.td, resolved.context);
        }

        _openExplicitEditor(td, context) {
            const control = this._createControl(context);
            if (!control) return;

            // Preserve the current row height before replacing the rendered cell.
            // The editor can then fill the complete row without changing its height.
            const rowHeight = td.closest('tr')?.getBoundingClientRect?.().height || 0;

            const editor = document.createElement('div');
            editor.className = 'tt-inline-editor';
            if (rowHeight > 0) editor.style.height = `${Math.ceil(rowHeight)}px`;

            const controlWrap = document.createElement('div');
            controlWrap.className = 'tt-inline-editor__control';
            controlWrap.appendChild(control);

            const actions = document.createElement('div');
            actions.className = 'tt-inline-editor__actions';

            const save = this._createActionButton('save', 'check', 'Enregistrer');
            const cancel = this._createActionButton('cancel', 'close', 'Annuler');

            actions.append(save, cancel);
            editor.append(controlWrap, actions);
            td.replaceChildren(editor);
            td.classList.add('tt-inline-editing');

            const oldValue = context.row?.[context.col.key];
            this.active = { td, context, control, save, oldValue, type: context.type, saving: false };


            if (context.type === 'select') {
                control.querySelector?.('.select')?.focus?.();
            } else if (isFn(control.focus)) {
                control.focus();
                control.select?.();
            }
        }

        _createControl(context) {
            const cfg = context.editable;
            const value = context.row?.[context.col.key];

            if (context.type === 'select') {
                let options = isFn(cfg.options) ? cfg.options(context) : cfg.options;
                if (!Array.isArray(options)) options = [];
                return TinyDataTable.buildSelect(options, value, null, cfg.selectOptions || {});
            }

            const input = document.createElement(context.type === 'textarea' ? 'textarea' : 'input');
            if (input.tagName === 'INPUT') input.type = cfg.inputType || 'text';
            input.className = 'browser-default tt-inline-editor__input';
            input.value = toStr(value);

            if (cfg.required) input.required = true;
            if (Number.isFinite(cfg.minLength)) input.minLength = cfg.minLength;
            if (Number.isFinite(cfg.maxLength)) input.maxLength = cfg.maxLength;

            return input;
        }

        _createActionButton(action, icon, label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-icon is-24';
            button.dataset.ttInlineAction = action;
            button.setAttribute('aria-label', label);
            button.setAttribute('data-tooltip', label);
            button.innerHTML = `<i class="material-icons">${icon}</i>`;
            return button;
        }

        _getControlValue(control, context) {
            let value = control?.value;
            if (context.type === 'text' || context.type === 'textarea') {
                value = toStr(value);
                if (context.editable.trim !== false) value = value.trim();
            }
            return value;
        }

        _valuesEqual(a, b) {
            return toStr(a) === toStr(b);
        }

        _validate(value, context) {
            const cfg = context.editable;
            const text = toStr(value);

            if (cfg.required && text === '') return 'Ce champ est obligatoire.';
            if (Number.isFinite(cfg.minLength) && text.length < cfg.minLength) {
                return `Minimum ${cfg.minLength} caractères.`;
            }
            if (Number.isFinite(cfg.maxLength) && text.length > cfg.maxLength) {
                return `Maximum ${cfg.maxLength} caractères.`;
            }

            if (isFn(cfg.validate)) {
                const result = cfg.validate(value, context);
                if (result !== true && result != null) return String(result);
            }

            return null;
        }

        async _saveActive() {
            const active = this.active;
            if (!active || active.saving) return;

            const value = this._getControlValue(active.control, active.context);

            // Keep the confirmation action deterministic: the check button is
            // always usable. If nothing changed, simply leave edit mode without
            // issuing a pointless request.
            if (this._valuesEqual(value, active.oldValue)) {
                this._cancelActive();
                return;
            }
            const validationError = this._validate(value, active.context);
            if (validationError) {
                this._notifyError(validationError, active.context);
                return;
            }

            active.td.classList.add('tt-inline-saving');
            active.save.disabled = true;
            active.saving = true;

            try {
                const response = await this._commit(active.context, value, active.oldValue);
                if (!response || response.success !== true) {
                    throw new Error(response?.error || 'Unknown error');
                }

                const committedValue = Object.prototype.hasOwnProperty.call(response, 'value')
                    ? response.value
                    : value;

                active.context.row[active.context.col.key] = committedValue;
                this.active = null;
                this.table.redrawFromCache();
                this._openPendingEditor();

                this.config.onSuccess?.({
                    table: this.table,
                    row: active.context.row,
                    column: active.context.col,
                    key: active.context.col.key,
                    editorType: active.type,
                    value: committedValue,
                    oldValue: active.oldValue,
                    response
                });
            } catch (error) {
                active.saving = false;
                this.pendingOpen = null;
                active.td.classList.remove('tt-inline-saving');
                active.save.disabled = false;
                this._notifyError(error?.message || 'Unknown error', active.context, error);
            }
        }

        _cancelActive() {
            if (!this.active) return;
            this.active = null;
            this.pendingOpen = null;
            this.table.redrawFromCache();
        }

        _openDateEditor(td, context) {
            const input = td.querySelector('.tt-date-input');
            if (!input) return;

            if (input._tinyDatePicker) {
                if (!input._tinyDatePicker._isOpen) input._tinyDatePicker.open();
                return;
            }

            if (typeof TinyDatePicker === 'undefined') {
                throw new Error('TinyDataTable inline date editor requires TinyDatePicker.');
            }

            const key = context.col.key;
            const raw = context.row?.[key];
            const parsed = raw && typeof parse_date_to_moment === 'function' ? parse_date_to_moment(raw) : null;
            const currentDate = parsed?.isValid?.() ? parsed.toDate() : null;
            const cfg = context.editable;
            let busy = false;

            const instance = new TinyDatePicker(input, {
                mode: cfg.mode || 'modal',
                autoClose: cfg.autoClose ?? false,
                showClearBtn: cfg.clearable ?? true,
                selectedDate: currentDate,
                dateFormat: cfg.dateFormat || MC.m_date_locale_format,

                onClose: async ({ dismiss, date }) => {
                    if (dismiss !== 'close' && dismiss !== 'clear') return;
                    if (busy) return;
                    busy = true;

                    try {
                        if (dismiss === 'clear') {
                            const confirmClear = cfg.confirmClear || this.config.confirmClear;
                            const ok = isFn(confirmClear)
                                ? await confirmClear({ table: this.table, row: context.row, column: context.col })
                                : true;

                            if (!ok) {
                                if (currentDate) instance.setDate(currentDate);
                                return;
                            }
                            date = null;
                        }

                        const value = date
                            ? (typeof moment !== 'undefined' ? moment(date).formatISO() : date.toISOString())
                            : null;

                        const response = await this._commit(context, value, raw);
                        if (!response || response.success !== true) {
                            throw new Error(response?.error || 'Unknown error');
                        }

                        context.row[key] = value;
                        const display = value
                            ? (typeof formatDate === 'function' ? formatDate(value, MC.m_date_locale_format) : value)
                            : '';
                        input.value = display;

                        this.config.onSuccess?.({
                            table: this.table,
                            row: context.row,
                            column: context.col,
                            key,
                            value,
                            oldValue: raw,
                            display,
                            response,
                            editorType: 'date'
                        });
                    } catch (error) {
                        this._notifyError(error?.message || 'Unknown error', context, error);
                    } finally {
                        busy = false;
                    }
                }
            });

            input._tinyDatePicker = instance;
            instance.open();
        }

        async _commit(context, value, oldValue) {
            const id = context.row?.[this.idKey];
            if (id == null) throw new Error(`Missing inline edit row identifier "${this.idKey}".`);

            const commit = context.editable.commit || this.config.commit;
            const payload = {
                table: this.table,
                row: context.row,
                id,
                column: context.col,
                key: context.col.key,
                value,
                oldValue
            };

            if (isFn(commit)) return await commit(payload);

            const update = context.editable.update || this.config.update;
            if (!update) throw new Error('TinyDataTable inlineEdit requires a commit callback or update configuration.');

            const url = isFn(update.url) ? update.url(payload) : update.url;
            if (!url) throw new Error('TinyDataTable inlineEdit update URL is missing.');

            const params = isFn(update.buildParams)
                ? update.buildParams(payload)
                : { [context.col.key]: value };

            const body = new URLSearchParams();
            Object.keys(params || {}).forEach(key => {
                const paramValue = params[key];
                if (paramValue == null) body.append(key, '');
                else if (Array.isArray(paramValue)) paramValue.forEach(v => body.append(`${key}[]`, v));
                else body.append(key, paramValue);
            });

            const response = await fetch(url, {
                method: update.method || 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body
            });

            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
            return await response.json();
        }

        _notifyError(message, context, error) {
            if (isFn(this.config.onError)) {
                this.config.onError({
                    table: this.table,
                    row: context?.row,
                    column: context?.col,
                    key: context?.col?.key,
                    editorType: context?.type,
                    message,
                    error
                });
                return;
            }

            console.error('[TinyDataTable:inlineEdit]', message, error || '');
        }
    }

    TinyDataTable.initInlineEdit = function (table, config) {
        return new TinyDataTableInlineEdit(table, config);
    };
}());
