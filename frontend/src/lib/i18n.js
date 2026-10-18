import { writable, derived } from 'svelte/store';
import en from '../locales/en.json';
import de from '../locales/de.json';

const LOCALES = { en, de };

// detect browser language (2-letter) and fall back to English
let initial = 'en';
if (typeof navigator !== 'undefined' && navigator.language) {
  const lang = navigator.language.slice(0, 2).toLowerCase();
  initial = LOCALES[lang] ? lang : 'en';
}

export const locale = writable(initial);

// derived translator function: $t('key') -> string
export const t = derived(locale, ($locale) => (key) => {
  return LOCALES[$locale] && LOCALES[$locale][key] ? LOCALES[$locale][key] : key;
});

export function setLocale(l) {
  if (LOCALES[l]) locale.set(l);
}

// Keep document.lang in sync when running in browser
if (typeof document !== 'undefined') {
  locale.subscribe((l) => {
    try {
      document.documentElement.lang = l;
    } catch (e) {}
  });
}
