"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  A11ySettings,
  DEFAULT_A11Y,
  applyA11y,
  loadA11y,
  saveA11y,
} from "@/lib/accessibility";

interface A11yContextValue {
  settings: A11ySettings;
  set: <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => void;
  reset: () => void;
}

const A11yContext = createContext<A11yContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_A11Y);

  // Hydrate from localStorage on mount (the inline no-flash script already
  // applied the attributes; this syncs React state to match).
  useEffect(() => {
    setSettings(loadA11y());
  }, []);

  const set = useCallback<A11yContextValue["set"]>((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveA11y(next);
      applyA11y(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveA11y(DEFAULT_A11Y);
    applyA11y(DEFAULT_A11Y);
    setSettings(DEFAULT_A11Y);
  }, []);

  return (
    <A11yContext.Provider value={{ settings, set, reset }}>{children}</A11yContext.Provider>
  );
}

export function useAccessibility(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
