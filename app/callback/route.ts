import { handleAuth } from '@workos-inc/authkit-nextjs';

// Get the base URL for the application
const getBaseUrl = () => {
  // Use NEXT_PUBLIC_BASE_URL if available, otherwise construct from protocol and VERCEL_URL
  return process.env.NEXT_PUBLIC_BASE_URL || 
    `${process.env.VERCEL_ENV === "development" ? "http://" : "https://"}${process.env.VERCEL_URL || "localhost:3256"}`;
};

// Redirect the user to the root path after successful sign in
export const GET = handleAuth({
  // Default options for WorkOS AuthKit handleAuth function
  returnPathname: '/', // Redirect to root path after sign-in
  baseURL: getBaseUrl() // Set the base URL for redirects
});