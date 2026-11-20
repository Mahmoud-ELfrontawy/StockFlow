// ============================================================
// STOCKFLOW — DASHBOARD PAGE
// Dynamic dashboard using real application data.
// ============================================================

import { useMemo, useState } from 'react';
import {
  Package, Truck, Users, AlertTriangle,
  TrendingUp, ArrowDown, ArrowUp, RotateCcw,
  PackagePlus, ClipboardCheck, Activity
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import useInventoryStore from '../../store/inventoryStore';
import StatCard from '../../components/common/StatCard';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';
import { formatDate, formatQty } from '../../utils/formatters';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import StatusBadge from '../../components/common/StatusBadge';

const FILTER_OPTIONS = [
  { value: 'today', label: 'اليوم' },
  { value: '7d', label: 'آخر 7 أيام' },
  { value: '30d', label: 'هذا الشهر' },
  { value: 'all', label: 'الكل' },
];

const COLORS = ['#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#7C3AED', '#0891B2'];

function getDateFilter(filterValue) {
  const now = new Date();
  switch (filterValue) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    default:
      return new Date('2000-01-01');
  }
}

function getTypeColor(type) {
  const map = {
    [TRANSACTION_TYPES.STOCK_IN]: 'success',
    [TRANSACTION_TYPES.LOADING]: 'info',
    [TRANSACTION_TYPES.RETURN_GOOD]: 'warning',
    [TRANSACTION_TYPES.RETURN_DAMAGED]: 'danger',
    [TRANSACTION_TYPES.DAMAGE]: 'danger',
    [TRANSACTION_TYPES.ADJUSTMENT]: 'muted',
    [TRANSACTION_TYPES.OPENING_BALANCE]: 'muted',
  };
  return map[type] || 'muted';
}

