// Per-user accessibility preferences.
// These are personal display settings (not company data), so they live in
// localStorage and are applied as data-attributes on <html>, with all visual
// behaviour driven by CSS in globals.css. A no-flash inline script in the root
// layout applies saved prefs before first paint.

export type FontScale = "normal" | "large" | "xl";

export interface A11ySettings {
  fontScale: FontScale;
  highContrast: boolean;
  highlightFocus: boolean;
  underlineLinks: boolean;
  readableFont: boolean;
  reduceMotion: boolean;
}

export const A11Y_STORAGE_KEY = "qg_a11y";

export const DEFAULT_A11Y: A11ySettings = {
  fontScale: "normal",
  highContrast: false,
  highlightFocus: false,
  underlineLinks: false,
  readableFont: false,
  reduceMotion: false,
};

export function loadA11y(): A11ySettings {
  if (typeof window === "undefined") return DEFAULT_A11Y;
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return DEFAULT_A11Y;
    return { ...DEFAULT_A11Y, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11y(settings: A11ySettings) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings stay in-memory for the session */
  }
}

/** Reflect settings onto <html> as data-attributes that CSS keys off. */
export function applyA11y(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute("data-a11y-size", s.fontScale);
  el.toggleAttribute("data-a11y-contrast", s.highContrast);
  el.toggleAttribute("data-a11y-focus", s.highlightFocus);
  el.toggleAttribute("data-a11y-links", s.underlineLinks);
  el.toggleAttribute("data-a11y-font", s.readableFont);
  el.toggleAttribute("data-a11y-motion", s.reduceMotion);
}

/**
 * Self-contained string executed inline in <head> to apply prefs before paint,
 * preventing a flash of unstyled (un-scaled) content.
 */
export const A11Y_NOFLASH_SCRIPT = `
(function(){try{
  var s=JSON.parse(localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)})||"{}");
  var e=document.documentElement;
  e.setAttribute("data-a11y-size", s.fontScale||"normal");
  if(s.highContrast)e.setAttribute("data-a11y-contrast","");
  if(s.highlightFocus)e.setAttribute("data-a11y-focus","");
  if(s.underlineLinks)e.setAttribute("data-a11y-links","");
  if(s.readableFont)e.setAttribute("data-a11y-font","");
  if(s.reduceMotion)e.setAttribute("data-a11y-motion","");
}catch(_){}})();
`;
