// STOCKFLOW — SALESMAN BALANCES PAGE
import { useState, useMemo } from 'react';
import { ClipboardList, AlertCircle, Package } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import { calculateSalesmanProductBalance } from '../../utils/stockCalculations';

export default function SalesmanBalancesPage() {
  const { salesmen, products, loadingTransactions, returnTransactions, damageRecords } = useInventoryStore();
  const [selectedSalesman, setSelectedSalesman] = useState('');

  const activeSalesmen = salesmen.filter((s) => s.status === 'active');

  const balances = useMemo(() => {
    if (!selectedSalesman) return [];
    return products
      .filter((p) => p.isActive)
      .map((product) => {
        const balance = calculateSalesmanProductBalance(
          selectedSalesman,
          product.id,
          loadingTransactions,
          returnTransactions,
          [],
          damageRecords
        );
        const totalLoaded = loadingTransactions
          .filter((l) => l.salesmanId === selectedSalesman)
          .flatMap((l) => l.items)
          .filter((i) => i.productId === product.id)
          .reduce((s, i) => s + i.quantityPieces, 0);
        const totalReturned = returnTransactions
          .filter((r) => r.salesmanId === selectedSalesman && r.productId === product.id && !r.isExchange)
          .reduce((s, r) => s + r.quantityPieces, 0);

        const pShrink = product.piecesPerShrink || 24;
        const totalLoadedShrinks = Math.floor(totalLoaded / pShrink);
        const totalReturnedShrinks = Math.floor(totalReturned / pShrink);
        const balanceShrinks = Math.floor(balance / pShrink);
        const balanceLoosePieces = balance % pShrink;

        return {
          ...product,
          balance,
          balanceShrinks,
          balanceLoosePieces,
          totalLoaded,
          totalLoadedShrinks,
          totalReturned,
          totalReturnedShrinks,
        };
      })
      .filter((p) => p.totalLoaded > 0 || p.totalReturned > 0 || p.balance !== 0);
  }, [selectedSalesman, products, loadingTransactions, returnTransactions, damageRecords]);

  const totalLoadedShrinks = balances.reduce((s, p) => s + p.totalLoadedShrinks, 0);
  const totalLoadedPieces = balances.reduce((s, p) => s + p.totalLoaded, 0);
  const totalBalanceShrinks = balances.reduce((s, p) => s + p.balanceShrinks, 0);
  const totalBalancePieces = balances.reduce((s, p) => s + p.balance, 0);

  const salesman = salesmen.find((s) => s.id === selectedSalesman);

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="عهدة المندوبين"
        subtitle="متابعة رصيد البضاعة المسلّمة لكل مندوب بالشرنكات"
      />

      {/* Important notice */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
        <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-800 dark:text-amber-300">ملاحظة مهمة لأمين المخزن</p>
          <p className="text-amber-700 dark:text-amber-400 mt-1">العهدة المعروضة تمثل إجمالي ما حُمّل للمندوب مطروحاً منه المرتجعات السليمة فقط. المبيعات والتسويات المالية تتم بإدارة الشركة وليست من اختصاص أمين المخزن.</p>
        </div>
      </div>

      {/* Salesman selector */}
      <div className="card p-4">
        <label className="form-label">اختر المندوب لعرض عهدته</label>
        <select value={selectedSalesman} onChange={(e) => setSelectedSalesman(e.target.value)} className="form-input max-w-sm">
          <option value="">— اختر مندوباً —</option>
          {activeSalesmen.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.employeeCode})</option>
          ))}
        </select>
      </div>

      {!selectedSalesman && (
        <EmptyState
          title="اختر مندوباً"
          description="اختر مندوباً من القائمة أعلاه لعرض كشف عهدته ومطابقتها"
          icon={ClipboardList}
        />
      )}

      {selectedSalesman && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center py-5">
              <p className="text-xs text-gray-500 mb-1">اسم المندوب</p>
              <p className="font-bold text-gray-900 dark:text-slate-100">{salesman?.name}</p>
              <p className="text-xs text-blue-600 dark:text-sky-400 font-mono">{salesman?.employeeCode}</p>
            </div>
            <div className="card text-center py-5 bg-blue-50/50 dark:bg-sky-950/20 border-blue-200 dark:border-sky-800">
              <p className="text-xs text-blue-700 dark:text-sky-400 font-bold mb-1">إجمالي المحمّل</p>
              <p className="text-2xl font-black text-blue-800 dark:text-sky-300">
                {totalLoadedShrinks.toLocaleString('en-US')} شرنك
              </p>
              <p className="text-xs text-gray-400 mt-0.5">({totalLoadedPieces.toLocaleString('en-US')} قطعة)</p>
            </div>
            <div className="card text-center py-5 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold mb-1">العهدة الحالية المقدرة</p>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
                {totalBalanceShrinks.toLocaleString('en-US')} شرنك
              </p>
              <p className="text-xs text-gray-400 mt-0.5">({totalBalancePieces.toLocaleString('en-US')} قطعة)</p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {balances.length === 0 ? (
              <EmptyState title="لا توجد بضاعة محمّلة" description="لم يتم تسجيل أي عمليات تحميل لهذا المندوب" icon={ClipboardList} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th className="text-center">إجمالي المحمّل</th>
                      <th className="text-center">إجمالي المرتجع السليم</th>
                      <th className="text-center bg-emerald-50/40 dark:bg-emerald-950/20 font-bold">العهدة الحالية (شرنك)</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <p className="font-bold text-gray-800 dark:text-slate-100">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku} · {p.piecesPerShrink} ق/ش</p>
                        </td>
                        <td className="text-center">
                          <span className="font-bold text-blue-700 dark:text-sky-400">
                            {p.totalLoadedShrinks.toLocaleString('en-US')} شرنك
                          </span>
                          <span className="block text-[11px] text-gray-400">({p.totalLoaded.toLocaleString('en-US')} ق)</span>
                        </td>
                        <td className="text-center">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {p.totalReturnedShrinks.toLocaleString('en-US')} شرنك
                          </span>
                          {p.totalReturned > 0 && (
                            <span className="block text-[11px] text-gray-400">({p.totalReturned.toLocaleString('en-US')} ق)</span>
                          )}
                        </td>
                        <td className="text-center bg-emerald-50/30 dark:bg-emerald-950/10">
                          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                            {p.balanceShrinks.toLocaleString('en-US')} شرنك
                          </span>
                          {p.balanceLoosePieces > 0 && (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 mr-1">
                              (+{p.balanceLoosePieces} ق)
                            </span>
                          )}
                          <span className="block text-[11px] text-gray-400">
                            ({p.balance.toLocaleString('en-US')} قطعة)
                          </span>
                        </td>
                        <td>
                          <StatusBadge variant={p.balance > 0 ? 'info' : 'success'}>
                            {p.balance > 0 ? 'في العهدة' : 'مسوّى'}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
