import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware();

export const config = {
  matcher: [
    /*
     * Match all request paths including API routes
     * Exclude Next.js internal paths
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};