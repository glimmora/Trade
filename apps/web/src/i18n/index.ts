import { en } from './en';
import type { Dict } from './en';
import { id } from './id';

export type Language = 'en' | 'id';

export const DICTS: Record<Language, Dict> = { en, id };

export type DictKey = keyof Dict;

/** Translate a key in the given language. English is the fallback source of truth. */
export function t(lang: Language, key: DictKey): string {
  return DICTS[lang][key];
}

export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'id', label: 'Bahasa Indonesia' },
] as const;
