// app/success/page.tsx
"use client";

import { useRouter } from "next/navigation";

export default function SuccessPage() {
  const router = useRouter();

  return (
    <div className="container max-w-md mx-auto py-12 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-green-600">Payment Successful!</h1>
        <p>Thank you for your purchase! Your account will be credited shortly.</p>
        <button 
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}