import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './locales/en';

/**
 * Translations use the English text as the key: `t('Add product')`.
 * Each locale file maps that English text to its translation. Anything missing falls back to English,
 * so a new language can be added one string at a time. `{name}` placeholders are filled from `vars`;
 * a translation can instead be an object of plural forms, picked by `vars.count`.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Dict = Record<string, string | PluralForms>;

// To add a language: create locales/<code>.ts (copy es.ts and translate the values), then add a row here.
export const LANGUAGES = [
  { code: 'en', name: 'English', english: 'English', locale: 'en-US', dir: 'ltr', load: async () => en },
  { code: 'es', name: 'Español', english: 'Spanish', locale: 'es-419', dir: 'ltr', load: () => import('./locales/es').then((m) => m.es) },
  { code: 'pt', name: 'Português', english: 'Portuguese', locale: 'pt-BR', dir: 'ltr', load: () => import('./locales/pt').then((m) => m.pt) },
  { code: 'fr', name: 'Français', english: 'French', locale: 'fr-FR', dir: 'ltr', load: () => import('./locales/fr').then((m) => m.fr) },
  { code: 'ar', name: 'العربية', english: 'Arabic', locale: 'ar-u-nu-latn', dir: 'rtl', load: () => import('./locales/ar').then((m) => m.ar) },
  { code: 'nl', name: 'Nederlands', english: 'Dutch', locale: 'nl-NL', dir: 'ltr', load: () => import('./locales/nl').then((m) => m.nl) },
] as const satisfies readonly { code: string; name: string; english: string; locale: string; dir: 'ltr' | 'rtl'; load: () => Promise<Dict> }[];

export type Lang = (typeof LANGUAGES)[number]['code'];

// Each language's strings are a separate file, fetched when that language is first used.
const dicts: Partial<Record<Lang, Dict>> = { en };
/** Fetches a language's strings. Call before switching to it (main.tsx does this for the starting language). */
export async function loadLang(lang: Lang) {
  if (!dicts[lang]) dicts[lang] = await byCode(lang)!.load();
}
const STORAGE_KEY = 'tokuma-lang';

const byCode = (code: string) => LANGUAGES.find((l) => l.code === code);

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && byCode(saved)) return saved as Lang;
  } catch {
    /* ignore */
  }
  const prefs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const p of prefs) {
    const hit = byCode(p.toLowerCase().split('-')[0]!);
    if (hit) return hit.code;
  }
  return 'en';
}

let current: Lang = detect();
/** The starting language (detected or saved); load it with `loadLang` before the first render. */
export const initialLang = current;
let plural = new Intl.PluralRules(byCode(current)!.locale);

/** The active language (for code outside React, such as formatters). */
export const getLang = () => current;
/** BCP 47 locale for Intl formatters. */
export const getLocale = () => byCode(current)!.locale;

function fill(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Translate. Usable anywhere; inside components prefer `useT()` so text updates when the language changes. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = dicts[current]?.[key] ?? en[key] ?? key;
  if (typeof entry === 'string') return fill(entry, vars);
  const n = typeof vars?.count === 'number' ? vars.count : 0;
  return fill(entry[plural.select(n)] ?? entry.other, vars);
}

type Ctx = { lang: Lang; setLang: (l: Lang) => Promise<void>; dir: 'ltr' | 'rtl' };
const I18nCtx = createContext<Ctx>({ lang: 'en', setLang: async () => {}, dir: 'ltr' });

function apply(lang: Lang) {
  // Strings not fetched (e.g. offline) → stay readable in English.
  if (!dicts[lang]) lang = 'en';
  const l = byCode(lang)!;
  current = lang;
  plural = new Intl.PluralRules(l.locale);
  document.documentElement.lang = lang;
  document.documentElement.dir = l.dir;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(dicts[current] ? current : 'en');
  // Applied during render too, so children rendered in this pass already use the new language.
  if (current !== lang) apply(lang);
  useEffect(() => apply(lang), [lang]);
  const setLang = useCallback(async (l: Lang) => {
    try {
      await loadLang(l);
    } catch {
      return; // couldn't fetch the strings; keep the current language
    }
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    apply(l);
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang, dir: byCode(lang)!.dir }), [lang, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useLang = () => useContext(I18nCtx);

/** Returns `t`, re-rendering the component when the language changes. */
export function useT() {
  useContext(I18nCtx);
  return t;
}

/** Marks text in static data (nav labels, option lists) for translation; translate it with `t()` where it's shown. */
export const tk = (s: string) => s;

/** Like `t`, but placeholders can be React elements: `tNode('Sent to {email}.', { email: <b>{email}</b> })`. */
export function tNode(key: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = t(key).split(/\{(\w+)\}/);
  return parts.map((p, i) => <Fragment key={i}>{i % 2 ? (p in nodes ? nodes[p] : `{${p}}`) : p}</Fragment>);
}