export default function DashboardPage() {
  const [filter, setFilter] = useState('30d');
  const { products, salesmen, stockTransactions, loadingTransactions, returnTransactions, damageRecords } = useInventoryStore();

  const filterDate = getDateFilter(filter);

  // ─── Summary Stats ───────────────────────────────────────────
  const stockSummary = useMemo(
    () => buildWarehouseStockSummary(products, stockTransactions),
    [products, stockTransactions]
  );

  const lowStockProducts = stockSummary.filter((p) => p.isLowStock);
  const activeSalesmen = salesmen.filter((s) => s.status === 'active');

  const filteredLoadings = loadingTransactions.filter(
    (l) => new Date(l.createdAt) >= filterDate
  );
  const filteredStockIn = stockTransactions.filter(
    (tx) => tx.type === TRANSACTION_TYPES.STOCK_IN && new Date(tx.createdAt) >= filterDate
  );
  const totalStockInPieces = filteredStockIn.reduce((s, tx) => s + tx.quantityPieces, 0);

  const pendingReturns = returnTransactions.filter(
    (r) => r.condition === 'pending'
  );
  const pendingDamage = damageRecords.filter((d) => d.reviewStatus === 'pending');

  // ─── Chart Data: last 7 days loading ─────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const count = loadingTransactions.filter((l) => l.date === dateStr).length;
    const totalPieces = loadingTransactions
      .filter((l) => l.date === dateStr)
      .flatMap((l) => l.items)
      .reduce((s, item) => s + item.quantityPieces, 0);
    return {
      name: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }),
      عمليات: count,
      قطع: totalPieces,
    };
  });

  // ─── Chart Data: Stock by category ────────────────────────────
  const categoryData = useMemo(() => {
    const map = {};
    stockSummary.forEach((p) => {
      if (!map[p.category]) map[p.category] = 0;
      map[p.category] += p.currentStock;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [stockSummary]);

  // ─── Recent Activity ──────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const activities = [
      ...stockTransactions
        .filter((tx) => tx.type !== TRANSACTION_TYPES.OPENING_BALANCE)
        .slice(-15)
        .map((tx) => ({
          id: tx.id,
          type: tx.type,
          productId: tx.productId,
          date: tx.createdAt,
          ref: tx.referenceNumber,
          qty: tx.quantityPieces,
          salesmanId: tx.salesmanId,
        })),
    ];
    return activities
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
  }, [stockTransactions]);

  const getProductName = (id) => products.find((p) => p.id === id)?.name || id;
  const getSalesmanName = (id) => salesmen.find((s) => s.id === id)?.name || '';

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">عرض:</span>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
              filter === opt.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Total Shrinks In Warehouse */}
      {(() => {
        const totalWarehouseShrinks = stockSummary.reduce((s, p) => s + (p.currentStockShrinks ?? Math.floor(p.currentStock / (p.piecesPerShrink || 24))), 0);
        const totalStockInShrinks = filteredStockIn.reduce((s, tx) => {
          const prod = products.find(p => p.id === tx.productId);
          return s + Math.floor(tx.quantityPieces / (prod?.piecesPerShrink || 24));
        }, 0);
        const totalLoadedShrinks = filteredLoadings.flatMap((l) => l.items).reduce((s, i) => s + (Number(i.quantityShrinks) || 0), 0);

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="إجمالي رصيد المخزن"
              value={`${totalWarehouseShrinks.toLocaleString('ar-EG')} شرنك`}
              subtitle={`${stockSummary.length} أصناف (${stockSummary.reduce((s, p) => s + p.currentStock, 0).toLocaleString('ar-EG')} قطعة)`}
              icon={Package}
              iconColor="bg-blue-100 text-blue-700 dark:bg-sky-950/60 dark:text-sky-400"
            />
            <StatCard
              title="الوارد المستلم"
              value={`${totalStockInShrinks.toLocaleString('ar-EG')} شرنك`}
              subtitle={`${filteredStockIn.length} إذن استلام (${totalStockInPieces.toLocaleString('ar-EG')} ق)`}
              icon={PackagePlus}
              iconColor="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
            />
            <StatCard
              title="المنصرف والمحمّل"
              value={`${totalLoadedShrinks.toLocaleString('ar-EG')} شرنك`}
              subtitle={`${filteredLoadings.length} عملية تحميل`}
              icon={Truck}
              iconColor="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400"
            />
            <StatCard
              title="المندوبون النشطون"
              value={activeSalesmen.length}
              subtitle={`من إجمالي ${salesmen.length} مندوب`}
              icon={Users}
              iconColor="bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400"
            />
          </div>
        );
      })()}

      {/* Alert Row */}
      {(lowStockProducts.length > 0 || pendingReturns.length > 0 || pendingDamage.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {lowStockProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{lowStockProducts.length} منتج على وشك النفاد</p>
                <p className="text-amber-600 text-xs mt-1">{lowStockProducts.map((p) => p.name).slice(0, 3).join('، ')}</p>
              </div>
            </div>
          )}
          {pendingReturns.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <RotateCcw size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">{pendingReturns.length} مرتجع قيد الفحص</p>
                <p className="text-blue-600 text-xs mt-1">تحتاج مراجعة وتأكيد الحالة</p>
              </div>
            </div>
          )}
          {pendingDamage.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{pendingDamage.length} بضاعة تالفة قيد المراجعة</p>
                <p className="text-red-600 text-xs mt-1">تحتاج اعتماد قبل شطب الكمية</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Loading activity */}
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-blue-600" />
            نشاط التحميل (آخر 7 أيام)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7Days} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Cairo' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'Cairo' }} />
              <Tooltip contentStyle={{ fontFamily: 'Cairo', fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Bar dataKey="عمليات" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock by category */}
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={16} className="text-purple-600" />
            توزيع المخزون بالفئات
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontFamily: 'Cairo', fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Low stock + Recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Low stock products */}
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            منتجات تحتاج تجديد
          </h3>
          {lowStockProducts.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">جميع المنتجات في مستويات مقبولة ✓</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.slice(0, 5).map((p) => {
                const currentShrinks = p.currentStockShrinks ?? Math.floor(p.currentStock / (p.piecesPerShrink || 24));
                const minShrinks = p.minimumStock || 0;
                const ratio = minShrinks > 0 ? (currentShrinks / minShrinks) * 100 : 0;
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 max-w-32">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, ratio)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          {currentShrinks.toLocaleString('ar-EG')} / {minShrinks.toLocaleString('ar-EG')} شرنك
                        </span>
                      </div>
                    </div>
                    <StatusBadge variant="warning">منخفض</StatusBadge>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-green-600" />
            آخر الحركات
          </h3>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">لا توجد حركات مسجلة</p>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <StatusBadge variant={getTypeColor(act.type)}>
                    {TRANSACTION_TYPE_LABELS[act.type] || act.type}
                  </StatusBadge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {getProductName(act.productId)}
                      {act.salesmanId && ` — ${getSalesmanName(act.salesmanId)}`}
                    </p>
                    {(() => {
                      const prod = products.find(p => p.id === act.productId);
                      const pShrink = prod?.piecesPerShrink || 24;
                      const actShrinks = Math.floor(act.qty / pShrink);
                      return (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <strong className="text-gray-900 dark:text-slate-100 font-bold">{actShrinks > 0 ? `${actShrinks.toLocaleString('ar-EG')} شرنك` : ''}</strong>
                          {' '}<span className="text-gray-400">({act.qty.toLocaleString('ar-EG')} ق)</span> · {formatDate(act.date)}
                        </p>
                      );
                    })()}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{act.ref}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
