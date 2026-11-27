// STOCKFLOW — STOCK LEDGER PAGE
import { useState, useMemo } from 'react';
import { BookOpen, FileSpreadsheet, Printer, X, RotateCcw, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import useInventoryStore, { MIXED_PRODUCT } from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import { TRANSACTION_TYPES, TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import { formatDateTime, todayISO } from '../../utils/formatters';
import { calculateStockAtDate } from '../../utils/stockCalculations';

const TYPE_VARIANT = {
  [TRANSACTION_TYPES.OPENING_BALANCE]: 'muted',
  [TRANSACTION_TYPES.STOCK_IN]: 'success',
  [TRANSACTION_TYPES.LOADING]: 'info',
  [TRANSACTION_TYPES.RETURN_GOOD]: 'warning',
  [TRANSACTION_TYPES.RETURN_DAMAGED]: 'danger',
  [TRANSACTION_TYPES.RETURN_REPLACEMENT]: 'danger',
  [TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH]: 'info',
  [TRANSACTION_TYPES.DAMAGE]: 'danger',
  [TRANSACTION_TYPES.ADJUSTMENT]: 'muted',
  [TRANSACTION_TYPES.REVERSAL]: 'muted',
};

const ADDITION_TYPES = [
  TRANSACTION_TYPES.STOCK_IN,
  TRANSACTION_TYPES.OPENING_BALANCE,
  TRANSACTION_TYPES.RETURN_GOOD,
];

const DEDUCTION_TYPES = [
  TRANSACTION_TYPES.LOADING,
  TRANSACTION_TYPES.DAMAGE,
  TRANSACTION_TYPES.RETURN_REPLACEMENT,
];

const COMPANY_BUCKET_TYPES = [
  TRANSACTION_TYPES.RETURN_DAMAGED,
  TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH,
];

export default function StockLedgerPage() {
  const { products, salesmen, stockTransactions, settings } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const enrichedTransactions = useMemo(() => {
    return stockTransactions
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((tx) => {
        const before = calculateStockAtDate(tx.productId, stockTransactions, tx.createdAt);
        const isAddition = ADDITION_TYPES.includes(tx.type);
        const isDeduction = DEDUCTION_TYPES.includes(tx.type);
        const isCompanyBucket = COMPANY_BUCKET_TYPES.includes(tx.type);

        const delta = isCompanyBucket
          ? 0
          : isAddition
          ? tx.quantityPieces
          : isDeduction
          ? -tx.quantityPieces
          : tx.quantityPieces;
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
      const q = search.trim().toLowerCase();
      const prodName = (products.find((p) => p.id === tx.productId)?.name || '').toLowerCase();
      const salesmanName = (salesmen.find((s) => s.id === tx.salesmanId)?.name || '').toLowerCase();
      const matchSearch =
        !q ||
        tx.referenceNumber?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        prodName.includes(q) ||
        salesmanName.includes(q);

      const matchProduct = !filterProduct || tx.productId === filterProduct;
      const matchSalesman = !filterSalesman || tx.salesmanId === filterSalesman;
      const matchType = !filterType || tx.type === filterType;

      const matchDate =
        !filterDate ||
        (() => {
          if (tx.date && tx.date.slice(0, 10) === filterDate) return true;
          if (tx.createdAt) {
            const localDate = new Date(tx.createdAt).toLocaleDateString('en-CA');
            if (localDate === filterDate) return true;
            if (tx.createdAt.slice(0, 10) === filterDate) return true;
          }
          return false;
        })();

      return matchSearch && matchProduct && matchSalesman && matchType && matchDate;
    });
  }, [enrichedTransactions, products, salesmen, search, filterProduct, filterSalesman, filterType, filterDate]);

  const getProduct = (id) => products.find((p) => p.id === id) || (id === 'prod-mixed' ? MIXED_PRODUCT : null);
  const getProductName = (id) => getProduct(id)?.name || id;
  const getSalesmanName = (id) => (id ? salesmen.find((s) => s.id === id)?.name || '—' : '—');

  // Summary of currently visible filtered transactions
  const filteredSummary = useMemo(() => {
    let addedShrinks = 0;
    let addedPieces = 0;
    let deductedShrinks = 0;
    let deductedPieces = 0;

    filtered.forEach((tx) => {
      const pShrink = getProduct(tx.productId)?.piecesPerShrink || 24;
      const shrinks = Math.floor(Math.abs(tx.quantityPieces) / pShrink);
      if (ADDITION_TYPES.includes(tx.type)) {
        addedShrinks += shrinks;
        addedPieces += tx.quantityPieces;
      } else if (DEDUCTION_TYPES.includes(tx.type)) {
        deductedShrinks += shrinks;
        deductedPieces += tx.quantityPieces;
      }
    });

    return { addedShrinks, addedPieces, deductedShrinks, deductedPieces };
  }, [filtered, products]);

  const hasActiveFilters = Boolean(search || filterProduct || filterSalesman || filterType || filterDate);

  const resetFilters = () => {
    setSearch('');
    setFilterProduct('');
    setFilterSalesman('');
    setFilterType('');
    setFilterDate('');
  };

  // ── Export Visible Data to Organized Excel Sheet ────────────
  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error('لا توجد بيانات ظاهرة لتصديرها');
      return;
    }

    const warehouseTitle = settings?.warehouseName || 'StockFlow - دفتر حركة المخزن';
    const filterInfoParts = [];
    if (filterDate) filterInfoParts.push(`التاريخ: ${filterDate}`);
    if (filterProduct) filterInfoParts.push(`الصنف: ${getProductName(filterProduct)}`);
    if (filterSalesman) filterInfoParts.push(`المندوب: ${getSalesmanName(filterSalesman)}`);
    if (filterType) filterInfoParts.push(`النوع: ${TRANSACTION_TYPE_LABELS[filterType]}`);
    if (search) filterInfoParts.push(`بحث: ${search}`);

    const headerRows = [
      [warehouseTitle, '', '', '', '', '', '', '', '', '', ''],
      ['تقرير دفتر حركة المخزن', '', `تاريخ التصدير: ${formatDateTime(new Date())}`, '', `عدد الحركات: ${filtered.length}`, '', filterInfoParts.length > 0 ? `الفلاتر: ${filterInfoParts.join(' | ')}` : 'عرض شامل (بدون فلاتر)'],
      [
        'ملخص الإضافات:',
        `+${filteredSummary.addedShrinks.toLocaleString('en-US')} شرنك (${filteredSummary.addedPieces.toLocaleString('en-US')} قطعة)`,
        '',
        'ملخص المنصرف/الخصم:',
        `-${filteredSummary.deductedShrinks.toLocaleString('en-US')} شرنك (${filteredSummary.deductedPieces.toLocaleString('en-US')} قطعة)`,
      ],
      [],
      [
        'م',
        'رقم المرجع',
        'التاريخ والتوقيت',
        'نوع الحركة',
        'المنتج / الصنف',
        'الكمية (شرنك)',
        'الكمية (قطعة)',
        'الرصيد قبل (شرنك)',
        'الرصيد بعد (شرنك)',
        'المندوب',
        'ملاحظات',
      ],
    ];

    const dataRows = filtered.map((tx, idx) => {
      const pShrink = getProduct(tx.productId)?.piecesPerShrink || 24;
      const isAddition = ADDITION_TYPES.includes(tx.type);
      const isCompanyBucket = COMPANY_BUCKET_TYPES.includes(tx.type);
      const sign = tx.type === TRANSACTION_TYPES.RETURN_DAMAGED ? '+' : isAddition ? '+' : '-';
      const deltaShrinks = Math.floor(Math.abs(tx.quantityPieces) / pShrink);
      const deltaLoose = Math.abs(tx.quantityPieces) % pShrink;
      const beforeShrinks = tx.balanceBefore !== undefined ? Math.floor(tx.balanceBefore / pShrink) : '';
      const afterShrinks = tx.balanceAfter !== undefined ? Math.floor(tx.balanceAfter / pShrink) : '';

      return [
        idx + 1,
        `#${tx.referenceNumber}`,
        formatDateTime(tx.createdAt),
        TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
        getProductName(tx.productId),
        `${sign}${deltaShrinks}${deltaLoose > 0 ? ` + ${deltaLoose} ق` : ''}`,
        tx.quantityPieces,
        beforeShrinks,
        afterShrinks,
        getSalesmanName(tx.salesmanId),
        tx.notes || (isCompanyBucket ? 'حركة مخزن الشركة' : ''),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    worksheet['!views'] = [{ rightToLeft: true }];
    worksheet['!cols'] = [
      { wch: 6 },  // م
      { wch: 14 }, // رقم المرجع
      { wch: 20 }, // التاريخ
      { wch: 18 }, // نوع الحركة
      { wch: 28 }, // المنتج
      { wch: 15 }, // الكمية شرنك
      { wch: 14 }, // الكمية قطعة
      { wch: 16 }, // قبل
      { wch: 16 }, // بعد
      { wch: 18 }, // المندوب
      { wch: 36 }, // ملاحظات
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'دفتر الحركة');

    const fileName = `دفتر-حركة-المخزن-${filterDate || todayISO()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`تم تصدير ${filtered.length} حركة إلى ملف Excel بنجاح`);
  };

  // ── Print / Save as Professional PDF Report ─────────────────
  const handlePrintReport = () => {
    if (filtered.length === 0) {
      toast.error('لا توجد بيانات ظاهرة للطباعة');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      toast.error('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
      return;
    }

    const rowsHtml = filtered
      .map((tx, idx) => {
        const pShrink = getProduct(tx.productId)?.piecesPerShrink || 24;
        const isAddition = ADDITION_TYPES.includes(tx.type);
        const sign = isAddition ? '+' : '-';
        const deltaShrinks = Math.floor(Math.abs(tx.quantityPieces) / pShrink);
        const beforeShrinks = tx.balanceBefore !== undefined ? Math.floor(tx.balanceBefore / pShrink) : '—';
        const afterShrinks = tx.balanceAfter !== undefined ? Math.floor(tx.balanceAfter / pShrink) : '—';

        return `
          <tr>
            <td>${idx + 1}</td>
            <td class="mono">#${tx.referenceNumber}</td>
            <td>${formatDateTime(tx.createdAt)}</td>
            <td><span class="badge ${isAddition ? 'add' : 'ded'}">${TRANSACTION_TYPE_LABELS[tx.type]}</span></td>
            <td class="bold">${getProductName(tx.productId)}</td>
            <td class="bold ${isAddition ? 'text-add' : 'text-ded'}">${sign}${deltaShrinks.toLocaleString('en-US')} ش (${tx.quantityPieces.toLocaleString('en-US')} ق)</td>
            <td>${beforeShrinks !== '—' ? `${beforeShrinks.toLocaleString('en-US')} ش` : '—'}</td>
            <td class="bold">${afterShrinks !== '—' ? `${afterShrinks.toLocaleString('en-US')} ش` : '—'}</td>
            <td>${getSalesmanName(tx.salesmanId)}</td>
            <td>${tx.notes || '—'}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير دفتر حركة المخزن</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #1e293b; direction: rtl; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 18px; }
          .header h1 { margin: 0; font-size: 22px; color: #0f172a; }
          .meta { font-size: 12px; color: #475569; text-align: left; }
          .summary { display: flex; gap: 16px; margin-bottom: 18px; }
          .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
          .card span { font-size: 11px; color: #64748b; display: block; }
          .card strong { font-size: 16px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 6px; text-align: center; }
          th { background: #1e293b; color: #fff; font-weight: 700; }
          tr:nth-child(even) { background: #f8fafc; }
          .mono { font-family: monospace; font-weight: bold; color: #2563eb; }
          .bold { font-weight: 700; }
          .text-add { color: #059669; }
          .text-ded { color: #e11d48; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .badge.add { background: #d1fae5; color: #065f46; }
          .badge.ded { background: #ffe4e6; color: #9f1239; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${settings?.warehouseName || 'تقرير دفتر حركة المخزن'}</h1>
            <div style="font-size:13px;color:#475569;margin-top:4px;">سجل الحركات التفصيلي ${filterDate ? `— بتاريخ: ${filterDate}` : '— كل التواريخ'}</div>
          </div>
          <div class="meta">
            <div>تاريخ الطباعة: ${formatDateTime(new Date())}</div>
            <div>عدد الحركات: ${filtered.length}</div>
          </div>
        </div>
        <div class="summary">
          <div class="card"><span>إجمالي الحركات الظاهرة</span><strong>${filtered.length.toLocaleString('en-US')} حركة</strong></div>
          <div class="card"><span>إجمالي الإضافات (الوارد والمرتجع)</span><strong class="text-add">+${filteredSummary.addedShrinks.toLocaleString('en-US')} شرنك (${filteredSummary.addedPieces.toLocaleString('en-US')} ق)</strong></div>
          <div class="card"><span>إجمالي المنصرف (التحميل والتالف)</span><strong class="text-ded">-${filteredSummary.deductedShrinks.toLocaleString('en-US')} شرنك (${filteredSummary.deductedPieces.toLocaleString('en-US')} ق)</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>م</th>
              <th>المرجع</th>
              <th>التاريخ</th>
              <th>نوع الحركة</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>الرصيد قبل</th>
              <th>الرصيد بعد</th>
              <th>المندوب</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="دفتر حركة المخزن"
        subtitle={`سجل تدقيق كامل لكافة العمليات بالشرنك والقطع (${stockTransactions.length.toLocaleString('en-US')} حركة)`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={handlePrintReport}
              disabled={filtered.length === 0}
              title="طباعة أو حفظ التقرير الحالي بصيغة PDF"
            >
              <Printer size={16} />
              <span>طباعة / PDF</span>
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={filtered.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              title="تصدير البيانات الظاهرة إلى شيت Excel منظم"
            >
              <FileSpreadsheet size={16} />
              <span>تصدير Excel</span>
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث برقم المرجع، المنتج، المندوب أو الملاحظات..." />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
            >
              <RotateCcw size={14} />
              <span>مسح الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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

          {/* Single Date Search Field */}
          <div className="relative flex items-center">
            <Calendar size={15} className="absolute right-3 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="form-input pr-9 pl-8 w-full text-sm"
              title="البحث بتاريخ محدد"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="absolute left-2.5 text-gray-400 hover:text-rose-500 p-0.5 rounded-full cursor-pointer"
                title="إلغاء فلتر التاريخ"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Live Filtered Summary Bar */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
            <span className="text-gray-600 dark:text-gray-400 font-semibold">
              النتائج الظاهرة: <strong className="text-gray-900 dark:text-white">{filtered.length.toLocaleString('en-US')}</strong> حركة
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg font-bold">
                الإضافات: +{filteredSummary.addedShrinks.toLocaleString('en-US')} شرنك ({filteredSummary.addedPieces.toLocaleString('en-US')} ق)
              </span>
              <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-lg font-bold">
                المنصرف/الخصم: -{filteredSummary.deductedShrinks.toLocaleString('en-US')} شرنك ({filteredSummary.deductedPieces.toLocaleString('en-US')} ق)
              </span>
            </div>
          </div>
        )}
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
                  const isAddition = ADDITION_TYPES.includes(tx.type);
                  const isCompanyBucket = COMPANY_BUCKET_TYPES.includes(tx.type);
                  const sign = tx.type === TRANSACTION_TYPES.RETURN_DAMAGED
                    ? '+'
                    : isAddition
                    ? '+'
                    : '-';

                  const absQty = Math.abs(tx.quantityPieces);
                  const deltaShrinks = Math.floor(absQty / pShrink);
                  const deltaLoose = absQty % pShrink;
                  const beforeShrinks = tx.balanceBefore !== undefined ? Math.floor(tx.balanceBefore / pShrink) : null;
                  const afterShrinks = tx.balanceAfter !== undefined ? Math.floor(tx.balanceAfter / pShrink) : null;

                  return (
                    <tr key={tx.id}>
                      <td><span className="font-mono text-xs text-blue-600 dark:text-sky-400 font-semibold">#{tx.referenceNumber}</span></td>
                      <td className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</td>
                      <td><StatusBadge variant={TYPE_VARIANT[tx.type]}>{TRANSACTION_TYPE_LABELS[tx.type]}</StatusBadge></td>
                      <td className="font-medium text-sm">{getProductName(tx.productId)}</td>
                      <td className="text-center">
                        <span className={`font-bold text-sm ${
                          isCompanyBucket
                            ? 'text-amber-600 dark:text-amber-400'
                            : isAddition
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {sign}{deltaShrinks.toLocaleString('en-US')} شرنك
                          {deltaLoose > 0 && ` + ${deltaLoose.toLocaleString('en-US')} ق`}
                        </span>
                        <span className="block text-[11px] text-gray-400">
                          ({tx.quantityPieces.toLocaleString('en-US')} ق{isCompanyBucket ? ' · مخزن الشركة' : ''})
                        </span>
                      </td>
                      <td className="text-center text-gray-600 dark:text-gray-400">
                        {beforeShrinks !== null ? (
                          <div>
                            <span className="font-semibold text-xs">{beforeShrinks.toLocaleString('en-US')} ش</span>
                            <span className="block text-[10px] text-gray-400">({tx.balanceBefore.toLocaleString('en-US')} ق)</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="text-center font-bold text-gray-900 dark:text-slate-100">
                        {afterShrinks !== null ? (
                          <div>
                            <span className="font-bold text-sm text-blue-700 dark:text-sky-300">{afterShrinks.toLocaleString('en-US')} شرنك</span>
                            <span className="block text-[10px] text-gray-400 font-normal">({tx.balanceAfter.toLocaleString('en-US')} ق)</span>
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