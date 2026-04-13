'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRandomNoteSlug } from '@/lib/note-slug';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push(`/${generateRandomNoteSlug()}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
