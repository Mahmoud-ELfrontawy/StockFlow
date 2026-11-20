// STOCKFLOW — REPORTS PAGE
import { useState, useMemo } from 'react';
import { Download, FileText, Table } from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';
import { formatDate } from '../../utils/formatters';

const REPORTS = [
  { id: 'stock-status', label: 'حالة المخزون الحالي' },
  { id: 'stock-in', label: 'تقرير الوارد والمستلم' },
  { id: 'loading', label: 'تقرير التحميل للمناديب' },
  { id: 'returns', label: 'تقرير المرتجعات' },
  { id: 'damage', label: 'تقرير التالف' },
];

export default function ReportsPage() {
  const { products, salesmen, stockTransactions, loadingTransactions, returnTransactions, damageRecords } = useInventoryStore();
  const [activeReport, setActiveReport] = useState('stock-status');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');

  const stockSummary = useMemo(
    () => buildWarehouseStockSummary(products, stockTransactions),
    [products, stockTransactions]
  );

  const inRange = (dateStr) => {
    if (!dateStr) return true;
    const d = dateStr.split('T')[0];
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  };

  const exportCSV = (data, headers, filename) => {
    const rows = [headers, ...data];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getProductName = (id) => products.find((p) => p.id === id)?.name || id;
  const getProduct = (id) => products.find((p) => p.id === id);
  const getSalesmanName = (id) => salesmen.find((s) => s.id === id)?.name || '—';

  const renderReport = () => {
    switch (activeReport) {
      case 'stock-status':
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 dark:text-slate-100">حالة المخزون الحالية بالشرنكات</h3>
              <Button variant="secondary" onClick={() => exportCSV(
                stockSummary.map((p) => {
                  const pShrink = p.piecesPerShrink || 24;
                  return [
                    p.name,
                    p.sku,
                    Math.floor(p.openingBalance / pShrink),
                    p.openingBalance,
                    Math.floor(p.totalReceived / pShrink),
                    p.totalReceived,
                    Math.floor(p.totalDispatched / pShrink),
                    p.totalDispatched,
                    Math.floor(p.totalGoodReturned / pShrink),
                    p.totalGoodReturned,
                    Math.floor(p.totalDamaged / pShrink),
                    p.totalDamaged,
                    Math.floor(p.currentStock / pShrink),
                    p.currentStock,
                    p.isLowStock ? 'منخفض' : 'جيد'
                  ];
                }),
                ['اسم المنتج', 'SKU', 'رصيد افتتاحي (شرنك)', 'افتتاحي (قطع)', 'مستلم (شرنك)', 'مستلم (قطع)', 'محمّل (شرنك)', 'محمّل (قطع)', 'مرتجع (شرنك)', 'مرتجع (قطع)', 'تالف (شرنك)', 'تالف (قطع)', 'متاح (شرنك)', 'متاح (قطع)', 'الحالة'],
                'stock-status-report'
              )}>
                <Download size={14} /> تصدير Excel (CSV)
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
              <table className="table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>SKU</th>
                    <th className="text-center">مستلم (شرنك)</th>
                    <th className="text-center">محمّل (شرنك)</th>
                    <th className="text-center">مرتجع (شرنك)</th>
                    <th className="text-center">تالف (شرنك)</th>
                    <th className="text-center bg-emerald-50/50 dark:bg-emerald-950/20 font-bold">المتاح الآن (شرنك)</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.map((p) => {
                    const pShrink = p.piecesPerShrink || 24;
                    const receivedShrinks = Math.floor(p.totalReceived / pShrink);
                    const dispatchedShrinks = Math.floor(p.totalDispatched / pShrink);
                    const returnedShrinks = Math.floor(p.totalGoodReturned / pShrink);
                    const damagedShrinks = Math.floor(p.totalDamaged / pShrink);
                    const currentShrinks = Math.floor(p.currentStock / pShrink);

                    return (
                      <tr key={p.id}>
                        <td className="font-bold text-gray-900 dark:text-slate-100">{p.name}</td>
                        <td className="font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {receivedShrinks > 0 ? `${receivedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                        </td>
                        <td className="text-center font-semibold text-blue-600 dark:text-sky-400">
                          {dispatchedShrinks > 0 ? `${dispatchedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                        </td>
                        <td className="text-center font-semibold text-amber-600 dark:text-amber-400">
                          {returnedShrinks > 0 ? `${returnedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                        </td>
                        <td className="text-center font-semibold text-rose-600 dark:text-rose-400">
                          {damagedShrinks > 0 ? `${damagedShrinks.toLocaleString('ar-EG')} ش` : '—'}
                        </td>
                        <td className="text-center bg-emerald-50/40 dark:bg-emerald-950/10">
                          <span className="font-black text-base text-emerald-800 dark:text-emerald-300">
                            {currentShrinks.toLocaleString('ar-EG')} شرنك
                          </span>
                          <span className="block text-[11px] text-gray-400">({p.currentStock.toLocaleString('ar-EG')} ق)</span>
                        </td>
                        <td><StatusBadge variant={p.isLowStock ? 'warning' : 'success'}>{p.isLowStock ? 'منخفض' : 'جيد'}</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'loading':
        const filteredLoadings = loadingTransactions.filter(
          (l) => inRange(l.date) && (!filterSalesman || l.salesmanId === filterSalesman)
        );
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 dark:text-slate-100">تقرير التحميل للمناديب ({filteredLoadings.length} عملية)</h3>
              <Button variant="secondary" onClick={() => exportCSV(
                filteredLoadings.flatMap((l) => l.items.map((i) => [l.referenceNumber, l.date, getSalesmanName(l.salesmanId), getProductName(i.productId), i.quantityShrinks, i.quantityPieces])),
                ['رقم التحميل', 'التاريخ', 'المندوب', 'المنتج', 'الشرنكات', 'القطع'],
                'loading-report'
              )}><Download size={14} /> تصدير Excel (CSV)</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
              <table className="table">
                <thead><tr><th>رقم التحميل</th><th>التاريخ</th><th>المندوب</th><th>الأصناف المحملة</th><th className="text-center">إجمالي التحميل (شرنك)</th></tr></thead>
                <tbody>
                  {filteredLoadings.map((l) => {
                    const totalShrinks = l.items.reduce((s, i) => s + (Number(i.quantityShrinks) || 0), 0);
                    const totalPieces = l.items.reduce((s, i) => s + i.quantityPieces, 0);
                    return (
                      <tr key={l.id}>
                        <td className="font-mono font-bold text-blue-600 dark:text-sky-400">#{l.referenceNumber}</td>
                        <td>{formatDate(l.date)}</td>
                        <td className="font-medium">{getSalesmanName(l.salesmanId)}</td>
                        <td className="text-xs">
                          {l.items.map((i) => `${getProductName(i.productId)}: ${i.quantityShrinks} شرنك`).join(' | ')}
                        </td>
                        <td className="text-center font-bold">
                          <span className="font-black text-emerald-700 dark:text-emerald-400">{totalShrinks.toLocaleString('ar-EG')} شرنك</span>
                          <span className="block text-[11px] text-gray-400 font-normal">({totalPieces.toLocaleString('ar-EG')} ق)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'returns':
        const filteredReturns = returnTransactions.filter((r) => inRange(r.date));
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 dark:text-slate-100">تقرير المرتجعات ({filteredReturns.length} حركة)</h3>
              <Button variant="secondary" onClick={() => exportCSV(
                filteredReturns.map((r) => {
                  const prod = getProduct(r.productId);
                  const pShrink = prod?.piecesPerShrink || 24;
                  return [r.referenceNumber, r.date, getSalesmanName(r.salesmanId), getProductName(r.productId), Math.floor(r.quantityPieces / pShrink), r.quantityPieces, r.condition, r.notes || ''];
                }),
                ['رقم المرتجع', 'التاريخ', 'المندوب', 'المنتج', 'الشرنكات', 'القطع', 'الحالة', 'ملاحظات'],
                'returns-report'
              )}><Download size={14} /> تصدير Excel (CSV)</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
              <table className="table">
                <thead><tr><th>رقم المرتجع</th><th>التاريخ</th><th>المندوب</th><th>المنتج</th><th className="text-center">الكمية (شرنك)</th><th>الحالة</th></tr></thead>
                <tbody>
                  {filteredReturns.map((r) => {
                    const prod = getProduct(r.productId);
                    const pShrink = prod?.piecesPerShrink || 24;
                    const shrinks = Math.floor(r.quantityPieces / pShrink);
                    return (
                      <tr key={r.id}>
                        <td className="font-mono font-bold text-blue-600 dark:text-sky-400">#{r.referenceNumber}</td>
                        <td>{formatDate(r.date)}</td>
                        <td>{getSalesmanName(r.salesmanId)}</td>
                        <td>{getProductName(r.productId)}</td>
                        <td className="text-center">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{shrinks.toLocaleString('ar-EG')} شرنك</span>
                          <span className="block text-[11px] text-gray-400">({r.quantityPieces.toLocaleString('ar-EG')} ق)</span>
                        </td>
                        <td><StatusBadge variant={r.condition === 'good' ? 'success' : r.condition === 'pending' ? 'warning' : 'danger'}>{r.condition === 'good' ? 'سليم' : r.condition === 'pending' ? 'معلق' : 'تالف'}</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'damage':
        const filteredDamages = damageRecords.filter((d) => inRange(d.date));
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800 dark:text-slate-100">تقرير البضاعة التالفة ({filteredDamages.length} سجل)</h3>
              <Button variant="secondary" onClick={() => exportCSV(
                filteredDamages.map((d) => {
                  const prod = getProduct(d.productId);
                  const pShrink = prod?.piecesPerShrink || 24;
                  return [d.referenceNumber, d.date, getProductName(d.productId), Math.floor(d.quantityPieces / pShrink), d.quantityPieces, d.reason, d.reviewStatus];
                }),
                ['رقم التلف', 'التاريخ', 'المنتج', 'الشرنكات', 'القطع', 'السبب', 'الحالة'],
                'damage-report'
              )}><Download size={14} /> تصدير Excel (CSV)</Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
              <table className="table">
                <thead><tr><th>رقم التلف</th><th>التاريخ</th><th>المنتج</th><th className="text-center">الكمية (شرنك)</th><th>السبب</th><th>حالة الاعتماد</th></tr></thead>
                <tbody>
                  {filteredDamages.map((d) => {
                    const prod = getProduct(d.productId);
                    const pShrink = prod?.piecesPerShrink || 24;
                    const shrinks = Math.floor(d.quantityPieces / pShrink);
                    return (
                      <tr key={d.id}>
                        <td className="font-mono font-bold text-red-600 dark:text-rose-400">#{d.referenceNumber}</td>
                        <td>{formatDate(d.date)}</td>
                        <td>{getProductName(d.productId)}</td>
                        <td className="text-center">
                          <span className="font-bold text-rose-600 dark:text-rose-400">{shrinks.toLocaleString('ar-EG')} شرنك</span>
                          <span className="block text-[11px] text-gray-400">({d.quantityPieces.toLocaleString('ar-EG')} ق)</span>
                        </td>
                        <td className="text-sm">{d.reason}</td>
                        <td><StatusBadge variant={d.reviewStatus === 'approved' ? 'success' : 'warning'}>{d.reviewStatus === 'approved' ? 'معتمد' : 'قيد المراجعة'}</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader title="مركز التقارير" subtitle="تقارير دقيقة مستخرجة لحظياً من حركات المخزن بالشرنكات والقطع" />
      <div className="flex gap-2 flex-wrap">
        {REPORTS.map((r) => (
          <button key={r.id} onClick={() => setActiveReport(r.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeReport === r.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">من:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="form-input text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 whitespace-nowrap">إلى:</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="form-input text-sm" />
        </div>
        {activeReport === 'loading' && (
          <select value={filterSalesman} onChange={(e) => setFilterSalesman(e.target.value)} className="form-input text-sm">
            <option value="">كل المندوبين</option>
            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
      <div className="card">{renderReport()}</div>
    </div>
  );
}