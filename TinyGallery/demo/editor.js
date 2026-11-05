'use strict';
/** Demo cropper adapter. The gallery/lightbox core has no dependency on it. */
function createDemoCropEditor() {
    const dialog = document.querySelector('#crop-dialog');
    const canvas = document.querySelector('#editor-canvas');
    const context = canvas.getContext('2d');
    const zoom = document.querySelector('#editor-zoom');
    const x = document.querySelector('#editor-x');
    const y = document.querySelector('#editor-y');
    const file = document.querySelector('#editor-file');
    let image, resolver, ownedUrl;
    const help = document.createElement('p');
    help.setAttribute('role', 'status');
    help.style.cssText = 'color:#a75649;font-size:12px;line-height:1.5;margin-top:8px';
    document.querySelector('#editor-apply').closest('.editor-actions').before(help);
    const message = text => { help.textContent = text || ''; };
    function paint() {
        if (!image) return;
        // Reset bitmap as well as pixels: a previous file:// sample may have
        // tainted the canvas; a user-selected File/Blob must be exportable.
        canvas.width = 450;
        context.clearRect(0, 0, 450, 450);
        context.fillStyle = '#eae8f7'; context.fillRect(0, 0, 450, 450);
        const scale = Math.max(450 / image.naturalWidth, 450 / image.naturalHeight) * Number(zoom.value);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        const dx = (450 - w) / 2 + (450 - w) * Number(x.value) / 200;
        const dy = (450 - h) / 2 + (450 - h) * Number(y.value) / 200;
        context.drawImage(image, dx, dy, w, h);
    }
    async function load(source) {
        const img = new Image(); img.decoding = 'async';
        img.src = source;
        await img.decode(); image = img; paint();
    }
    [zoom, x, y].forEach(input => input.addEventListener('input', paint));
    file.addEventListener('change', async () => {
        const selected = file.files[0]; if (!selected) return;
        if (ownedUrl) URL.revokeObjectURL(ownedUrl);
        ownedUrl = URL.createObjectURL(selected);
        try { message(''); await load(ownedUrl); }
        catch (error) { alert('Unable to load the selected image.'); }
    });
    function finish(value) {
        if (!resolver) return;
        const resolve = resolver; resolver = null; dialog.close();
        if (ownedUrl) URL.revokeObjectURL(ownedUrl);
        ownedUrl = null; image = null; resolve(value);
    }
    document.querySelector('#editor-close').addEventListener('click', () => finish(null));
    document.querySelector('#editor-cancel').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    document.querySelector('#editor-apply').addEventListener('click', () => {
        try {
            canvas.toBlob(blob => {
                if (blob) finish(blob);
                else message('Unable to export this image. Choose a local file in the editor.');
            }, 'image/png');
        } catch (error) {
            if (error.name === 'SecurityError') {
                // Some browsers render file:// SVG but prohibit reading pixels.
                // File objects explicitly chosen by the user are safe to export.
                message('This browser prevents exporting a bundled file:// image. Choose the same SVG (demo/images/lake) or another local file with “Replace with another image” to crop it.');
            } else {
                message('Export failed: ' + error.message);
            }
        }
    });
    return async src => {
        if (resolver) return null;
        zoom.value = '1'; x.value = '0'; y.value = '0'; file.value = ''; message('');
        try { await load(src); } catch (error) { alert('Image could not be loaded for editing.'); return null; }
        dialog.showModal();
        return new Promise(resolve => { resolver = resolve; });
    };
}
