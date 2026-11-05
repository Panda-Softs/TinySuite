function normalizeResource(rawResource) {
  if (!rawResource || isNil(rawResource.id)) return null;
  return {
    id: String(rawResource.id), title: rawResource.title || String(rawResource.id), group: rawResource.group || null,
    parentId: rawResource.parentId || null, order: Number(rawResource.order || 0), color: rawResource.color || null, meta: rawResource.meta || {}
  };
}


class ResourceStore extends MicroEvent {
  constructor() { super(); this.resources = []; this.resourcesById = new Map(); }
  setResources(resources) { this.resources = []; this.resourcesById.clear(); resources.forEach(resource => this.addResource(resource, false)); this._emit('changed', this.resources); return this; }
  addResource(resource, emit = true) { const normalized = normalizeResource(resource); if (!normalized) return null; this.resourcesById.set(normalized.id, normalized); this.resources = Array.from(this.resourcesById.values()).sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title)); if (emit) this._emit('changed', this.resources); return normalized; }
  updateResource(resourceId, updates) { const oldResource = this.resourcesById.get(String(resourceId)); if (!oldResource) return null; const resource = normalizeResource({ ...oldResource, ...updates, id: oldResource.id }); this.resourcesById.set(resource.id, resource); this.resources = Array.from(this.resourcesById.values()).sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title)); this._emit('changed', this.resources); return resource; }
  deleteResource(resourceId) { const removed = this.resourcesById.get(String(resourceId)); if (!removed) return null; this.resourcesById.delete(String(resourceId)); this.resources = Array.from(this.resourcesById.values()); this._emit('changed', this.resources); return removed; }
  getResources() { return this.resources.slice(); }
  getResourceById(resourceId) { return this.resourcesById.get(String(resourceId)) || null; }
}
