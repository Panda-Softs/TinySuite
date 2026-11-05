function normalizeEvent(rawEvent, source = null, options = DEFAULT_OPTIONS) {
  if (!rawEvent || isNil(rawEvent.id) || isNil(rawEvent.start)) return null;
  const backgroundColor = rawEvent.backgroundColor || rawEvent.color || source?.backgroundColor || source?.color || options.defaultEventColor;
  const textColor = rawEvent.textColor || source?.textColor || (options.autoEventTextColor === false ? (options.defaultEventTextColor || '#ffffff') : getReadableTextColor(backgroundColor));
  const resourceIds = Array.isArray(rawEvent.resourceIds) ? rawEvent.resourceIds.map(String) : (rawEvent.resourceId ? [String(rawEvent.resourceId)] : []);
  const eventStart = parseDateInput(rawEvent.start);
  const eventEnd = rawEvent.end ? parseDateInput(rawEvent.end) : null;
  return {
    id: String(rawEvent.id), title: rawEvent.title || '(No title)', text: rawEvent.text || rawEvent.description || '',
    start: eventStart, end: eventEnd, allDay: Boolean(rawEvent.allDay), resourceId: rawEvent.resourceId ? String(rawEvent.resourceId) : null,
    resourceIds, color: backgroundColor, backgroundColor, textColor, className: rawEvent.className || source?.className || '',
    editable: rawEvent.editable ?? options.editable, sourceId: source?.id || rawEvent.sourceId || null, meta: rawEvent.meta || {}, raw: rawEvent
  };
}


class EventStore extends MicroEvent {
  constructor(options = {}) { super(); this.options = options; this.events = []; this.eventsById = new Map(); }
  setEvents(events) { this.events = []; this.eventsById.clear(); events.forEach(event => this.addEvent(event, false)); this._emit('changed', this.events); return this; }
  addEvent(event, emit = true) { if (!event) return null; this.eventsById.set(event.id, event); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); if (emit) this._emit('changed', this.events); return event; }
  updateEvent(eventId, updates) { const oldEvent = this.eventsById.get(String(eventId)); if (!oldEvent) return null; const updatedRaw = { ...oldEvent.raw, ...oldEvent, ...updates, id: oldEvent.id }; const updatedEvent = normalizeEvent(updatedRaw, { id: oldEvent.sourceId }, this.options); this.eventsById.set(updatedEvent.id, updatedEvent); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); this._emit('changed', this.events); return updatedEvent; }
  deleteEvent(eventId) { const removed = this.eventsById.get(String(eventId)); if (!removed) return null; this.eventsById.delete(String(eventId)); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); this._emit('changed', this.events); return removed; }
  getEvents() { return this.events.slice(); }
  getEventById(eventId) { return this.eventsById.get(String(eventId)) || null; }
  getEventsInRange(start, end) { const rangeStart = parseDateInput(start); const rangeEnd = parseDateInput(end); return this.events.filter(event => { const eventEnd = event.end ? new Date(parseDateInput(event.end).getTime() - 1) : event.start; return eventEnd >= rangeStart && event.start < rangeEnd; }); }
  getEventsForDate(date) { return this.events.filter(event => isEventOnDate(event, date)); }
  getEventsByDate(events = this.events) { const map = new Map(); events.forEach(event => { const cursor = startOfDay(event.start); const last = event.end ? startOfDay(event.end) : startOfDay(event.start); while (cursor <= last) { if (isEventOnDate(event, cursor)) { const key = formatDateKey(cursor); if (!map.has(key)) map.set(key, []); map.get(key).push(event); } cursor.setDate(cursor.getDate() + 1); } }); return map; }
  getEventsByResource(events = this.events) { const map = new Map(); events.forEach(event => { const ids = event.resourceIds?.length ? event.resourceIds : [event.resourceId].filter(Boolean); ids.forEach(id => { if (!map.has(id)) map.set(id, []); map.get(id).push(event); }); }); return map; }
  getEventsByResourceAndDate(events = this.events) { const map = new Map(); events.forEach(event => { const ids = event.resourceIds?.length ? event.resourceIds : [event.resourceId].filter(Boolean); ids.forEach(id => { if (!map.has(id)) map.set(id, new Map()); const byDate = map.get(id); const cursor = startOfDay(event.start); const last = event.end ? startOfDay(event.end) : startOfDay(event.start); while (cursor <= last) { const key = formatDateKey(cursor); if (isEventOnDate(event, cursor)) { if (!byDate.has(key)) byDate.set(key, []); byDate.get(key).push(event); } cursor.setDate(cursor.getDate() + 1); } }); }); return map; }
}
