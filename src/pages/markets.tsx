import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';

/**
 * Markets is now a view on the dashboard. Redirect /markets to /dashboard?view=markets.
 */
const MarketsRedirectPage: NextPageWithLayout = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard?view=markets');
  }, [router]);

  return (
    <div className="flex justify-center items-center pt-32">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
};

MarketsRedirectPage.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;
export default MarketsRedirectPage;
