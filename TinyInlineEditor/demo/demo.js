(function ($) {
  'use strict';

  const main = document.getElementById('editor-main');
  const original = main.innerHTML;
  const output = document.getElementById('html-preview');
  const status = document.getElementById('edit-status');
  const statusDetail = document.getElementById('edit-status-description');
  const toast = document.getElementById('toast');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';
  let toastTimer;
  let edits = 0;

  function selectedTheme() {
    return mode === 'system' ? (prefersDark.matches ? 'dark' : 'light') : mode;
  }

  function applyTheme() {
    const theme = selectedTheme();
    document.documentElement.setAttribute('data-theme', theme);
    $('.js-inline').tinyInlineEditor('set', { theme });
    document.querySelectorAll('#theme-switch button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1900);
  }

  function plainText(element) {
    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function updateMainInspector(edited) {
    const value = plainText(main);
    document.getElementById('words-count').textContent = value ? value.split(/\s+/).length : 0;
    document.getElementById('chars-count').textContent = value.length;
    const source = main.innerHTML.trim();
    output.textContent = source.length > 950 ? source.slice(0, 950) + '\n…' : source;
    if (edited) {
      edits += 1;
      status.textContent = 'Contenu modifié';
      statusDetail.textContent = `${edits} modification${edits > 1 ? 's' : ''} détectée${edits > 1 ? 's' : ''}`;
    }
  }

  function updateTextareaCount(api) {
    const text = plainText(api.trigger);
    document.getElementById('textarea-count').textContent = `${text.length} caractère${text.length !== 1 ? 's' : ''}`;
  }

  function setSaveState(label, state) {
    document.getElementById('save-label').textContent = label;
    const dot = document.getElementById('save-indicator');
    dot.className = state || '';
  }

  // Each element owns an independent TinyInlineEditor instance.
  $('#editor-main').tinyInlineEditor({ theme: selectedTheme(), onChange: () => updateMainInspector(true) });
  $('#editor-minimal').tinyInlineEditor({ theme: selectedTheme(), toolbar: ['bold', 'italic'] });
  $('#editor-colors').tinyInlineEditor({
    theme: selectedTheme(),
    toolbar: ['bold', 'italic', 'color', 'link'],
    colors: ['#8b5cf6', '#e98aa8', '#f5b75a', '#2fc6a4', '#6376d8', '#293651']
  });
  $('#editor-autosave').tinyInlineEditor({
    theme: selectedTheme(),
    toolbar: ['bold', 'italic', 'underline', 'link'],
    onChange: () => setSaveState('Modification détectée…', 'saving'),
    onSave: () => {
      setSaveState('Sauvegarde locale…', 'saving');
      return new Promise((resolve) => window.setTimeout(() => {
        setSaveState('Sauvegardé (simulation)', 'saved');
        resolve(true);
      }, 650));
    }
  });
  document.getElementById('save-now').addEventListener('click', async () => {
    const api = $('#editor-autosave').data('inLine');
    if (!api) return;
    setSaveState('Enregistrement…', 'saving');
    const success = await api.flush();
    setSaveState(success ? 'Sauvegardé (simulation)' : 'Enregistrement indisponible', success ? 'saved' : 'error');
    notify(success ? 'Contenu enregistré' : 'Aucun contenu à enregistrer, ou échec');
  });
  $('#editor-textarea').tinyInlineEditor({
    theme: selectedTheme(),
    toolbar: ['bold', 'italic', 'unorderedList', 'link'],
    onReady: updateTextareaCount,
    onChange: updateTextareaCount
  });
  updateMainInspector(false);
  applyTheme();

  document.querySelectorAll('#theme-switch button').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      applyTheme();
    });
  });
  if (typeof prefersDark.addEventListener === 'function') {
    prefersDark.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
  }

  document.getElementById('reset-main').addEventListener('click', () => {
    const api = $('#editor-main').data('inLine');
    if (!api) return;
    api.trigger.innerHTML = original;
    api.commitChange();
    notify('Contenu restauré');
  });

  async function copy(text, message) {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      notify(message);
    } catch (error) {
      // Local file:// pages may lack clipboard permissions. Do not misreport success.
      notify('Copie indisponible : ouvrez la démo sur localhost en HTTPS ou HTTP.');
    }
  }

  document.getElementById('copy-html').addEventListener('click', () => copy(main.innerHTML.trim(), 'HTML copié dans le presse-papiers'));
  document.getElementById('copy-code').addEventListener('click', () => copy(`$('#my-editor').tinyInlineEditor({\n  theme: 'dark',\n  toolbar: ['bold', 'italic', 'link'],\n  onChange: api => console.log(api.content)\n});`, 'Exemple JavaScript copié'));

  function selectExcerpt() {
    const target = main.querySelector('.lead strong');
    if (!target || !target.firstChild) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    main.focus();
    // Trigger the editor's desktop selection workflow.
    main.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  document.getElementById('select-sample').addEventListener('click', selectExcerpt);
  document.getElementById('start-demo').addEventListener('click', () => {
    window.setTimeout(selectExcerpt, 450);
  });
})(jQuery);
