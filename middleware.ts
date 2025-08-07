import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Minimal middleware that doesn't interfere with WorkOS
export function middleware(request: NextRequest) {
  // Just pass through all requests without any processing
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths including API routes
     * Exclude Next.js internal paths
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}