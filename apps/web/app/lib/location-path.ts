export interface PlaceNode {
  id: string;
  name: string;
  parentId: string | null;
}

/** Full path, including a safe stop for legacy cycles or invisible ancestors. */
export function locationPath(id: string, places: PlaceNode[]): string {
  const index = new Map(places.map((p) => [p.id, p]));
  const names: string[] = [];
  const seen = new Set<string>();
  let node = index.get(id);
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    names.unshift(node.name);
    node = node.parentId ? index.get(node.parentId) : undefined;
  }
  return names.join(' → ');
}

export function locationDescendants(id: string, places: PlaceNode[]): Set<string> {
  const ids = new Set([id]);
  const pending = [id];
  while (pending.length) {
    const parent = pending.pop();
    for (const place of places) {
      if (place.parentId === parent && !ids.has(place.id)) {
        ids.add(place.id);
        pending.push(place.id);
      }
    }
  }
  return ids;
}
