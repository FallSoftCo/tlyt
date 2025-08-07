import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware({
  redirectUri: 'https://tlyt-fallsoftco.vercel.app/callback'
});

export const config = {
  matcher: ['/']
}