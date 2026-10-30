import { useSyncExternalStore } from 'react';
import { sw } from './sw';

export type Language = 'en' | 'sw';
export const LANGUAGE_STORAGE_KEY = 'fraud-detect.language';
const listeners = new Set<() => void>();
function storedLanguage(): Language {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'sw' ? 'sw' : 'en';
  } catch {
    return 'en';
  }
}
let language: Language = storedLanguage();

function updateDocument() {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.title = language === 'sw' ? 'FraudDetect — Ugunduzi wa Udanganyifu' : 'FraudDetect';
  }
}
updateDocument();

export function getLanguage(): Language {
  return language;
}
export function getLocale(): string {
  return language === 'sw' ? 'sw-TZ' : 'en-US';
}
export function setLanguage(next: Language) {
  if (next !== 'en' && next !== 'sw') return;
  language = next;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    /* Preference still works in this tab. */
  }
  updateDocument();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
    language = storedLanguage();
    updateDocument();
    listeners.forEach((listener) => listener());
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const patterns = Object.entries(sw)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, value]) => {
    const slots: string[] = [];
    const parts = key.split(/(\{\d+\})/g).map((part) => {
      if (/^\{\d+\}$/.test(part)) {
        slots.push(part);
        return '(.+?)';
      }
      return escapeRegex(part);
    });
    return { regex: new RegExp(`^${parts.join('')}$`, 's'), value, slots };
  });

function translateString(message: string): string {
  if (Object.hasOwn(sw, message)) return sw[message]!;
  for (const { regex, value, slots } of patterns) {
    const match = regex.exec(message);
    if (match) return value.replace(/\{\d+\}/g, (slot) => match[slots.indexOf(slot) + 1] ?? slot);
  }
  const trimmed = message.trim();
  if (trimmed !== message && trimmed)
    return message.replace(trimmed, () => translateString(trimmed));
  // Preserve decorative icons and required-field markers independently of the message.
  const decorated = /^([^\p{L}\p{N}]+)([\p{L}].*)$/su.exec(message);
  if (decorated) return decorated[1] + translateString(decorated[2]!);
  if (message.endsWith(' *')) return translateString(message.slice(0, -2)) + ' *';
  if (message.endsWith(' (Optional)'))
    return translateString(message.slice(0, -11)) + ' (si lazima)';
  if (message.includes('\n')) return message.split('\n').map(translateString).join('\n');
  return message;
}

/** Only translates an explicitly supplied display value; never changes stored/API values. */
export function translate<T>(value: T): T {
  return (language === 'sw' && typeof value === 'string' ? translateString(value) : value) as T;
}

export function useLanguage() {
  const current = useSyncExternalStore(subscribe, getLanguage, () => 'en' as const);
  return {
    language: current,
    locale: current === 'sw' ? 'sw-TZ' : 'en-US',
    setLanguage,
    tr: translate,
  };
}
