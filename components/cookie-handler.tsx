'use client'

import { useEffect } from 'react'

interface CookieHandlerProps {
  userId: string
}

export function CookieHandler({ userId }: CookieHandlerProps) {
  useEffect(() => {
    // Set userId cookie if not already set
    if (userId && !document.cookie.includes(`userId=${userId}`)) {
      // Set cookie for 1 year
      const expireDate = new Date()
      expireDate.setFullYear(expireDate.getFullYear() + 1)
      document.cookie = `userId=${userId}; expires=${expireDate.toUTCString()}; path=/; SameSite=Lax`
    }
  }, [userId])

  return null
}