// Customized templates a user has saved for reuse. Stored locally for now
// (per-browser, zero storage cost). Can be promoted to an org-wide DB table later.

export interface SavedTemplate {
  id: string;
  name: string;
  baseId: string; // the DOC_TEMPLATES id it was built from
  html: string; // the customized document body HTML
  savedAt: number;
}

const KEY = "qg_saved_templates";

export function listSavedTemplates(): SavedTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as SavedTemplate[];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(t: Omit<SavedTemplate, "id" | "savedAt">): SavedTemplate {
  const all = listSavedTemplates();
  const item: SavedTemplate = { ...t, id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, savedAt: Date.now() };
  all.unshift(item);
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50))); } catch { /* ignore */ }
  return item;
}

export function getSavedTemplate(id: string): SavedTemplate | null {
  return listSavedTemplates().find((t) => t.id === id) ?? null;
}

export function deleteSavedTemplate(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(listSavedTemplates().filter((t) => t.id !== id))); } catch { /* ignore */ }
}
