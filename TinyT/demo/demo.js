(() => {
  'use strict';

  // Production defaults. Development can enable both diagnostics and one global reporter.
  TinyT.configure({ missingToUndefined: false, onMissing: null });

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  // These helpers stay local to this demo and are injected only into TinyT renderers.
  const helpers = {
    escapeHtml,
    uppercase: value => String(value ?? '').toUpperCase(),
    formatMoney: value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0),
    display_date: value => {
      const date = new Date(String(value ?? '').replace(' ', 'T'));
      return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('fr-CH').format(date);
    },
    planLabel: plan => ({ starter: 'Starter', pro: 'Professional', enterprise: 'Enterprise' })[plan] || plan,
    apiCode: value => `<code>${escapeHtml(value)}</code>`
  };

  const defaultStudioTemplate = `<article class="tt-demo-live-card">
  <span class="tt-demo-badge">\${planLabel(plan)}</span>
  <h3>Welcome, \${escapeHtml(name)}</h3>
  <p>Your current subscription is \${formatMoney(price)} per month.</p>

  {{if showDetails}}
    <p>Account details are visible.</p>
  {{else}}
    <p>Account details are hidden.</p>
  {{/if}}

  <ul>
    {{each features as feature, featureIndex}}
      <li>
        <span>\${escapeHtml(feature)}</span>
        <small>#\${$index} · alias #\${featureIndex}</small>
      </li>
    {{/each}}
  </ul>
</article>`;

  const templateMap = {
    'loop-item': `<li class="tt-loop-item">
  <span class="tt-loop-index">\${$index + 1}</span>
  <span><strong>\${escapeHtml(name)}</strong><br><small>Nested child received $index automatically.</small></span>
  <span class="tt-loop-meta">$index=\${$index} · position=\${position}</span>
</li>`,

    'loop-main': `<ul class="tt-loop-list">
{{each items as item, position}}
  {{tmpl({ ...item, position }) "#loop-item"}}
{{/each}}
</ul>`,

    'default-loop': `<div class="tt-demo-toolbar">
{{each tags}}
  <span class="tt-demo-badge">\${$index}: \${escapeHtml($value)}</span>
{{/each}}
</div>`,

    conditional: `{{if score >= 90}}<strong>Excellent</strong> — score \${score}
{{elsif score >= 70}}<strong>Good</strong> — score \${score}
{{else}}<strong>Keep going</strong> — score \${score}{{/if}}`,

    helper: `<strong>\${uppercase(name)}</strong><br><span>Total: \${formatMoney(total)}</span><br><span>Date: \${display_date(date)}</span>`,

    'array-item': `<div class="tt-api-item">
  <strong>\${rowNumber}. \${escapeHtml(name)}</strong>
  <span>\${escapeHtml(description)}</span>
  <span class="tt-api-meta">array wrapper</span>
</div>`,

    'jquery-message': `<strong>jQuery integration</strong><br><span>\${message}</span>`,

    'syntax-edge': '<strong>${"}"}</strong><br><span>${`template } literal`}</span><br><span>regex: ${/}/.test("}")}</span><br>{{if value === "}}"}}<span>directive: safe</span>{{/if}}',

    'api-row': `<tr>
  <td>\${apiCode(method)}</td>
  <td>\${escapeHtml(purpose)}</td>
  <td>\${apiCode(returns)}</td>
</tr>`
  };

  const renderers = TinyT.compileTemplateMap(templateMap, { strict: false, helpers });

  const elements = {
    studioTemplate: document.getElementById('demo-template'),
    studioOutput: document.getElementById('studio-output'),
    studioStatus: document.getElementById('studio-status'),
    missingSummary: document.getElementById('missing-summary'),
    name: document.getElementById('demo-name'),
    plan: document.getElementById('demo-plan'),
    price: document.getElementById('demo-price'),
    details: document.getElementById('demo-details')
  };

  let includeMissingVariable = false;

  const getStudioData = () => ({
    name: elements.name.value,
    plan: elements.plan.value,
    price: Number(elements.price.value),
    showDetails: elements.details.checked,
    features: ['Reserved $index', 'Helpers', 'Nested templates']
  });

  const setStudioStatus = (label, state = '') => {
    elements.studioStatus.textContent = label;
    elements.studioStatus.className = `tt-demo-status${state ? ` ${state}` : ''}`;
  };

  const renderStudio = () => {
    const source = includeMissingVariable
      ? `${elements.studioTemplate.value}\n<p>Missing example: \${unknownProfileLabel}</p>`
      : elements.studioTemplate.value;
    const missingNames = [];

    try {
      const renderer = TinyT.compile(source, { strict: false });
      elements.studioOutput.innerHTML = renderer(getStudioData(), {
        helpers,
        missingToUndefined: true,
        onMissing: names => missingNames.push(...names)
      });

      elements.missingSummary.textContent = missingNames.length
        ? `Missing: ${[...new Set(missingNames)].join(', ')}`
        : 'No missing identifiers';
      setStudioStatus(missingNames.length ? 'Rendered with warnings' : 'Rendered', missingNames.length ? 'is-warning' : '');
    } catch (error) {
      elements.studioOutput.textContent = error.message;
      elements.missingSummary.textContent = 'Render failed';
      setStudioStatus('Template error', 'is-error');
    }
  };

  elements.studioTemplate.value = defaultStudioTemplate;

  document.querySelector('[data-studio-action="render"]').addEventListener('click', renderStudio);
  document.querySelector('[data-studio-action="reset-template"]').addEventListener('click', () => {
    elements.studioTemplate.value = defaultStudioTemplate;
    includeMissingVariable = false;
    renderStudio();
  });
  document.querySelector('[data-studio-action="toggle-missing"]').addEventListener('click', () => {
    includeMissingVariable = !includeMissingVariable;
    renderStudio();
  });

  [elements.name, elements.plan, elements.price, elements.details].forEach(element => {
    element.addEventListener(element.type === 'checkbox' ? 'change' : 'input', renderStudio);
  });

  document.getElementById('loop-output').innerHTML = renderers['loop-main']({
    items: [
      { name: 'First rental' },
      { name: 'Second rental', index: 900 },
      { name: 'Third rental' }
    ]
  });

  document.getElementById('default-loop-output').innerHTML = renderers['default-loop']({
    tags: ['fast', 'small', 'reusable', 'nested']
  });

  document.getElementById('conditional-output').innerHTML = renderers.conditional({ score: 82 });
  document.getElementById('helper-output').innerHTML = renderers.helper({ name: 'tiny templating', total: 149.5, date: '2026-07-06 16:55:00' });

  const missingLog = document.getElementById('missing-log');
  const missingTemplate = `<strong>\${escapeHtml(title)}</strong><br><span>Owner: \${ownerName}</span>`;

  // Demonstrate the 3.8 global diagnostics contract: render options only need helpers here.
  TinyT.configure({
    missingToUndefined: true,
    onMissing: names => {
      missingLog.replaceChildren(...names.map(name => {
        const item = document.createElement('li');
        item.textContent = `Missing identifier: ${name}`;
        return item;
      }));
    }
  });
  document.getElementById('missing-output').innerHTML = TinyT.render(
    missingTemplate,
    { title: 'Diagnostics demo' },
    { helpers }
  );
  TinyT.configure({ missingToUndefined: false, onMissing: null });

  const arrayRows = [
    { name: 'compile', description: 'Compile once and reuse.' },
    { name: 'render', description: 'Compile and render in one call.' },
    { name: 'renderTo', description: 'Render directly into an element.' }
  ];
  document.getElementById('array-output').innerHTML = renderers['array-item'](arrayRows, {
    rowTransform: (row, index) => ({ ...row, rowNumber: index + 1 })
  });

  document.getElementById('syntax-output').innerHTML = renderers['syntax-edge']({ value: '}}' });

  TinyT.registerTemplate('welcome-card', TinyT.getTemplate('#dom-welcome-template'));
  TinyT.renderTo(document.getElementById('registry-output'), '#welcome-card', {
    title: 'Registry-backed render',
    message: 'Loaded from a DOM template, registered, then rendered with renderTo().'
  });

  TinyT.registerTemplate('jquery-message', templateMap['jquery-message']);
  $('#jquery-output').tmplTo('jquery-message', { message: 'Rendered through $.fn.tmplTo().' });

  const apiRows = [
    { method: 'configure(options)', purpose: 'Set global missingToUndefined and onMissing defaults.', returns: 'Object' },
    { method: 'registerTemplate(id, tpl)', purpose: 'Register or replace a template in memory.', returns: 'void' },
    { method: 'getTemplate(id)', purpose: 'Read a registered template or load it from the DOM.', returns: 'string' },
    { method: 'compile(tpl, opts)', purpose: 'Compile and cache a reusable renderer.', returns: 'Function' },
    { method: 'render(tpl, data, opts)', purpose: 'Render a template string or registered template id.', returns: 'string' },
    { method: 'renderTo(el, tpl, data, opts)', purpose: 'Render and assign the result to element.innerHTML.', returns: 'string' },
    { method: 'compileTemplateMap(defs, opts)', purpose: 'Register and precompile a complete template map.', returns: 'Object' },
    { method: 'clearCache()', purpose: 'Clear compiled renderers while keeping registered template sources.', returns: 'void' },
    { method: 'cacheSize()', purpose: 'Return the number of cached compiled renderers.', returns: 'number' }
  ];
  document.getElementById('api-table-body').innerHTML = renderers['api-row'](apiRows);

  renderStudio();
})();
