class SourceManager {
  constructor(calendar) {
    this.calendar = calendar;
    this.eventSources = [];
    this.resourceSources = [];
    this.cache = new Map();
  }

  setEventSources(sources) {
    this.eventSources = this.normalizeSources(sources, 'events');
    return this;
  }

  setResourceSources(sources) {
    this.resourceSources = this.normalizeSources(sources, 'resources');
    return this;
  }

  getEventSources() {
    return this.eventSources.slice();
  }

  getResourceSources() {
    return this.resourceSources.slice();
  }

  addEventSource(source) {
    this.eventSources.push(this.normalizeSource(source, this.eventSources.length, 'events'));
    return this;
  }

  removeEventSource(sourceId) {
    this.eventSources = this.eventSources.filter(source => source.id !== sourceId);
    return this;
  }

  addResourceSource(source) {
    this.resourceSources.push(this.normalizeSource(source, this.resourceSources.length, 'resources'));
    return this;
  }

  removeResourceSource(sourceId) {
    this.resourceSources = this.resourceSources.filter(source => source.id !== sourceId);
    return this;
  }

  normalizeSources(sources, field) {
    const list = Array.isArray(sources) ? sources : (isNil(sources) ? [] : [sources]);
    return list.map((source, index) => this.normalizeSource(source, index, field)).filter(Boolean);
  }

  normalizeSource(source, index, field) {
    const fallbackId = `${field}-source-${index + 1}`;

    if (Array.isArray(source)) {
      return { id: fallbackId, type: 'array', [field]: source, cache: true };
    }

    if (isStr(source)) {
      return { id: fallbackId, type: 'url', url: source, method: 'GET', headers: {}, credentials: 'same-origin', extraParams: {}, cache: true };
    }

    if (isFn(source)) {
      return { id: fallbackId, type: 'function', [field]: source, cache: false };
    }

    if (isObj(source)) {
      if (Array.isArray(source[field])) return { ...source, id: source.id || fallbackId, type: 'array', cache: source.cache !== false };
      if (isFn(source[field])) return { ...source, id: source.id || fallbackId, type: 'function', cache: source.cache === true };
      if (source.url) return { method: 'GET', headers: {}, credentials: 'same-origin', extraParams: {}, cache: true, ...source, id: source.id || fallbackId, type: 'url' };
    }

    return null;
  }

  async fetchEvents(range) {
    const results = await this.fetchSources(this.eventSources, range, 'events');

    return results
      .flat()
      .map((event, index) => this.transformEvent(event, index, range))
      .map((event, index) => {
        if (!event) return null;
        return normalizeEvent({ id: event.id ?? `event-${index}`, ...event }, event.__source || null, this.calendar.options);
      })
      .filter(Boolean);
  }

  /**
   * Fetch and normalize resources from all configured resource sources.
   *
   * Resource payloads can be transformed globally with options.resourceTransform
   * or per source with source.resourceTransform. This keeps API-specific mapping
   * out of views and prevents page scripts from duplicating source logic.
   *
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @returns {Promise<Array<Object>>}
   */
  async fetchResources(range) {
    const results = await this.fetchSources(this.resourceSources, range, 'resources');

    return results
      .flat()
      .map((resource, index) => this.transformResource(resource, index, range))
      .map(resource => resource ? normalizeResource(resource) : null)
      .filter(Boolean);
  }

  async fetchSources(sources, range, field) {
    const settled = await Promise.allSettled(sources.map(source => this.fetchSource(source, range, field)));
    const records = [];

    settled.forEach((result, index) => {
      const source = sources[index];

      if (result.status === 'fulfilled') {
        records.push(...result.value);
        return;
      }

      this.handleSourceError({ error: result.reason, source, range, field });
    });

    return records;
  }

