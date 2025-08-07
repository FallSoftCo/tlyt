import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function GET() {
  try {
    const { user } = await withAuth();
    
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: 'No user found'
      });
    }
    
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}