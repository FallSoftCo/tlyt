import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get the session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('wos-session');
    
    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        error: 'No session cookie found'
      });
    }

    // Try to get user from session - this is a basic approach
    // Note: This is a simplified version, actual session validation would be more complex
    return NextResponse.json({
      authenticated: true,
      sessionCookie: sessionCookie.value ? 'present' : 'missing',
      cookieName: sessionCookie.name
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}