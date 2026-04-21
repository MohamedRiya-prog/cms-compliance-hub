'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Sign out after 2 hours of inactivity
const INACTIVITY_MS = 2 * 60 * 60 * 1000

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const

export function InactivityGuard() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function signOut() {
      await supabase.auth.signOut()
      router.replace('/login')
    }

    function reset() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(signOut, INACTIVITY_MS)
    }

    // Start the timer and listen for activity
    reset()
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timer.current) clearTimeout(timer.current)
      EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [router])

  return null
}
