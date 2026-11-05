'use strict';
const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const images = all('#gallery [data-lightbox]').map((element, index) => ({
    id: element.dataset.lightboxId || `photo-${index + 1}`, src: element.dataset.lightboxSrc,
    alt: element.querySelector('img').alt, title: element.dataset.lightboxTitle,
    description: element.dataset.lightboxDescription,
    srcset: index === 0 ? element.dataset.lightboxSrc + ' 1x' : '',
    sizes: '(max-width: 640px) 100vw, 80vw',
    thumbnail: element.querySelector('img')
}));
const viewer = new TinyLightbox('#gallery', { images, onEdit: async image => {
    const next = prompt('Optional demo editor: new image URL (cancel leaves it unchanged)', image.src);
    return next && next !== image.src ? { src: next } : null;
}});
window.demoViewer = viewer;
const history = [];
function log(event, detail) {
    history.unshift(`${new Date().toLocaleTimeString()}  ${event}${detail ? ' · ' + detail : ''}`);
    $('#event-log').textContent = history.slice(0, 8).join('\n');
}
viewer.on('open', image => { $('#lb-state').textContent = 'Viewer open'; $('#lb-description').textContent = image.title; log('open', image.id); });
viewer.on('change', image => { $('#lb-index').textContent = `${viewer.index + 1} / ${viewer.images.length}`; $('#lb-description').textContent = image.title; log('change', image.id); });
viewer.on('close', () => { $('#lb-state').textContent = 'Viewer closed'; log('close'); });
viewer.on('zoom', data => { $('#lb-zoom').textContent = `${data.scale.toFixed(1)}×`; log('zoom', `${data.scale.toFixed(1)}×`); });
viewer.on('load', image => log('image loaded', image.id));
viewer.on('imageError', image => log('load error', image.id));
viewer.on('edited', image => log('edited', image.id));
viewer.on('beforeChange', data => log('beforeChange', data.to.id));
viewer.on('afterChange', image => log('afterChange', image.id));
viewer.on('beforeClose', () => log('beforeClose'));
viewer.on('afterClose', () => log('afterClose'));
$('#loop').addEventListener('change', event => { viewer.options.loop = event.target.checked; log('loop', String(event.target.checked)); });
$('#wheel').addEventListener('change', event => { viewer.options.wheelZoom = event.target.checked; log('wheel zoom', String(event.target.checked)); });
$('#swipe').addEventListener('change', event => { viewer.options.swipe = event.target.checked; log('swipe', String(event.target.checked)); });
$('#zoom-max').addEventListener('change', event => { viewer.options.maxZoom = Number(event.target.value); log('max zoom', event.target.value); });
$('#open-first').addEventListener('click', () => viewer.open(0));
$('#show-error').addEventListener('click', () => { viewer.setImages([{ id: 'broken', src: './images/lake/image-not-found.webp', title: 'Intentional missing image' }]); viewer.open(0); log('error test'); });
$('#replace-set').addEventListener('click', () => { viewer.setImages(images.slice(0, 3)); log('setImages', '3 photos'); });
$('#reset-set').addEventListener('click', () => { viewer.setImages(images); log('setImages', '6 photos'); });
// Advanced controls: these settings are applied to the same live TinyLightbox instance.
$('#mouse-swipe').addEventListener('change', event => { viewer.options.mouseSwipe = event.target.checked; log('mouse swipe', String(event.target.checked)); });
$('#vertical-close').addEventListener('change', event => { viewer.options.verticalClose = event.target.checked; log('vertical close', String(event.target.checked)); });
for (const key of ['open', 'change', 'close']) {
    $(`#effect-${key}`).addEventListener('change', event => {
        viewer.options.effects[key] = event.target.value;
        log(`${key} effect`, event.target.value);
    });
}
for (const name of ['swipe-threshold', 'swipe-velocity']) {
    $(`#${name}`).addEventListener('input', event => {
        const key = name === 'swipe-threshold' ? 'swipeThreshold' : 'swipeVelocity';
        viewer.options[key] = Number(event.target.value);
        $(`#${name}-value`).textContent = event.target.value + (key === 'swipeThreshold' ? ' px' : ' px/ms');
    });
}
$('#caption-position').addEventListener('change', event => {
    viewer.options.captionPosition = event.target.value;
    log('caption', event.target.value);
    if (viewer.isOpen) viewer.setImages(viewer.images);
});
let inserted = false;
$('#insert-slide').addEventListener('click', () => {
    if (viewer.images.some(item => item.id === 'inserted')) return notify('Extra image already inserted');
    viewer.insertSlide({ ...images[5], id: 'inserted', title: 'Inserted lake scene' }, 1);
    inserted = true;
    log('insertSlide', 'position 2'); notify('Added extra image at position 2');
});
$('#remove-slide').addEventListener('click', () => {
    const id = viewer.images.some(item => item.id === 'inserted') ? 'inserted' : viewer.images.at(-1)?.id;
    if (id && viewer.removeSlide(id)) { log('removeSlide', id); notify('Slide removed'); }
});
$('#reload').addEventListener('click', () => { viewer.reload(); log('reload', 'DOM'); notify('Gallery reloaded from thumbnails'); });
$('#once-event').addEventListener('click', () => {
    viewer.once('afterChange', item => notify('Once fired for ' + item.id));
    notify('once() registered — navigate to another photo');
});
let custom = false;
$('#custom-icons').addEventListener('click', () => {
    custom = !custom;
    viewer.options.icons = custom ? {
        next: 'M5 12h14m-6-6 6 6-6 6', previous: 'M19 12H5m6-6-6 6 6 6'
    } : {};
    viewer.close({ animate: false });
    log('icons', custom ? 'custom SVG' : 'default');
    notify('Icons updated. Open a photo to see the changes.');
});
let zoomDisabled = false;
$('#no-zoom').addEventListener('click', () => {
    zoomDisabled = !zoomDisabled;
    viewer.setImages(viewer.images.map(image => image.id === 'photo-1' ? { ...image, zoom: !zoomDisabled } : image));
    log('per-image zoom', zoomDisabled ? 'first disabled' : 'first enabled');
    notify('Open image 1 to check the zoom controls.');
});
const prefersDark = matchMedia('(prefers-color-scheme: dark)');
let theme = 'light';
function applyTheme() {
    document.documentElement.dataset.theme = theme === 'system' ? (prefersDark.matches ? 'dark' : 'light') : theme;
    all('#theme-switch button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === theme)));
}
all('#theme-switch button').forEach(button => button.addEventListener('click', () => { theme = button.dataset.mode; applyTheme(); }));
prefersDark.addEventListener?.('change', () => { if (theme === 'system') applyTheme(); });
let toastTimer;
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2100); }
all('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const snippet = $('#' + button.dataset.copy);
    // Graceful fallback under file://, where Clipboard API may be disabled.
    if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(snippet.textContent); notify('Code copied'); return; }
        catch (_) { /* Fall back to selected text. */ }
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
    } catch (_) { /* The selected text remains available for manual copy. */ }
    notify('Code selected — press Cmd+C / Ctrl+C to copy');
}));
