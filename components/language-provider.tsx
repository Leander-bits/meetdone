"use client";
import { useEffect, useSyncExternalStore } from "react";
import { LANGUAGE_KEY, Locale, translate } from "@/lib/i18n";
import { Meeting, Requirement } from "@/lib/models";
import { getTemplate } from "@/lib/templates";
let language: Locale = "zh";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function publish(locale: Locale) {
  language = locale;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = `MeetDone · ${translate(locale, "Know if your meeting is actually done.")}`;
  listeners.forEach((l) => l());
}
function readLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    publish(readLanguage());
    const sync = (e: StorageEvent) => {
      if (e.key === LANGUAGE_KEY) publish(readLanguage());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return children;
}
export function useI18n() {
  const locale = useSyncExternalStore(
    subscribe,
    () => language,
    () => "zh" as Locale,
  );
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    label: (r: Requirement) =>
      r.builtinKey === r.label ? translate(locale, r.builtinKey) : r.label,
    title: (m: Meeting) =>
      m.builtinTitle && m.title === getTemplate(m.templateId).defaultTitle
        ? translate(locale, m.title)
        : m.title,
    setLocale: (next: Locale) => {
      try {
        localStorage.setItem(LANGUAGE_KEY, next);
      } catch {
        /* The UI still switches when storage is disabled. */
      }
      publish(next);
    },
  };
}
