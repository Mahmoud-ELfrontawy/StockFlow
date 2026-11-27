// ============================================================
// STOCKFLOW — ROUTER
// All application routes defined here.
// ============================================================

import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';

// Lazy imports for code splitting
import { lazy, Suspense } from 'react';
import LoadingState from '../components/common/LoadingState';

const Dashboard     = lazy(() => import('../features/dashboard/DashboardPage'));
const Products      = lazy(() => import('../features/products/ProductsPage'));
const Warehouse     = lazy(() => import('../features/warehouse/WarehousePage'));
const OldStock      = lazy(() => import('../features/old-stock/OldStockPage'));
const StockIn       = lazy(() => import('../features/stock-in/StockInPage'));
const Loading       = lazy(() => import('../features/loading/LoadingPage'));
const Salesmen      = lazy(() => import('../features/salesmen/SalesmenPage'));
const Balances      = lazy(() => import('../features/salesman-balances/SalesmanBalancesPage'));
const Returns       = lazy(() => import('../features/returns/ReturnsPage'));
const DamagedGoods  = lazy(() => import('../features/damaged-goods/DamagedGoodsPage'));
const StockLedger   = lazy(() => import('../features/stock-ledger/StockLedgerPage'));
const Stocktaking   = lazy(() => import('../features/stocktaking/StocktakingPage'));
const Reports       = lazy(() => import('../features/reports/ReportsPage'));
const Settings      = lazy(() => import('../features/settings/SettingsPage'));

function Wrap({ children }) {
  return (
    <Suspense fallback={<LoadingState message="جاري التحميل..." />}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true,                   element: <Wrap><Dashboard /></Wrap> },
      { path: 'products',              element: <Wrap><Products /></Wrap> },
      { path: 'warehouse',             element: <Wrap><Warehouse /></Wrap> },
      { path: 'old-stock',             element: <Wrap><OldStock /></Wrap> },
      { path: 'stock-in',              element: <Wrap><StockIn /></Wrap> },
      { path: 'loading',               element: <Wrap><Loading /></Wrap> },
      { path: 'salesmen',              element: <Wrap><Salesmen /></Wrap> },
      { path: 'salesman-balances',     element: <Wrap><Balances /></Wrap> },
      { path: 'returns',               element: <Wrap><Returns /></Wrap> },
      { path: 'damaged-goods',         element: <Wrap><DamagedGoods /></Wrap> },
      { path: 'stock-ledger',          element: <Wrap><StockLedger /></Wrap> },
      { path: 'stocktaking',           element: <Wrap><Stocktaking /></Wrap> },
      { path: 'reports',               element: <Wrap><Reports /></Wrap> },
      { path: 'settings',              element: <Wrap><Settings /></Wrap> },
    ],
  },
]);
