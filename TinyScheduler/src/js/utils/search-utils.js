function normalizeSearchText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function matchesEventSearch(event, query, resource = null, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const searchableParts = [];
  if (options.includeTitle !== false) searchableParts.push(event.title);
  if (options.includeText !== false) searchableParts.push(event.text);
  if (options.includeResourceTitle !== false && resource?.title) searchableParts.push(resource.title);
  if (options.includeMeta) searchableParts.push(JSON.stringify(event.meta || {}));
  return searchableParts.filter(Boolean).some(value => normalizeSearchText(value).includes(normalizedQuery));
}
