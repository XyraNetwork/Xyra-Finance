/**
 * Flash loan UI lives on the dashboard (`view=flash`).
 * Redirect /flash → /dashboard?view=flash for short links and bookmarks.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FlashRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    void router.replace('/dashboard?view=flash');
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 text-base-content/70">
      Opening Flash Loan...
    </div>
  );
}
