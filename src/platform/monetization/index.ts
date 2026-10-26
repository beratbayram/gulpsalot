import { createMockProvider } from './mock'
import { noneProvider } from './none'
import type { Monetization } from './types'

export type { Monetization } from './types'
export { setMockAdPresenter, type MockAdKind } from './mock'

/** `?ads=mock` or `?ads=none` overrides; dev builds default to the mock. */
function pickProvider(): Monetization {
  const param = new URLSearchParams(window.location.search).get('ads')
  if (param === 'mock') return createMockProvider()
  if (param === 'none') return noneProvider
  return import.meta.env.DEV ? createMockProvider() : noneProvider
}

export const monetization = pickProvider()
