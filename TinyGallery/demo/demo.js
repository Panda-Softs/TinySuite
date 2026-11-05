'use strict';
const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const filenames = ['lake-1.svg', 'lake-2.svg', 'lake-3.svg', 'lake-4.svg'];
const lakeImage = filename => `./images/lake/${filename}`;
const crop = createDemoCropEditor();
const demoOwnedUrls = new Set();
function clearDemoUrls() { for (const url of demoOwnedUrls) URL.revokeObjectURL(url); demoOwnedUrls.clear(); }
const gallery = new TinyGallery('#gallery-main', {
    label: 'Product photo gallery',
    images: filenames,
    maxImages: 10,
    resolveUrl: name => lakeImage(name),
    onEdit: async image => crop(image.src),
    onChange: (state, action) => inspect(action),
    onError: error => notify(error.message)
});
window.demoGallery = gallery;
const empty = new TinyGallery('#gallery-empty', { label: 'Empty collection', images: [], maxImages: 5 });
const readOnly = new TinyGallery('#gallery-readonly', {
    label: 'View only', images: ['lake-1.svg', 'lake-2.svg'],
    editable: false, sortable: false, addable: false, removable: false,
    resolveUrl: name => lakeImage(name)
});
const limited = new TinyGallery('#gallery-limited', {
    label: 'Limited', images: ['lake-1.svg', 'lake-2.svg', 'lake-3.svg'], maxImages: 3,
    resolveUrl: name => lakeImage(name)
});
window.demoInstances = { gallery, empty, readOnly, limited };

function inspect(action = 'ready') {
    const state = gallery.getState();
    const pending = state.images.filter(item => item.status !== 'saved');
    $('#g-count').textContent = String(state.images.length);
    $('#g-pending').textContent = String(pending.length + state.removed.length);
    $('#g-status').textContent = action === 'ready' ? 'Gallery ready' : `Action: ${action}`;
    $('#g-action').textContent = `${pending.length} pending uploads/edits · ${state.removed.length} staged removals`;
    $('#g-state').textContent = JSON.stringify({
        images: state.images.map(({ id, filename, status, file }) => ({ id, filename: filename || '(new)', status, bytes: file?.size ?? null })),
        removed: state.removed
    }, null, 2);
}
inspect();
$('#g-reset').addEventListener('click', () => { gallery.setImages(filenames); clearDemoUrls(); inspect('reset'); notify('Gallery restored'); });
$('#g-value').addEventListener('click', () => {
    try { notify(gallery.getValue() || '(empty gallery)'); }
    catch (_) { notify('Pending images: upload them before serializing'); }
});
$('#g-save').addEventListener('click', async () => {
    const state = gallery.getState();
    let serial = 0;
    // Keep a local File/Blob or existing file path; no Base64 or network is required.
    // The demo has no backend: a local object URL stands in for a saved file.
    const saved = state.images.map(item => {
        const name = item.status === 'saved' ? item.filename : `demo-upload-${++serial}.png`;
        // In this in-memory demo, object URLs are illustrative only; a real
        // backend would return stable file URLs after persisting each upload.
        const src = item.file instanceof Blob ? URL.createObjectURL(item.file) : item.src;
        if (item.file instanceof Blob) demoOwnedUrls.add(src);
        return { filename: name, src };
    });
    gallery.setImages(saved);
    inspect('simulated save'); notify('Demo state committed in memory. No files were uploaded.');
});
$('#g-add-example').addEventListener('click', async () => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 440;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 600, 440);
    gradient.addColorStop(0, '#c4b2fe'); gradient.addColorStop(1, '#6097b6');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 600, 440);
    ctx.fillStyle = '#ffdebf'; ctx.beginPath(); ctx.ellipse(290, 310, 174, 43, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fcf7ec'; ctx.beginPath();ctx.moveTo(280, 310);ctx.lineTo(280, 80);ctx.lineTo(425, 301);ctx.fill();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    gallery.addFiles([new File([blob], 'demo-new-photo.png', { type: 'image/png' })]);
});
const preferred = matchMedia('(prefers-color-scheme: dark)');
let mode = 'light';
function theme() { document.documentElement.dataset.theme = mode === 'system' ? (preferred.matches ? 'dark' : 'light') : mode; all('#theme-switch button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode))); }
all('#theme-switch button').forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode; theme(); }));
preferred.addEventListener?.('change', () => { if (mode === 'system') theme(); });
let toastTimer;
function notify(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 2500); }
all('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const snippet = $('#' + button.dataset.copy);
    // Clipboard API is not consistently available for local file:// documents.
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(snippet.textContent); notify('Code copied'); return; }
        catch (_) { /* Try the legacy clipboard API or leave the snippet selected. */ }
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(snippet);
    selection.removeAllRanges();
    selection.addRange(range);
    try {
        if (document.execCommand('copy')) {
            selection.removeAllRanges();
            notify('Code copied');
            return;
        }
    } catch (_) { /* The selected snippet can still be copied manually. */ }
    notify('Code selected — press Cmd+C / Ctrl+C to copy');
}));

window.addEventListener('pagehide', clearDemoUrls);
