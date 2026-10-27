import { en, type MessageKey } from './en'
import { tr } from './tr'

export type Lang = 'en' | 'tr'
export type { MessageKey }
export type Vars = Record<string, string | number>

export const LANGS: readonly Lang[] = ['en', 'tr']

const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, tr }

/** Looks up a message and fills `{name}` placeholders from `vars`. */
export function translate(lang: Lang, key: MessageKey, vars?: Vars) {
  const text = MESSAGES[lang][key] ?? en[key]
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/** First supported language in the device's preference list, English otherwise. */
export function detectLang(preferred: readonly string[] = deviceLanguages()): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if ((LANGS as readonly string[]).includes(base)) return base as Lang
  }
  return 'en'
}

function deviceLanguages() {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

export const nextLang = (lang: Lang) => LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]

/** Locale for Intl formatting. */
export const locale = (lang: Lang) => (lang === 'tr' ? 'tr-TR' : 'en-US')

// The game reads text outside React, so the current language also lives here.
let current: Lang = 'en'

export const getLang = () => current

export function setLang(lang: Lang) {
  current = lang
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

export const t = (key: MessageKey, vars?: Vars) => translate(current, key, vars)