  /**
   * Fetch one source with optional static-source support.
   *
   * Static sources are useful for resources such as rooms, boats or staff lists
   * that do not depend on the current visible date range. They are loaded once,
   * cached with a stable key and requested without start/end/timeZone params.
   *
   * @param {Object} source - Normalized source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @param {'events'|'resources'} field - Source field.
   * @returns {Promise<Array<Object>>}
   */
  async fetchSource(source, range, field) {
    const cacheKey = this.getSourceCacheKey(source, range, field);

    if (source.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let data = [];

    if (source.type === 'array') {
      data = source[field] || [];
    }

    if (source.type === 'function') {
      data = await source[field](this.createSourceRequestContext(source, range));
    }

    if (source.type === 'url') {
      data = await this.fetchJsonSource(source, range);
    }

    if (isFn(source.transformResponse)) {
      data = source.transformResponse(data);
    }

    const items = (Array.isArray(data) ? data : (data?.[field] || []))
      .map(item => ({ ...item, __source: source }));

    if (source.cache !== false) this.cache.set(cacheKey, items);
    if (isFn(source.success)) source.success(items);

    return items;
  }

  /**
   * Return true when this source must not receive range parameters.
   *
   * Supported source flags:
   * - static: true
   * - range: false
   * - rangeParams: false
   * - includeRangeParams: false
   *
   * @param {Object} source - Source definition.
   * @returns {boolean}
   */
  isStaticSource(source) {
    return source.static === true
      || source.range === false
      || source.rangeParams === false
      || source.includeRangeParams === false;
  }

  /**
   * Build a stable cache key. Static sources are cached independently of date.
   *
   * @param {Object} source - Source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @param {'events'|'resources'} field - Source field.
   * @returns {string}
   */
  getSourceCacheKey(source, range, field) {
    if (this.isStaticSource(source)) {
      return `${source.id}:${field}:static`;
    }

    return `${source.id}:${field}:${formatDateKey(range.start)}:${formatDateKey(range.end)}`;
  }

  /**
   * Build the context passed to function sources.
   *
   * Static sources receive null start/end values to make the no-range contract
   * explicit for custom loaders.
   *
   * @param {Object} source - Source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @returns {Object}
   */
  createSourceRequestContext(source, range) {
    if (this.isStaticSource(source)) {
      return {
        start: null,
        end: null,
        view: this.calendar.getView(),
        timezone: this.calendar.options.timezone,
        source,
        calendar: this.calendar
      };
    }

    return {
      start: formatIsoLocal(range.start),
      end: formatIsoLocal(range.end),
      view: this.calendar.getView(),
      timezone: this.calendar.options.timezone,
      source,
      calendar: this.calendar
    };
  }

  transformEvent(rawEvent, index, range) {
    let event = rawEvent;
    const source = rawEvent?.__source || null;
    const context = {
      index,
      range,
      source,
      sourceId: source?.id || null,
      calendar: this.calendar
    };

    if (isFn(source?.eventTransform)) {
      event = source.eventTransform(event, context);
    }

    if (!event) return null;

    if (isFn(this.calendar.options.eventTransform)) {
      event = this.calendar.options.eventTransform(event, context);
    }

    if (!event) return null;

    return { ...event, __source: source };
  }

  /**
   * Transform one raw resource before normalization.
   *
   * @param {Object} rawResource - Raw source resource.
   * @param {number} index - Resource index in the flattened result.
   * @param {{start: Date, end: Date}} range - Fetch range.
   * @returns {Object|null}
   */
  transformResource(rawResource, index, range) {
    let resource = rawResource;
    const source = rawResource?.__source || null;
    const context = {
      index,
      range,
      source,
      sourceId: source?.id || null,
      calendar: this.calendar
    };

    if (isFn(source?.resourceTransform)) {
      resource = source.resourceTransform(resource, context);
    }

    if (!resource) return null;

    if (isFn(this.calendar.options.resourceTransform)) {
      resource = this.calendar.options.resourceTransform(resource, context);
    }

    if (!resource) return null;

    return { ...resource, __source: source };
  }

  handleSourceError({ error, source, range, field }) {
    const errorInfo = this.createSourceErrorInfo({ error, source, range, field });
    let failureCallbackWasCalled = false;

    const failureCallback = nextError => {
      failureCallbackWasCalled = true;
      const nextErrorInfo = this.createSourceErrorInfo({ error: nextError || error, source, range, field });
      this.emitSourceError(nextErrorInfo);
      return nextErrorInfo;
    };

    const sourceFailure = source?.failure || source?.onError;

    if (isFn(sourceFailure)) {
      const result = sourceFailure(errorInfo, failureCallback);

      if (result === false) return errorInfo;
      if (failureCallbackWasCalled) return errorInfo;
      if (result instanceof Error) return failureCallback(result);
    }

    return failureCallback(error);
  }

  emitSourceError(errorInfo) {
    this.calendar._notify('dataSourceError', errorInfo);
    this.calendar._notify(errorInfo.field === 'events' ? 'eventsLoadError' : 'resourcesLoadError', errorInfo);
    return errorInfo;
  }

  createSourceErrorInfo({ error, source, range, field }) {
    return {
      type: 'dataSourceError',
      field,
      source,
      sourceId: source?.id || null,
      sourceType: source?.type || null,
      range,
      error,
      message: error?.message || 'Unable to load datasource',
      status: error?.status || null,
      statusText: error?.statusText || null,
      responseText: error?.responseText || null,
      response: error?.response || null,
      calendar: this.calendar
    };
  }

  buildSourceRequestUrl(source, range) {
    const method = (source.method || 'GET').toUpperCase();
    const url = new URL(source.url, root.location?.href || 'http://localhost/');
    const extraParams = isFn(source.extraParams) ? source.extraParams() : (source.extraParams || {});

    if (method === 'GET') {
      const rangeParams = this.isStaticSource(source)
        ? {}
        : {
          [source.startParam || 'start']: formatIsoLocal(range.start),
          [source.endParam || 'end']: formatIsoLocal(range.end),
          [source.timeZoneParam || 'timeZone']: this.calendar.options.timezone
        };

      Object.entries({ ...rangeParams, ...extraParams }).forEach(([key, value]) => {
        if (!isNil(value)) url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  buildSourceRequestOptions(source, range) {
    const method = (source.method || 'GET').toUpperCase();
    const requestOptions = {
      method,
      headers: Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, source.headers || {}),
      credentials: source.credentials || 'same-origin'
    };

    if (method !== 'GET') {
      const extraParams = isFn(source.extraParams) ? source.extraParams() : (source.extraParams || {});
      const rangeBody = this.isStaticSource(source)
        ? {}
        : {
          [source.startParam || 'start']: formatIsoLocal(range.start),
          [source.endParam || 'end']: formatIsoLocal(range.end),
          [source.timeZoneParam || 'timeZone']: this.calendar.options.timezone
        };
      const body = { ...rangeBody, ...extraParams, ...(source.body || {}) };

      if (!requestOptions.headers['Content-Type']) requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(body);
    }

    return requestOptions;
  }

  async fetchJsonSource(source, range) {
    const response = await fetch(this.buildSourceRequestUrl(source, range), this.buildSourceRequestOptions(source, range));
    const responseText = await response.text();

    if (!response.ok) {
      const error = new Error(`Unable to load datasource "${source.id || source.url}": ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseText = responseText;
      error.response = response;
      throw error;
    }

    if (!responseText) return [];

    try {
      return JSON.parse(responseText);
    } catch (error) {
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseText = responseText;
      error.response = response;
      throw error;
    }
  }
}
