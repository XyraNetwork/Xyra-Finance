import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';

const GovernancePage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
      <h1 className="text-4xl font-bold mb-4">Governance</h1>
      <p className="text-gray-400">Vote on protocol parameters and asset listings.</p>
    </div>
  );
};

GovernancePage.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;
export default GovernancePage;
