// STOCKFLOW — STOCK LEDGER PAGE
import { useState, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import { calculateStockAtDate } from '../../utils/stockCalculations';

const TYPE_VARIANT = {
  [TRANSACTION_TYPES.OPENING_BALANCE]: 'muted',
  [TRANSACTION_TYPES.STOCK_IN]: 'success',
  [TRANSACTION_TYPES.LOADING]: 'info',
  [TRANSACTION_TYPES.RETURN_GOOD]: 'warning',
  [TRANSACTION_TYPES.RETURN_DAMAGED]: 'danger',
  [TRANSACTION_TYPES.DAMAGE]: 'danger',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'muted',
  [TRANSACTION_TYPES.REVERSAL]: 'muted',
};

export default function StockLedgerPage() {
  const { products, salesmen, stockTransactions } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const enrichedTransactions = useMemo(() => {
    return stockTransactions
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((tx) => {
        const before = calculateStockAtDate(tx.productId, stockTransactions, tx.createdAt);
        const isAddition = [
          TRANSACTION_TYPES.STOCK_IN,
          TRANSACTION_TYPES.OPENING_BALANCE,
          TRANSACTION_TYPES.RETURN_GOOD,
        ].includes(tx.type);

        const isDeduction = [
          TRANSACTION_TYPES.LOADING,
          TRANSACTION_TYPES.DAMAGE,
          TRANSACTION_TYPES.RETURN_DAMAGED,
        ].includes(tx.type);

        const delta = isAddition ? tx.quantityPieces : isDeduction ? -tx.quantityPieces : tx.quantityPieces;
        return {
          ...tx,
          balanceBefore: before,
          balanceAfter: before + delta,
        };
      })
      .reverse();
  }, [stockTransactions]);

  const filtered = useMemo(() => {
    return enrichedTransactions.filter((tx) => {
      const matchSearch = !search || tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) || tx.notes?.toLowerCase().includes(search.toLowerCase());
      const matchProduct = !filterProduct || tx.productId === filterProduct;
      const matchSalesman = !filterSalesman || tx.salesmanId === filterSalesman;
      const matchType = !filterType || tx.type === filterType;
      const txDate = tx.date || tx.createdAt?.split('T')[0];
      const matchFrom = !dateFrom || txDate >= dateFrom;
      const matchTo = !dateTo || txDate <= dateTo;
      return matchSearch && matchProduct && matchSalesman && matchType && matchFrom && matchTo;
    });
  }, [enrichedTransactions, search, filterProduct, filterSalesman, filterType, dateFrom, dateTo]);

  const getProductName = (id) => products.find((p) => p.id === id)?.name || id;
  const getProduct = (id) => products.find((p) => p.id === id);
  const getSalesmanName = (id) => id ? (salesmen.find((s) => s.id === id)?.name || '—') : '—';

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="دفتر حركة المخزن"
        subtitle={`سجل تدقيق كامل لكافة العمليات بالشرنك والقطع (${stockTransactions.length} حركة)`}
      />

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث برقم المرجع أو الملاحظات..." />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="form-input">
            <option value="">كل المنتجات</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterSalesman} onChange={(e) => setFilterSalesman(e.target.value)} className="form-input">
            <option value="">كل المندوبين</option>
            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="form-input">
            <option value="">كل أنواع الحركات</option>
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input text-xs" title="من تاريخ" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input text-xs" title="إلى تاريخ" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="لا توجد حركات مطابقة" icon={BookOpen} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم المرجع</th>
                  <th>التاريخ والتوقيت</th>
                  <th>نوع الحركة</th>
                  <th>المنتج</th>
                  <th className="text-center">الكمية (شرنك)</th>
                  <th className="text-center">الرصيد قبل</th>
                  <th className="text-center font-bold">الرصيد بعد</th>
                  <th>المندوب</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const prod = getProduct(tx.productId);
                  const pShrink = prod?.piecesPerShrink || 24;
                  const isAddition = [TRANSACTION_TYPES.STOCK_IN, TRANSACTION_TYPES.OPENING_BALANCE, TRANSACTION_TYPES.RETURN_GOOD].includes(tx.type);
                  const sign = isAddition ? '+' : '-';

                  const deltaShrinks = Math.floor(Math.abs(tx.quantityPieces) / pShrink);
                  const beforeShrinks = tx.balanceBefore !== undefined ? Math.floor(tx.balanceBefore / pShrink) : null;
                  const afterShrinks = tx.balanceAfter !== undefined ? Math.floor(tx.balanceAfter / pShrink) : null;

                  return (
                    <tr key={tx.id}>
                      <td><span className="font-mono text-xs text-blue-600 dark:text-sky-400 font-semibold">#{tx.referenceNumber}</span></td>
                      <td className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</td>
                      <td><StatusBadge variant={TYPE_VARIANT[tx.type]}>{TRANSACTION_TYPE_LABELS[tx.type]}</StatusBadge></td>
                      <td className="font-medium text-sm">{getProductName(tx.productId)}</td>
                      <td className="text-center">
                        <span className={`font-bold text-sm ${isAddition ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {sign}{deltaShrinks.toLocaleString('ar-EG')} شرنك
                        </span>
                        <span className="block text-[11px] text-gray-400">({tx.quantityPieces.toLocaleString('ar-EG')} ق)</span>
                      </td>
                      <td className="text-center text-gray-600 dark:text-gray-400">
                        {beforeShrinks !== null ? (
                          <div>
                            <span className="font-semibold text-xs">{beforeShrinks.toLocaleString('ar-EG')} ش</span>
                            <span className="block text-[10px] text-gray-400">({tx.balanceBefore.toLocaleString('ar-EG')} ق)</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="text-center font-bold text-gray-900 dark:text-slate-100">
                        {afterShrinks !== null ? (
                          <div>
                            <span className="font-bold text-sm text-blue-700 dark:text-sky-300">{afterShrinks.toLocaleString('ar-EG')} شرنك</span>
                            <span className="block text-[10px] text-gray-400 font-normal">({tx.balanceAfter.toLocaleString('ar-EG')} ق)</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="text-xs text-gray-500">{getSalesmanName(tx.salesmanId)}</td>
                      <td className="text-xs text-gray-500 max-w-xs truncate">{tx.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}