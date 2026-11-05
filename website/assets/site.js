/* Shared site interactions; no libraries or runtime server dependencies. */
(() => {
  const toggle = document.querySelector('[data-menu]');
  const navigation = document.querySelector('[data-site-nav]');
  toggle?.addEventListener('click', () => {
    const open = navigation?.classList.toggle('is-open') ?? false;
    toggle.setAttribute('aria-expanded', String(open));
  });
  navigation?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navigation.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));
  const search = document.querySelector('[data-catalog-search]');
  const filters = [...document.querySelectorAll('[data-filter]')];
  let category = 'All';
  function applyFilters() {
    const query = search?.value.toLocaleLowerCase().trim() || '';
    let visible = 0;
    document.querySelectorAll('[data-component-card]').forEach(card => {
      const matchText = !query || card.dataset.search.includes(query);
      const matchCategory = category === 'All' || card.dataset.category === category;
      card.hidden = !(matchText && matchCategory);
      if (!card.hidden) visible++;
    });
    const count = document.querySelector('[data-count]');
    if (count) count.textContent = `${visible} components`;
  }
  search?.addEventListener('input', applyFilters);
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    applyFilters();
  }));
  applyFilters();
  // The Panda-Softs portal lives in its own Pages repository in production.
  // In the local file:// preview, these links lead to the sibling TinySuite build.
  if (location.protocol !== 'file:') {
    document.querySelectorAll('[data-tinysuite-link]').forEach(link => {
      link.href = 'https://panda-softs.github.io/TinySuite/';
    });
  }
  // Direct file:// opening resolves links to directories inconsistently.
  if (location.protocol === 'file:') {
    document.querySelectorAll('a[href]').forEach(link => {
      const raw = link.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('//')) return;
      const target = new URL(raw, document.baseURI);
      if (target.protocol === 'file:' && target.pathname.endsWith('/')) {
        target.pathname += 'index.html';
        link.href = target.href;
      }
    });
  }
})();
