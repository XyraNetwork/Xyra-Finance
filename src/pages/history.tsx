import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';

const HistoryPage: NextPageWithLayout = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
      <h1 className="text-4xl font-bold mb-4">Transaction History</h1>
      <p className="text-gray-400">Coming soon to the Aleo Testnet.</p>
    </div>
  );
};

HistoryPage.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;
export default HistoryPage;
