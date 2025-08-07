import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware();

// Only apply middleware to specific paths that need WorkOS
export const config = {
  matcher: [
    '/api/debug-auth',
    '/((?!_next/static|_next/image|favicon.ico|public|api/webhooks).*)'
  ]
}