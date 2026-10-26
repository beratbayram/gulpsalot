import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppStore } from './store'

/** Registers the service worker and exposes "update ready" to the title screen. */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  useEffect(() => {
    useAppStore.getState().setUpdate(needRefresh, () => void updateServiceWorker(true))
  }, [needRefresh, updateServiceWorker])
}
