// STOCKFLOW — WAREHOUSE PAGE
// Clear inventory view with integer Pallets, Shrinks, and Pieces breakdown.
import { useMemo, useState } from 'react';
import { Warehouse, AlertTriangle, Layers, Package } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';

export default function WarehousePage() {
  const { products, stockTransactions } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const summary = useMemo(
    () => buildWarehouseStockSummary(products, stockTransactions),
    [products, stockTransactions]
  );

  const filtered = useMemo(() => {
    return summary.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'low' && p.isLowStock) ||
        (filter === 'ok' && !p.isLowStock);
      return matchSearch && matchFilter;
    });
  }, [summary, search, filter]);

  // Total complete pallets (integer only)
  const totalCompletePallets = summary.reduce((s, p) => {
    const pPerShrink = p.piecesPerShrink || 24;
    const sPerPallet = p.shrinksPerPallet || 169;
    const currentShrinks = Math.floor(p.currentStock / pPerShrink);
    return s + Math.floor(currentShrinks / sPerPallet);
  }, 0);

  // Total individual shrinks
  const totalShrinks = summary.reduce((s, p) => {
    const pPerShrink = p.piecesPerShrink || 24;
    return s + Math.floor(p.currentStock / pPerShrink);
  }, 0);

  // Total pieces
  const totalPieces = summary.reduce((s, p) => s + p.currentStock, 0);

  const lowCount = summary.filter((p) => p.isLowStock).length;

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="حالة ورصيد المخزن"
        subtitle={`إجمالي المخزن الفعلي: ${totalShrinks.toLocaleString('ar-EG')} شرنك (${totalCompletePallets.toLocaleString('ar-EG')} بالتة مقفولة)`}
      />

      {/* Summary cards with integer Pallets & Shrinks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Complete Pallets */}
        <div className="card py-5 text-center bg-blue-50/60 dark:bg-sky-950/30 border-blue-200 dark:border-sky-800">
          <div className="flex items-center justify-center gap-1.5 text-blue-700 dark:text-sky-400 mb-1">
            <Layers size={18} />
            <span className="text-xs font-bold">البالتات الكاملة</span>
          </div>
          <p className="text-3xl font-black text-blue-900 dark:text-sky-300">
            {totalCompletePallets.toLocaleString('ar-EG')}
          </p>
          <p className="text-xs text-blue-600 dark:text-sky-400 mt-1">بالتة مقفولة</p>
        </div>

        {/* Total Shrinks */}
        <div className="card py-5 text-center bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
            <Package size={18} />
            <span className="text-xs font-bold">إجمالي الشرنكات</span>
          </div>
          <p className="text-3xl font-black text-emerald-900 dark:text-emerald-300">
            {totalShrinks.toLocaleString('ar-EG')}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">شرنك متاح للتحميل</p>
        </div>

        {/* Total Pieces */}
        <div className="card py-5 text-center">
          <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي القطع (علب)</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">
            {totalPieces.toLocaleString('ar-EG')}
          </p>
          <p className="text-xs text-gray-400 mt-1">قطعة إجمالية</p>
        </div>

        {/* Low Stock count */}
        <div className="card py-5 text-center">
          <p className="text-xs text-gray-500 font-semibold mb-1">أصناف تحتاج طلب</p>
          <p className={`text-2xl font-black ${lowCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {lowCount}
          </p>
          <p className="text-xs text-gray-400 mt-1">{lowCount > 0 ? 'أقل من حد الأمان' : 'كل الأصناف متوفرة'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو SKU..." />
          </div>
          <div className="flex gap-2">
            {[['all','الكل'],['low','منخفض'],['ok','مستوى جيد']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filter === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table with Pallets, Shrinks, Pieces breakdown */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="لا توجد أصناف في المخزن" icon={Warehouse} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th className="text-center">معدل البالتة</th>
                  <th className="text-center">إجمالي المستلم</th>
                  <th className="text-center">إجمالي المحمّل</th>
                  <th className="text-center">المرتجع السليم</th>
                  <th className="text-center">التالف</th>
                  <th className="text-center bg-blue-50/50 dark:bg-sky-950/20 font-bold">رصيد البالتات</th>
                  <th className="text-center bg-emerald-50/50 dark:bg-emerald-950/20 font-bold">إجمالي الشرنكات المتاحة</th>
                  <th className="text-center">المتاح بالقطع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const pPerShrink = p.piecesPerShrink || 24;
                  const sPerPallet = p.shrinksPerPallet || 169;

                  // Current available calculations
                  const currentPieces = p.currentStock;
                  const currentShrinks = Math.floor(currentPieces / pPerShrink);

                  // Exact integer pallets and remaining shrinks (No Decimals!)
                  const fullPallets = Math.floor(currentShrinks / sPerPallet);
                  const remainingShrinks = currentShrinks % sPerPallet;

                  // Movement calculations in shrinks
                  const receivedShrinks = Math.floor(p.totalReceived / pPerShrink);
                  const dispatchedShrinks = Math.floor(p.totalDispatched / pPerShrink);
                  const returnedShrinks = Math.floor(p.totalGoodReturned / pPerShrink);
                  const damagedShrinks = Math.floor(p.totalDamaged / pPerShrink);

                  return (
                    <tr key={p.id}>
                      {/* Product Name & SKU */}
                      <td>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-slate-100">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.sku} · {p.packageSize || ''}</p>
                        </div>
                      </td>

                      {/* Packaging specs */}
                      <td className="text-center text-xs text-gray-500 font-semibold">
                        <span>{sPerPallet} ش/بالتة</span>
                        <span className="block text-[11px] text-gray-400">({pPerShrink} ق/شرنك)</span>
                      </td>

                      {/* Received in shrinks & full pallets */}
                      <td className="text-center font-bold text-emerald-700 dark:text-emerald-400">
                        {receivedShrinks > 0 ? (
                          <div>
                            <span>{receivedShrinks.toLocaleString('ar-EG')} شرنك</span>
                            {receivedShrinks >= sPerPallet && (
                              <span className="block text-[11px] font-semibold text-blue-700 dark:text-sky-400">
                                ({Math.floor(receivedShrinks / sPerPallet)} بالتة)
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </td>

                      {/* Dispatched / Loading */}
                      <td className="text-center font-bold text-slate-800 dark:text-slate-200">
                        {dispatchedShrinks > 0 ? (
                          <div>
                            <span>{dispatchedShrinks.toLocaleString('ar-EG')} شرنك</span>
                            <span className="block text-[11px] font-normal text-gray-400">
                              ({p.totalDispatched.toLocaleString('ar-EG')} ق)
                            </span>
                          </div>
                        ) : '—'}
                      </td>

                      {/* Returned */}
                      <td className="text-center font-semibold text-amber-600 dark:text-amber-400">
                        {returnedShrinks > 0 ? `${returnedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                      </td>

                      {/* Damaged */}
                      <td className="text-center font-semibold text-rose-600 dark:text-rose-400">
                        {damagedShrinks > 0 ? `${damagedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                      </td>

                      {/* Available PALLETS (Integer ONLY - No decimals!) */}
                      <td className="text-center bg-blue-50/50 dark:bg-sky-950/20">
                        <span className="font-black text-lg text-blue-900 dark:text-sky-300">
                          {fullPallets}
                        </span>
                        <span className="text-xs font-bold text-blue-700 dark:text-sky-400 mr-1">بالتة</span>
                        {remainingShrinks > 0 && (
                          <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            (+{remainingShrinks} شرنك فك)
                          </span>
                        )}
                      </td>

                      {/* Available SHRINKS (Total actual shrinks ready to dispatch) */}
                      <td className="text-center bg-emerald-50/50 dark:bg-emerald-950/20">
                        <span className="font-black text-lg text-emerald-800 dark:text-emerald-300">
                          {currentShrinks.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mr-1">شرنك</span>
                      </td>

                      {/* Available PIECES */}
                      <td className="text-center">
                        <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                          {currentPieces.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-xs text-gray-400 mr-1">ق</span>
                      </td>

                      {/* Status badge */}
                      <td>
                        <StatusBadge variant={p.isLowStock ? 'warning' : 'success'}>
                          {p.isLowStock ? (
                            <><AlertTriangle size={11} /> منخفض</>
                          ) : 'جيد'}
                        </StatusBadge>
                      </td>
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
