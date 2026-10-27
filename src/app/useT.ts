import { useCallback } from 'react'
import { translate, type MessageKey, type Vars } from '../i18n'
import { useAppStore } from './store'

export const useLang = () => useAppStore((s) => s.settings.lang)

/** Translator bound to the current language; components re-render when it changes. */
export function useT() {
  const lang = useLang()
  return useCallback((key: MessageKey, vars?: Vars) => translate(lang, key, vars), [lang])
}
