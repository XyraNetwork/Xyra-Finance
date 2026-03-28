import type { NextPageWithLayout } from '@/types';
import Layout from '@/layouts/_layout';
import { MarketsView } from '@/components/MarketsView';

const MarketsPage: NextPageWithLayout = () => {
  return <MarketsView />;
};

MarketsPage.getLayout = (page: React.ReactElement) => <Layout>{page}</Layout>;
export default MarketsPage;
