/**
 * TinyGallery 1.1 — standalone image collection UI (vanilla JavaScript).
 * Requires TinyLightbox only for image viewing. Drag sorting is implemented here.
 * Upload, file deletion and database persistence are intentionally external.
 */
(function (global) {
    'use strict';
    const SHAPES = {
        plus: 'M12 5v14M5 12h14', zoom: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 5 5',
        edit: 'm16 4 4 4-11 11-5 1 1-5L16 4zM14 6l4 4',
        remove: 'M4 7h16M10 11v7m4-7v7M7 7l1 13h8l1-13M9 7V4h6v3',
        grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01'
    };
    const SVG = key => `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${SHAPES[key]}"/></svg>`;
    const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);
    const isBlob = value => typeof Blob !== 'undefined' && value instanceof Blob;
    const isFile = value => typeof File !== 'undefined' && value instanceof File;
    const createButton = (action, text, symbol) => {
        const el = document.createElement('button'); el.type = 'button'; el.dataset.action = action;
        el.className = `tgallery-button tgallery-${action}`;
        el.title = text; el.setAttribute('aria-label', text); el.innerHTML = SVG(symbol);
        return el;
    };

    class TinyGallery {
        static getInstance(target) {
            const el = typeof target === 'string' ? document.querySelector(target) : target;
            return el?.tinyGallery || null;
        }

        constructor(target, options = {}) {
            this.root = typeof target === 'string' ? document.querySelector(target) : target;
            if (!(this.root instanceof HTMLElement)) throw new TypeError('TinyGallery requires an HTML element.');
            if (this.root.tinyGallery) throw new Error('TinyGallery already mounted.');
            if (typeof global.TinyLightbox !== 'function') throw new Error('TinyGallery requires TinyLightbox.js.');
            this.options = {
                images: [], resolveUrl: name => name, maxImages: 12, maxFileSize: 10 * 1024 * 1024,
                label: 'Photo gallery', editable: true, sortable: true, addable: true, removable: true,
                onEdit: null, onChange: null, onError: null, confirmRemove: null,
                ...options
            };
            this.items = []; this.removed = []; this._undo = null; this._counter = 0;
            this._urls = new Set(); this._editing = new Set(); this._destroyed = false;
            this._drag = null; this._suppressClick = null;
            this._click = this._click.bind(this); this._change = this._change.bind(this);
            this._dropFiles = this._dropFiles.bind(this); this._over = this._over.bind(this);
            this._key = this._key.bind(this); this._dragStart = this._dragStart.bind(this);
            this._dragOver = this._dragOver.bind(this); this._dragEnd = this._dragEnd.bind(this);
            this._pointerDown = this._pointerDown.bind(this); this._pointerMove = this._pointerMove.bind(this);
            this._pointerUp = this._pointerUp.bind(this);
            this.root.tinyGallery = this; this.root.classList.add('tiny-gallery');
            this._build(); this.setImages(this.options.images);
            this.root.addEventListener('click', this._click);
            this.root.addEventListener('dragover', this._over);
            this.root.addEventListener('drop', this._dropFiles);
            this.root.addEventListener('keydown', this._key);
            this.root.addEventListener('dragstart', this._dragStart);
            this.root.addEventListener('dragover', this._dragOver);
            this.root.addEventListener('dragend', this._dragEnd);
            this.root.addEventListener('pointerdown', this._pointerDown);
            this.root.addEventListener('pointermove', this._pointerMove);
            this.root.addEventListener('pointerup', this._pointerUp);
            this.root.addEventListener('pointercancel', this._pointerUp);
        }

        _alive() { if (this._destroyed) throw new Error('TinyGallery destroyed.'); }
        _build() {
            this.root.replaceChildren();
            const header = document.createElement('div'); header.className = 'tgallery-head';
            const title = document.createElement('strong'); title.textContent = this.options.label;
            this.count = document.createElement('span'); this.count.className = 'tgallery-count';
            header.append(title, this.count);
            this.grid = document.createElement('div'); this.grid.className = 'tgallery-grid';
            this.grid.setAttribute('aria-label', `${this.options.label} images`);
            this.feedback = document.createElement('div'); this.feedback.className = 'tgallery-feedback';
            this.feedback.setAttribute('role', 'status'); this.feedback.setAttribute('aria-live', 'polite');
            this.feedback.hidden = true;
            this.fileInput = document.createElement('input'); this.fileInput.type = 'file';
            this.fileInput.accept = [...ACCEPTED].join(','); this.fileInput.multiple = true;
            this.fileInput.className = 'tgallery-file-input';
            this.fileInput.setAttribute('aria-label', 'Choose images to add');
            this.fileInput.addEventListener('change', this._change);
            this.root.append(header, this.grid, this.feedback, this.fileInput);
            this.lightbox = new global.TinyLightbox({ images: [], onEdit:
                this.options.editable && typeof this.options.onEdit === 'function'
                    ? async image => {
                        const result = await this.edit(image.id);
                        const item = this.items.find(i => i.id === image.id);
                        return result && item ? { src: item.src, alt: item.filename || 'Pending image' } : null;
                    } : null
            });
        }

        _normalize(input) {
            const image = typeof input === 'string' ? { filename: input } : input;
            if (!image || typeof image !== 'object') throw new TypeError('Invalid gallery image.');
            const filename = String(image.filename || '').trim();
            if (filename.includes(';')) throw new Error('Image filename cannot include ";".');
            const file = image.file ?? null; const data = image.data ?? null;
            if (!filename && !isBlob(file) && typeof data !== 'string' && !image.src) throw new Error('Missing image source.');
            let owned = null;
            if (!image.src && isBlob(file)) { owned = URL.createObjectURL(file); this._urls.add(owned); }
            const src = String(image.src || owned || data || (filename ? this.options.resolveUrl(filename) : ''));
            const id = String(image.id ?? `tg-${++this._counter}`);
            return { id, filename, file, data, src, owned, status: image.status || (isBlob(file) || data ? 'added' : 'saved') };
        }

        setImages(images) {
            this._alive();
            const entries = Array.isArray(images) ? images : typeof images === 'string' ? images.split(';').filter(Boolean) : null;
            if (!entries) throw new TypeError('Expected array or semicolon-delimited filenames.');
            if (entries.length > this.options.maxImages) throw new RangeError('Too many images.');
            // Build a replacement snapshot first, so invalid input cannot destroy
            // currently displayed previews or lose staged files.
            const previousUrls = this._urls;
            this._urls = new Set();
            let next;
            try {
                next = entries.map(image => this._normalize(image));
                if (new Set(next.map(item => item.id)).size !== next.length) throw new Error('Duplicate gallery image ID.');
            } catch (error) {
                this._releaseUrls(); this._urls = previousUrls; throw error;
            }
            for (const url of previousUrls) {
                if (next.some(item => item.src === url)) this._urls.add(url);
                else URL.revokeObjectURL(url);
            }
            this.items = next;
            this.removed = []; this._undo = null;
            this.lightbox.close(); this._render(); return this;
        }

        _releaseUrls() { for (const url of this._urls) URL.revokeObjectURL(url); this._urls.clear(); }
        _forgetUndo() {
            if (this._undo && !this.items.includes(this._undo.item) && this._undo.item.owned) {
                URL.revokeObjectURL(this._undo.item.owned); this._urls.delete(this._undo.item.owned);
            }
            this._undo = null;
        }
        addFiles(files) {
            this._alive(); let added = 0;
            for (const file of Array.from(files || [])) {
                if (!this.options.addable) { this._error('Adding images is disabled.'); break; }
                if (this.items.length >= this.options.maxImages) { this._error(`Limit of ${this.options.maxImages} images reached.`); break; }
                if (!isFile(file) || !ACCEPTED.has(file.type)) { this._error('Unsupported image format.'); continue; }
                if (file.size === 0 || file.size > this.options.maxFileSize) { this._error('Empty image or file too large.'); continue; }
                this.items.push(this._normalize({ file })); added++;
            }
            if (added) { this._forgetUndo(); this._render(); this._changed('add'); }
            return added;
        }
        getItems() { return this.items.map(({ id, filename, src, status, file, data }) => ({ id, filename, src, status, file, data })); }
        getState() { return { images: this.getItems(), removed: [...this.removed] }; }
        getValue() {
            if (this.items.some(item => item.status !== 'saved' || !item.filename)) {
                throw new Error('TinyGallery: pending images must be uploaded before serializing.');
            }
            return this.items.map(i => i.filename).join(';');
        }
        _tile(item, idx) {
            const el = document.createElement('div'); el.className = 'tgallery-tile'; el.dataset.id = item.id;
            const preview = createButton('preview', `Preview photo ${idx + 1}`, 'zoom');
            const image = document.createElement('img'); image.className = 'tgallery-image';
            image.src = item.src; image.alt = item.filename || 'Unsaved photo'; image.loading = 'lazy';
            image.addEventListener('error', () => el.classList.add('image-error'));
            preview.append(image);
            const actions = document.createElement('div'); actions.className = 'tgallery-actions';
            if (this.options.editable && typeof this.options.onEdit === 'function') actions.append(createButton('edit', 'Crop or replace', 'edit'));
            if (this.options.removable) actions.append(createButton('remove', 'Remove photo', 'remove'));
            const number = document.createElement('span'); number.className = 'tgallery-number'; number.textContent = String(idx + 1).padStart(2, '0');
            el.append(preview, actions, number);
            if (this.options.sortable) {
                const handle = createButton('move', `Move photo ${idx + 1} (arrow keys)`, 'grip');
                handle.classList.add('tgallery-handle'); handle.draggable = true;
                handle.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown');
                el.append(handle);
            }
            return el;
        }
        _render() {
            this.grid.replaceChildren(...this.items.map((item, idx) => this._tile(item, idx)));
            const add = createButton('add', 'Add more images', 'plus'); add.classList.add('tgallery-add');
            if (this.items.length >= this.options.maxImages) { add.disabled = true; add.title = 'Maximum reached'; }
            const label = document.createElement('span'); label.textContent = 'Add images'; add.append(label);
            if (this.options.addable) this.grid.append(add);
            this.count.textContent = `${this.items.length} / ${this.options.maxImages}`;
            this.feedback.hidden = true;
        }
        _tileById(id) { return [...this.grid.querySelectorAll('.tgallery-tile')].find(node => node.dataset.id === id); }
        _viewerImages() { return this.items.map(item => ({
            id: item.id, src: item.src, alt: item.filename || 'Unsaved photo', thumbnail: this._tileById(item.id)?.querySelector('img')
        })); }
        open(id) {
            this._alive(); const item = this.items.find(i => i.id === String(id)); if (!item) return false;
            this.lightbox.setImages(this._viewerImages());
            return this.lightbox.open(item.id, this._tileById(item.id)?.querySelector('img'));
        }
        close() { this.lightbox.close(); }

        async remove(id) {
            this._alive(); const item = this.items.find(i => i.id === String(id));
            if (!this.options.removable || !item || this._editing.has(item.id)) return false;
            if (typeof this.options.confirmRemove === 'function') {
                try { if (!await this.options.confirmRemove({ ...item })) return false; }
                catch (error) { this._error('Removal was not confirmed.', error); return false; }
            }
            const index = this.items.indexOf(item); if (index < 0 || this._destroyed) return false;
            this._forgetUndo(); this.items.splice(index, 1);
            if (item.filename && item.status !== 'added') this.removed.push(item.filename);
            this._undo = { item, index };
            if (this.lightbox.current?.id === item.id) this.lightbox.close();
            this._render(); this._changed('remove');
            this.feedback.hidden = false;
            this.feedback.replaceChildren(document.createTextNode('Photo removed. '));
            const undo = document.createElement('button'); undo.type = 'button'; undo.dataset.action = 'undo'; undo.textContent = 'Undo';
            this.feedback.append(undo); return true;
        }
        undo() {
            if (!this._undo || this._destroyed || this.items.length >= this.options.maxImages) return false;
            const { item, index } = this._undo; this._undo = null;
            this.items.splice(index, 0, item);
            const i = this.removed.lastIndexOf(item.filename); if (i >= 0) this.removed.splice(i, 1);
            this._render(); this._changed('undo'); return true;
        }
        async edit(id) {
            const item = this.items.find(i => i.id === String(id));
            if (!item || this._destroyed || this._editing.has(item.id) || typeof this.options.onEdit !== 'function') return false;
            this._editing.add(item.id);
            // Close the viewer before launching a separate editor modal.
            this.lightbox.close({ animate: false });
            try {
                const result = await this.options.onEdit({ ...item }, this);
                if (!result || this._destroyed || !this.items.includes(item)) return false;
                const file = isBlob(result) ? result : result.file ?? null;
                const data = typeof result.data === 'string' ? result.data : null;
                if (!isBlob(file) && !/^data:image\/(?:png|jpeg|webp|gif|avif|bmp);base64,/i.test(data || '')) {
                    throw new Error('Editor must return an image Blob, File, or image data URL.');
                }
                if (file && (!ACCEPTED.has(file.type) || !file.size || file.size > this.options.maxFileSize)) throw new Error('Invalid replacement file.');
                if (data && data.length * .75 > this.options.maxFileSize * 1.4) throw new Error('Replacement image too large.');
                const preview = file ? URL.createObjectURL(file) : data;
                if (file) this._urls.add(preview);
                if (item.owned) { URL.revokeObjectURL(item.owned); this._urls.delete(item.owned); }
                item.owned = file ? preview : null; item.src = preview; item.file = file; item.data = data;
                item.status = item.filename ? 'edited' : 'added';
                this._forgetUndo(); this._render(); this._changed('edit'); return true;
            } catch (error) { this._error(error.message || 'Editor failed.', error); return false; }
            finally { this._editing.delete(item.id); }
        }

        move(from, to) {
            this._alive(); if (!this.options.sortable || !Number.isInteger(from) || !Number.isInteger(to)) return false;
            if (from < 0 || to < 0 || from >= this.items.length || to >= this.items.length || from === to) return false;
            const [item] = this.items.splice(from, 1); this.items.splice(to, 0, item);
            this._render(); this._changed('reorder'); return true;
        }
        _click(event) {
            const button = event.target.closest('button[data-action]');
            if (!button || !this.root.contains(button)) return;
            const id = button.closest('[data-id]')?.dataset.id;
            const suppress = this._suppressClick;
            this._suppressClick = null;
            if (suppress && suppress.id === id && button.dataset.action === 'move' && Date.now() < suppress.until) {
                event.preventDefault(); return;
            }
            switch (button.dataset.action) {
                case 'add': this.fileInput.click(); break;
                case 'preview': this.open(id); break;
                case 'edit': this.edit(id); break;
                case 'remove': this.remove(id); break;
                case 'undo': this.undo(); break;
            }
        }
        _change() { const files = [...this.fileInput.files]; this.fileInput.value = ''; this.addFiles(files); }
        _over(event) {
            if ([...(event.dataTransfer?.types || [])].includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }
        }
        _dropFiles(event) {
            if (!event.dataTransfer?.files?.length) return;
            event.preventDefault(); this.addFiles(event.dataTransfer.files);
        }
        _key(event) {
            const handle = event.target.closest('.tgallery-handle'); if (!handle || !this.options.sortable) return;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); const tile = handle.closest('[data-id]');
            const from = this.items.findIndex(i => i.id === tile.dataset.id);
            const to = Math.max(0, Math.min(this.items.length - 1, from + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1)));
            if (this.move(from, to)) this._tileById(tile.dataset.id)?.querySelector('.tgallery-handle')?.focus();
        }
        _dragStart(event) {
            const handle = event.target.closest('.tgallery-handle'); if (!handle || !this.options.sortable) return;
            this._drag = { id: handle.closest('[data-id]').dataset.id, moved: false, kind: 'html' };
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', this._drag.id);
        }
        _dragOver(event) {
            if (this._drag?.kind !== 'html') return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const tile = event.target.closest('.tgallery-tile');
            this.grid.querySelectorAll('.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
            if (tile) { this._drag.targetId = tile.dataset.id; tile.classList.add('is-drag-target'); }
        }
        _dragEnd() {
            if (!this._drag || this._drag.kind !== 'html') return;
            const { id, targetId } = this._drag; this._drag = null;
            this.grid.querySelectorAll('.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
            if (!targetId) return;
            const from = this.items.findIndex(i => i.id === id), to = this.items.findIndex(i => i.id === targetId);
            this.move(from, to);
        }
        _pointerDown(event) {
            const handle = event.target.closest('.tgallery-handle');
            if (!handle || event.pointerType === 'mouse' || (event.pointerType === 'pen' && event.button !== 0)) return;
            const tile = handle.closest('[data-id]');
            this._drag = { kind: 'touch', id: tile.dataset.id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
            try { handle.setPointerCapture(event.pointerId); } catch (_) { /* optional */ }
        }
        _pointerMove(event) {
            const drag = this._drag;
            if (drag?.kind !== 'touch' || drag.pointerId !== event.pointerId) return;
            if (Math.hypot(drag.x - event.clientX, drag.y - event.clientY) < 9 && !drag.moved) return;
            drag.moved = true;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.tgallery-tile');
            this.grid.querySelectorAll('.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
            if (target && this.root.contains(target)) { drag.targetId = target.dataset.id; target.classList.add('is-drag-target'); }
        }
        _pointerUp(event) {
            const drag = this._drag;
            if (drag?.kind !== 'touch' || drag.pointerId !== event.pointerId) return;
            this._drag = null;
            this.grid.querySelectorAll('.is-drag-target').forEach(el => el.classList.remove('is-drag-target'));
            if (drag.moved) {
                const from = this.items.findIndex(i => i.id === drag.id), to = this.items.findIndex(i => i.id === drag.targetId);
                if (to >= 0) this.move(from, to);
                this._suppressClick = { id: drag.id, until: Date.now() + 500 };
            }
        }
        _changed(action) {
            const state = this.getState();
            if (typeof this.options.onChange === 'function') this.options.onChange(state, action, this);
            this.root.dispatchEvent(new CustomEvent('tinygallery:change', { bubbles: true, detail: { action, state } }));
        }
        _error(message, cause) {
            this.feedback.hidden = false; this.feedback.textContent = message;
            if (typeof this.options.onError === 'function') this.options.onError(new Error(message, { cause }), this);
        }
        destroy() {
            if (this._destroyed) return;
            this.lightbox.destroy();
            this.root.removeEventListener('click', this._click);
            this.root.removeEventListener('dragover', this._over);
            this.root.removeEventListener('drop', this._dropFiles);
            this.root.removeEventListener('keydown', this._key);
            this.root.removeEventListener('dragstart', this._dragStart);
            this.root.removeEventListener('dragover', this._dragOver);
            this.root.removeEventListener('dragend', this._dragEnd);
            this.root.removeEventListener('pointerdown', this._pointerDown);
            this.root.removeEventListener('pointermove', this._pointerMove);
            this.root.removeEventListener('pointerup', this._pointerUp);
            this.root.removeEventListener('pointercancel', this._pointerUp);
            this.fileInput.removeEventListener('change', this._change);
            this._releaseUrls(); this.root.replaceChildren(); this.root.classList.remove('tiny-gallery');
            delete this.root.tinyGallery; this._destroyed = true;
        }
    }
    global.TinyGallery = TinyGallery;
})(window);
