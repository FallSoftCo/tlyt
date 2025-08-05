'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CancelPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000); // Redirect after 3 seconds

    return () => clearTimeout(timer); // Cleanup the timer if the component unmounts
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold">Checkout cancelled!</h1>
      <p>Redirecting you to the homepage...</p>
    </div>
  );
}