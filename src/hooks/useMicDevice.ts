'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'anamnezal:mic-device'

/**
 * Selected microphone deviceId, persisted in localStorage so the doctor's
 * external/lavalier mic choice survives page reloads. '' means "browser default".
 * The stored id is read after mount (SSR-safe): initial render always sees ''.
 */
export function useMicDevice(): [string, (deviceId: string) => void] {
  const [deviceId, setDeviceIdState] = useState('')

  useEffect(() => {
    try {
      setDeviceIdState(window.localStorage.getItem(STORAGE_KEY) ?? '')
    } catch {
      // Private mode / storage blocked — keep in-memory default.
    }
  }, [])

  const setDeviceId = useCallback((id: string) => {
    setDeviceIdState(id)
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Storage blocked — selection still works for this session.
    }
  }, [])

  return [deviceId, setDeviceId]
}
