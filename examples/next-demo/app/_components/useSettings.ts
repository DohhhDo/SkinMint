"use client";

import { useCallback, useEffect, useState } from "react";

export interface Settings {
  apiKey: string;
  refine: boolean;
  lowpoly: boolean;
  background: string; // "" = transparent
}

const DEFAULTS: Settings = {
  apiKey: "",
  refine: true,
  lowpoly: false,
  background: "",
};

const KEY = "skinmint.settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { settings, update, loaded };
}
