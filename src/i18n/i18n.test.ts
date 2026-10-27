import { describe, expect, it } from 'vitest'
import { en } from './en'
import { detectLang, nextLang, translate } from './index'
import { tr } from './tr'

describe('i18n', () => {
  it('Turkish covers every English key with a non-empty string', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(tr[key], key).toBeTruthy()
    }
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort())
  })

  it('keeps the same placeholders in both languages', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(vars(tr[key]), key).toEqual(vars(en[key]))
    }
  })

  it('fills placeholders and leaves unknown ones alone', () => {
    expect(translate('en', 'over.best', { n: 12 })).toBe('Best 12')
    expect(translate('tr', 'over.best', { n: 12 })).toBe('En iyi 12')
    expect(translate('en', 'over.best')).toBe('Best {n}')
  })

  it('picks the first supported device language', () => {
    expect(detectLang(['tr-TR', 'en-US'])).toBe('tr')
    expect(detectLang(['de-DE', 'tr'])).toBe('tr')
    expect(detectLang(['en-GB'])).toBe('en')
    expect(detectLang(['fr-FR'])).toBe('en')
    expect(detectLang([])).toBe('en')
  })

  it('cycles languages', () => {
    expect(nextLang('en')).toBe('tr')
    expect(nextLang('tr')).toBe('en')
  })
})
