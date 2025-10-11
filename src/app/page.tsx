'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Generate random slug (7 characters: lowercase + digits)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const slug = Array.from({ length: 7 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    router.push(`/${slug}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
