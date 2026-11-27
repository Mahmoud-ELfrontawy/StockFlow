// ============================================================
// STOCKFLOW — OLD STOCK PAGE (رصيد قديم)
// Record historical/opening stock: pallets, loose shrinks, loose pieces,
// and legacy returns that directly add into available warehouse inventory.
// ============================================================

import { useState, useMemo } from 'react';
import {
  Archive,
  Plus,
  Trash2,
  CheckCircle,
  Package,
  Layers,
  RotateCcw,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import useInventoryStore, { MIXED_PRODUCT } from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import SearchInput from '../../components/common/SearchInput';
import { formatDate, todayISO } from '../../utils/formatters';
import { TRANSACTION_TYPES } from '../../utils/constants';

const itemSchema = z.object({
  productId: z.string().optional().default(''),
  isMixed: z.boolean().default(false),
  pallets: z.coerce.number().min(0).default(0),
  extraShrinks: z.coerce.number().min(0).default(0),
  returnsShrinks: z.coerce.number().min(0).default(0),
  extraPieces: z.coerce.number().min(0).default(0),
});

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'أضف صنفاً واحداً على الأقل'),
});

function OldStockForm({ products, initialValues, onSubmit, onClose }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues || {
      date: todayISO(),
      referenceNumber: '',
      notes: '',
      items: [
        {
          productId: '',
          isMixed: false,
          pallets: 0,
          extraShrinks: 0,
          returnsShrinks: 0,
          extraPieces: 0,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const getProduct = (id, isMixed) => {
    if (isMixed || id === 'prod-mixed' || !id) return MIXED_PRODUCT;
    return products.find((p) => p.id === id) || MIXED_PRODUCT;
  };

  // Totals calculations across all rows
  const summaryTotals = useMemo(() => {
    let totalShrinks = 0;
    let totalPieces = 0;
    let totalReturnsShrinks = 0;
    let totalPallets = 0;

    watchedItems?.forEach((item) => {
      const isMixed = item?.isMixed || !item?.productId || item?.productId === 'prod-mixed';
      const p = getProduct(item?.productId, isMixed);
      const sPerPallet = p?.shrinksPerPallet || 169;
      const pPerShrink = p?.piecesPerShrink || 24;

      const pCount = parseFloat(item?.pallets) || 0;
      const sExtra = parseFloat(item?.extraShrinks) || 0;
      const sReturns = parseFloat(item?.returnsShrinks) || 0;
      const pPieces = parseFloat(item?.extraPieces) || 0;

      const baseShrinks = pCount * sPerPallet + sExtra + sReturns;
      const rowPieces = baseShrinks * pPerShrink + pPieces;
      const rowShrinks = Math.floor(rowPieces / pPerShrink);

      totalPallets += pCount;
      totalReturnsShrinks += sReturns;
      totalShrinks += rowShrinks;
      totalPieces += rowPieces;
    });

    return { totalShrinks, totalPieces, totalReturnsShrinks, totalPallets };
  }, [watchedItems, products]);

  const handleFormSubmit = (data) => {
    // Transform items with computed quantities
    const preparedItems = data.items.map((item) => {
      const isMixed = item.isMixed || !item.productId || item.productId === 'prod-mixed';
      const p = getProduct(item.productId, isMixed);
      const sPerPallet = p?.shrinksPerPallet || 169;
      const pPerShrink = p?.piecesPerShrink || 24;

      const pCount = parseFloat(item.pallets) || 0;
      const sExtra = parseFloat(item.extraShrinks) || 0;
      const sReturns = parseFloat(item.returnsShrinks) || 0;
      const pPieces = parseFloat(item.extraPieces) || 0;

      const baseShrinks = pCount * sPerPallet + sExtra + sReturns;
      const quantityPieces = Math.round(baseShrinks * pPerShrink + pPieces);
      const quantityShrinks = Math.floor(quantityPieces / pPerShrink);

      return {
        productId: isMixed ? 'prod-mixed' : item.productId,
        isMixed,
        pallets: pCount,
        extraShrinks: sExtra,
        returnsShrinks: sReturns,
        extraPieces: pPieces,
        quantityShrinks,
        quantityPieces,
      };
    });

    const hasZero = preparedItems.some((i) => i.quantityPieces <= 0);
    if (hasZero) {
      toast.error('يرجى تحديد كمية لأحد الحقول (مرتجعات بالشرنك، قطع فرط، شرنكات أو بالتات)');
      return;
    }

    onSubmit({
      date: data.date,
      referenceNumber: data.referenceNumber?.trim() || undefined,
      notes: data.notes?.trim() || '',
      items: preparedItems,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 font-cairo">
      {/* Notice */}
      <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex items-start gap-3">
        <Sparkles size={20} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold text-sky-900 dark:text-sky-300">
            حصر الرصيد القديم وبداية دورة المخزن
          </p>
          <p className="text-sky-700 dark:text-sky-400 text-xs mt-1">
            سجل هنا بضاعتك القديمة الموجودة في المخزن (بالتات كاملة، شرنكات فك، وقطع فرط).
            وأيضاً <strong>المرتجعات القديمة</strong> التي لا يُعرف مندوبها: ستُضاف مباشرة لرصيد المخزن المتاح لتبدأ برصيد فعلي مطابق لأرض الواقع!
          </p>
        </div>
      </div>

      {/* Header Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label">تاريخ القيد *</label>
          <input type="date" {...register('date')} className="form-input" />
          {errors.date && <p className="form-error">{errors.date.message}</p>}
        </div>
        <div>
          <label className="form-label">رقم الإذن / المرجع (اختياري)</label>
          <input
            {...register('referenceNumber')}
            className="form-input font-mono"
            placeholder="مثال: OLD-001 (ينشأ تلقائياً)"
          />
        </div>
        <div>
          <label className="form-label">ملاحظات عامة</label>
          <input
            {...register('notes')}
            className="form-input"
            placeholder="مثال: جرد بضاعة سابقة لتشغيل النظام..."
          />
        </div>
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-800 dark:text-slate-200 text-sm flex items-center gap-2">
            <Package size={16} className="text-blue-600 dark:text-sky-400" />
            الأصناف القديمة والمرتجعات
          </h4>
          <button
            type="button"
            onClick={() =>
              append({
                productId: '',
                pallets: 0,
                extraShrinks: 0,
                returnsShrinks: 0,
                extraPieces: 0,
              })
            }
            className="text-sm text-blue-600 dark:text-sky-400 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={15} /> إضافة صنف
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const item = watchedItems?.[index];
            const isMixed = item?.isMixed || !item?.productId || item?.productId === 'prod-mixed';
            const p = getProduct(item?.productId, isMixed);
            const sPerPallet = p?.shrinksPerPallet || 169;
            const pPerShrink = p?.piecesPerShrink || 24;

            const pCount = parseFloat(item?.pallets) || 0;
            const sExtra = parseFloat(item?.extraShrinks) || 0;
            const sReturns = parseFloat(item?.returnsShrinks) || 0;
            const pPieces = parseFloat(item?.extraPieces) || 0;

            const baseShrinks = pCount * sPerPallet + sExtra + sReturns;
            const rowPieces = baseShrinks * pPerShrink + pPieces;
            const rowShrinks = Math.floor(rowPieces / pPerShrink);

            return (
              <div
                key={field.id}
                className="bg-gray-50/90 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 transition-all"
              >
                {/* Row 1: Product select & info */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="form-label text-xs font-bold text-gray-700 dark:text-slate-300 mb-0">
                        الصنف
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !item?.isMixed;
                          setValue(`items.${index}.isMixed`, nextState);
                          setValue(`items.${index}.productId`, nextState ? 'prod-mixed' : '');
                        }}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                          item?.isMixed || item?.productId === 'prod-mixed'
                            ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-amber-400'
                        }`}
                      >
                        {item?.isMixed || item?.productId === 'prod-mixed'
                          ? '✓ تشكيلة مشكّلة / بدون فرز'
                          : '📦 صنف مشكّل / بدون فرز؟'}
                      </button>
                    </div>

                    {item?.isMixed || item?.productId === 'prod-mixed' ? (
                      <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-amber-900 dark:text-amber-300 block">
                            📦 تشكيلة مشكّلة / مرتجعات وفرط بدون فرز
                          </span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400">
                            (24 ق/شرنك · 169 ش/بالتة) — لا يشترط تحديد صنف
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setValue(`items.${index}.isMixed`, false);
                            setValue(`items.${index}.productId`, '');
                          }}
                          className="text-xs text-amber-800 dark:text-amber-300 underline font-semibold hover:text-amber-900 cursor-pointer"
                        >
                          اختيار صنف محدد
                        </button>
                      </div>
                    ) : (
                      <div>
                        <select
                          {...register(`items.${index}.productId`)}
                          className="form-input font-medium"
                        >
                          <option value="">-- اختياري: اختر الصنف (أو اتركه لتسجيل مشكّل وفرط) --</option>
                          <option value="prod-mixed" className="font-bold text-amber-700">
                            📦 تشكيلة مشكّلة / مرتجعات وفرط بدون فرز (عام)
                          </option>
                          {products
                            .filter((pr) => (pr.isActive || initialValues?.items?.some((old) => old.productId === pr.id)) && pr.id !== 'prod-mixed')
                            .map((pr) => (
                              <option key={pr.id} value={pr.id}>
                                {pr.name} ({pr.shrinksPerPallet || 169} ش/بالتة · {pr.piecesPerShrink || 24} ق/ش)
                              </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                          💡 إذا تركت الصنف فارغاً، تُسجل الكميات كـ بضاعة مشكّلة تلقائياً بدون تعقيد.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 1. Full Pallets */}
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-blue-700 dark:text-sky-400">
                      بالتات كاملة ({sPerPallet} ش)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`items.${index}.pallets`)}
                      className="form-input text-center font-bold text-base text-blue-900 dark:text-sky-300 bg-blue-50/50 dark:bg-sky-950/30 border-blue-200 dark:border-sky-800"
                      placeholder="0"
                    />
                  </div>

                  {/* 2. Loose Shrinks */}
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-gray-700 dark:text-slate-300">
                      شرنكات فك
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`items.${index}.extraShrinks`)}
                      className="form-input text-center font-bold text-base"
                      placeholder="0"
                    />
                  </div>

                  {/* 3. Old Returns in Shrinks (Dedicated Highlighted Input) */}
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <RotateCcw size={12} />
                      مرتجعات قديمة (بالشرنك)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`items.${index}.returnsShrinks`)}
                      className="form-input text-center font-bold text-base text-amber-900 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 focus:ring-amber-500"
                      placeholder="0"
                      title="عدد الشرنكات المرتجعة سابقاً وستضاف للمخزن فوراً"
                    />
                  </div>

                  {/* Delete button */}
                  {fields.length > 1 && (
                    <div className="sm:col-span-1 flex justify-center pt-7">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="btn-icon text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="حذف هذا الصنف"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 2: Loose pieces & computed totals */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center mt-3 pt-3 border-t border-gray-200/60 dark:border-slate-800">
                  <div className="sm:col-span-4 flex items-center gap-2">
                    <label className="text-xs font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap flex items-center gap-1">
                      قطع فرط (علب منفردة):
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register(`items.${index}.extraPieces`)}
                      className="form-input text-center font-bold text-sm w-28 py-1 bg-purple-50/60 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500 font-semibold">علبة</span>
                  </div>

                  {/* Computed result for this row */}
                  <div className="sm:col-span-8 flex items-center justify-end gap-2 text-xs flex-wrap">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">
                      المحسوب:
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-black px-3 py-1 rounded-xl text-sm">
                      {rowShrinks.toLocaleString('en-US')} شرنك
                      {rowPieces % pPerShrink > 0 && ` + ${rowPieces % pPerShrink} ق`}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 font-semibold">
                      ({rowPieces.toLocaleString('en-US')} قطعة)
                    </span>
                    {sReturns > 0 && (
                      <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                        {sReturns} ش مرتجع قديم
                      </span>
                    )}
                    {pPieces > 0 && (
                      <span className="bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                        {pPieces} ق فرط
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {errors.items?.message && (
          <p className="form-error mt-2">{errors.items.message}</p>
        )}
      </div>

      {/* Summary Box */}
      {summaryTotals.totalShrinks > 0 && (
        <div className="bg-blue-50/80 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <span className="text-xs text-blue-800 dark:text-slate-400 font-bold block mb-0.5">
              إجمالي الرصيد القديم الذي سيُضاف للمخزن
            </span>
            <span className="text-2xl font-black text-blue-900 dark:text-sky-300">
              {summaryTotals.totalShrinks.toLocaleString('en-US')} شرنك
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2 font-semibold">
              ({summaryTotals.totalPieces.toLocaleString('en-US')} قطعة)
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {summaryTotals.totalPallets > 0 && (
              <span className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 dark:text-sky-400">
                {summaryTotals.totalPallets} بالتة كاملة
              </span>
            )}
            {summaryTotals.totalReturnsShrinks > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300">
                +{summaryTotals.totalReturnsShrinks} شرنك مرتجعات قديمة
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={isSubmitting}>
          <CheckCircle size={16} /> تسجيل وحفظ الرصيد القديم
        </Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function OldStockPage() {
  const { products, stockTransactions, recordOldStock } = useInventoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOldStock, setEditingOldStock] = useState(null);
  const [search, setSearch] = useState('');

  // Filter all opening balance (old stock) transactions
  const oldStockTxs = useMemo(() => {
    return stockTransactions
      .filter((tx) => tx.type === TRANSACTION_TYPES.OPENING_BALANCE)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [stockTransactions]);

  const filtered = useMemo(() => {
    return oldStockTxs.filter((tx) => {
      const p = products.find((pr) => pr.id === tx.productId);
      const matchSearch =
        !search ||
        tx.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        p?.name.toLowerCase().includes(search.toLowerCase()) ||
        tx.notes?.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [oldStockTxs, products, search]);

  // Overall Statistics
  const stats = useMemo(() => {
    let totalShrinks = 0;
    let totalPieces = 0;
    let totalReturns = 0;
    let totalPallets = 0;

    oldStockTxs.forEach((tx) => {
      const p = products.find((pr) => pr.id === tx.productId);
      const pShrink = p?.piecesPerShrink || 24;
      const s = tx.quantityShrinks !== undefined
        ? tx.quantityShrinks
        : Math.floor(tx.quantityPieces / pShrink);

      totalShrinks += s;
      totalPieces += tx.quantityPieces;
      totalReturns += tx.returnsShrinks || 0;
      totalPallets += tx.pallets || 0;
    });

    return { totalShrinks, totalPieces, totalReturns, totalPallets };
  }, [oldStockTxs, products]);

  const handleSubmit = async (data) => {
    const result = await recordOldStock({
      ...data,
      editReferenceNumber: editingOldStock?.referenceNumber,
    });
    if (result.success) {
      toast.success(`✅ تم تسجيل الرصيد القديم ${result.referenceNumber} بنجاح وإضافته للمخزن`);
      setModalOpen(false);
      setEditingOldStock(null);
    } else {
      toast.error(result.message || 'حدث خطأ أثناء التسجيل');
    }
  };

  const handleEdit = (tx) => {
    const group = oldStockTxs.filter((item) => item.referenceNumber === tx.referenceNumber);
    setEditingOldStock({
      referenceNumber: tx.referenceNumber,
      date: tx.date || todayISO(),
      notes: tx.notes || '',
      items: group.map((item) => ({
        productId: item.productId,
        isMixed: item.productId === 'prod-mixed',
        pallets: item.pallets ?? 0,
        extraShrinks: item.extraShrinks ?? item.quantityShrinks ?? Math.floor(item.quantityPieces / (products.find((p) => p.id === item.productId)?.piecesPerShrink || 24)),
        returnsShrinks: item.returnsShrinks ?? 0,
        extraPieces: item.extraPieces ?? 0,
      })),
    });
    setModalOpen(true);
  };

  const getProductName = (id) =>
    products.find((p) => p.id === id)?.name || (id === 'prod-mixed' ? MIXED_PRODUCT.name : id);

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="رصيد قديم"
        subtitle="حصر وإدخال بضاعة المخزن القديمة بالبالتات والشرنكات والمرتجعات السابقة"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> تسجيل رصيد قديم
          </Button>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card py-5 text-center bg-blue-50/60 dark:bg-sky-950/30 border-blue-200 dark:border-sky-800">
          <div className="flex items-center justify-center gap-1.5 text-blue-700 dark:text-sky-400 mb-1">
            <Archive size={18} />
            <span className="text-xs font-bold">إجمالي الشرنكات القديمة</span>
          </div>
          <p className="text-3xl font-black text-blue-900 dark:text-sky-300">
            {stats.totalShrinks.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-blue-600 dark:text-sky-400 mt-1">شرنك مسجل كرصيد سابق</p>
        </div>

        <div className="card py-5 text-center bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400 mb-1">
            <Layers size={18} />
            <span className="text-xs font-bold">البالتات الكاملة</span>
          </div>
          <p className="text-3xl font-black text-emerald-900 dark:text-emerald-300">
            {stats.totalPallets.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">بالتة مقفولة</p>
        </div>

        <div className="card py-5 text-center bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
            <RotateCcw size={18} />
            <span className="text-xs font-bold">مرتجعات قديمة مضافة</span>
          </div>
          <p className="text-3xl font-black text-amber-900 dark:text-amber-300">
            {stats.totalReturns.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">شرنك مرتجع مجهول المندوب</p>
        </div>

        <div className="card py-5 text-center">
          <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي القطع الكلي</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">
            {stats.totalPieces.toLocaleString('en-US')}
          </p>
          <p className="text-xs text-gray-400 mt-1">قطعة مضافة للمخزن</p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="card p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث برقم الإذن، اسم المنتج، أو الملاحظات..."
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Archive size={40} className="mx-auto text-gray-400 mb-3" />
            <h3 className="font-bold text-gray-700 dark:text-slate-300 text-base">
              لا يوجد رصيد قديم مسجل حتى الآن
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              سجل بضاعتك القديمة والمرتجعات السابقة للبدء برصيد حقيقي دقيق داخل المخزن.
            </p>
            <div className="mt-4">
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={15} /> تسجيل أول رصيد قديم
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم الإذن</th>
                  <th>التاريخ</th>
                  <th>الصنف</th>
                  <th className="text-center">تفاصيل الرصيد القديم</th>
                  <th className="text-center bg-blue-50/40 dark:bg-sky-950/20 font-bold">
                    إجمالي الشرنكات المضافة
                  </th>
                  <th className="text-center">القطع</th>
                  <th>البيان والملاحظات</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const p = products.find((pr) => pr.id === tx.productId);
                  const pShrink = p?.piecesPerShrink || 24;
                  const shrinks = tx.quantityShrinks !== undefined
                    ? tx.quantityShrinks
                    : Math.floor(tx.quantityPieces / pShrink);

                  return (
                    <tr key={tx.id}>
                      <td>
                        <span className="font-mono font-bold text-blue-600 dark:text-sky-400">
                          #{tx.referenceNumber}
                        </span>
                      </td>
                      <td className="text-xs text-gray-500">{formatDate(tx.date)}</td>
                      <td>
                        <p className="font-bold text-gray-900 dark:text-slate-100">
                          {getProductName(tx.productId)}
                        </p>
                        <p className="text-xs text-gray-400">{p?.sku}</p>
                      </td>
                      <td className="text-center text-xs">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {tx.pallets > 0 && (
                            <span className="bg-blue-50 dark:bg-sky-950/40 text-blue-700 dark:text-sky-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-sky-800 font-bold">
                              {tx.pallets} بالتة
                            </span>
                          )}
                          {tx.extraShrinks > 0 && (
                            <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-2 py-0.5 rounded-lg font-semibold">
                              {tx.extraShrinks} ش فك
                            </span>
                          )}
                          {tx.returnsShrinks > 0 && (
                            <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800 font-bold">
                              {tx.returnsShrinks} ش مرتجع قديم
                            </span>
                          )}
                          {tx.extraPieces > 0 && (
                            <span className="text-gray-400 font-normal">
                              (+{tx.extraPieces} ق فرط)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center bg-blue-50/30 dark:bg-sky-950/10">
                        <span className="font-black text-base text-emerald-700 dark:text-emerald-400">
                          {shrinks.toLocaleString('en-US')} شرنك
                        </span>
                      </td>
                      <td className="text-center font-semibold text-gray-500 dark:text-slate-400 text-xs">
                        {tx.quantityPieces.toLocaleString('en-US')} ق
                      </td>
                      <td className="text-xs text-gray-500 max-w-xs truncate">
                        {tx.notes || '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleEdit(tx)}
                          className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
                          title="تعديل إذن الرصيد القديم"
                        ><Pencil size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingOldStock(null); }}
        title={editingOldStock ? `تعديل إذن الرصيد القديم #${editingOldStock.referenceNumber}` : 'تسجيل رصيد قديم ومرتجعات سابقة'}
        size="xl"
      >
        <OldStockForm
          key={editingOldStock?.referenceNumber || 'new-old-stock'}
          products={products}
          initialValues={editingOldStock}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
