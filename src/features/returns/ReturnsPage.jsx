// ============================================================
// STOCKFLOW — RETURNS PAGE
// Supports:
// - Returns in Shrinks + Loose Pieces (with or without specific SKU / مشكّل)
// - Immediate good-stock exchange tracking (salesman swaps returns for good stock)
// - Full or partial sorting: good sellable pieces -> back to stock,
//   unsellable remainder -> Company Returns bucket
// - Dispatching accumulated Company Returns back to the company
// ============================================================

import { useState, useMemo } from 'react';
import {
  Plus,
  RotateCcw,
  CheckCircle,
  Trash2,
  Package,
  Sparkles,
  Scissors,
  Truck,
  Clock,
  AlertTriangle,
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
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import SearchInput from '../../components/common/SearchInput';
import { RETURN_CONDITIONS, RETURN_CONDITION_LABELS, TRANSACTION_TYPES } from '../../utils/constants';
import {
  breakdownStockQuantity,
  calculateCompanyReturnsStock,
} from '../../utils/stockCalculations';
import { formatDate, todayISO } from '../../utils/formatters';

const returnItemSchema = z.object({
  isMixed: z.boolean().default(true),
  productId: z.string().optional().default('prod-mixed'),
  replacementProductId: z.string().optional().default(''),
  shrinks: z.coerce.number().int().min(0, 'أدخل عددًا صحيحًا غير سالب').default(0),
  loosePieces: z.coerce.number().int().min(0, 'أدخل عددًا صحيحًا غير سالب').default(0),
  condition: z.enum(['pending', 'good', 'damaged', 'partial']).default('pending'),
  goodShrinks: z.coerce.number().int().min(0, 'أدخل عددًا صحيحًا غير سالب').default(0),
  goodLoosePieces: z.coerce.number().int().min(0, 'أدخل عددًا صحيحًا غير سالب').default(0),
  notes: z.string().optional(),
}).superRefine((item, ctx) => {
  if ((item.shrinks || 0) + (item.loosePieces || 0) <= 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['shrinks'],
      message: 'أدخل كمية المرتجع بالشرنك أو القطع الفرط',
    });
  }
});

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  salesmanId: z.string().min(1, 'المندوب مطلوب'),
  isExchange: z.boolean().default(true),
  notes: z.string().optional(),
  items: z.array(returnItemSchema).min(1, 'أضف صنفاً واحداً على الأقل'),
});

function formatBreakdownText(pieces, pPerShrink = 24, sPerPallet = 169) {
  if (!pieces || pieces <= 0) return '0 قطعة';
  const b = breakdownStockQuantity(pieces, pPerShrink, sPerPallet);
  const parts = [];
  if (b.fullPallets > 0) parts.push(`${b.fullPallets.toLocaleString('en-US')} بالتة`);
  if (b.remainingShrinks > 0) parts.push(`${b.remainingShrinks.toLocaleString('en-US')} شرنك`);
  if (b.loosePieces > 0) parts.push(`${b.loosePieces.toLocaleString('en-US')} ق`);
  return parts.length > 0 ? parts.join(' + ') : '0 قطعة';
}

function ReturnForm({ products, salesmen, initialValues, onSubmit, onClose }) {
  const activeRealProducts = useMemo(
    () => products.filter((p) => (p.isActive || initialValues?.items?.some((item) => item.productId === p.id || item.replacementProductId === p.id)) && p.id !== 'prod-mixed'),
    [products, initialValues]
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues || {
      date: todayISO(),
      salesmanId: '',
      isExchange: true,
      notes: '',
      items: [
        {
          isMixed: true,
          productId: 'prod-mixed',
          replacementProductId: '',
          shrinks: 0,
          loosePieces: 0,
          condition: RETURN_CONDITIONS.PENDING,
          goodShrinks: 0,
          goodLoosePieces: 0,
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const watchedIsExchange = watch('isExchange');

  const getProduct = (id, isMixed) => {
    if (isMixed || id === 'prod-mixed' || !id) return MIXED_PRODUCT;
    return products.find((p) => p.id === id) || MIXED_PRODUCT;
  };

  // Live summary across all return items
  const summaryTotals = useMemo(() => {
    let totalPieces = 0;
    let totalGoodPieces = 0;
    let totalCompanyPieces = 0;
    let totalPendingPieces = 0;
    let mixedCount = 0;

    watchedItems?.forEach((item) => {
      const p = getProduct(item?.productId, item?.isMixed);
      const pPerShrink = p?.piecesPerShrink || 24;
      const s = Math.max(0, Math.floor(Number(item?.shrinks) || 0));
      const lp = Math.max(0, Math.floor(Number(item?.loosePieces) || 0));
      const rowPieces = s * pPerShrink + lp;

      if (rowPieces > 0) {
        totalPieces += rowPieces;
        if (item?.isMixed || item?.productId === 'prod-mixed') mixedCount += 1;

        if (item?.condition === RETURN_CONDITIONS.GOOD) {
          totalGoodPieces += rowPieces;
        } else if (item?.condition === RETURN_CONDITIONS.COMPANY) {
          totalCompanyPieces += rowPieces;
        } else if (item?.condition === RETURN_CONDITIONS.PARTIAL) {
          const gs = Math.max(0, Math.floor(Number(item?.goodShrinks) || 0));
          const glp = Math.max(0, Math.floor(Number(item?.goodLoosePieces) || 0));
          const goodPcs = Math.min(rowPieces, gs * pPerShrink + glp);
          totalGoodPieces += goodPcs;
          totalCompanyPieces += Math.max(0, rowPieces - goodPcs);
        } else {
          totalPendingPieces += rowPieces;
        }
      }
    });

    return {
      totalPieces,
      totalShrinks: Math.floor(totalPieces / 24),
      totalLoose: totalPieces % 24,
      totalGoodPieces,
      totalCompanyPieces,
      totalPendingPieces,
      mixedCount,
    };
  }, [watchedItems, products]);

  const handleFormSubmit = (data) => {
    const preparedItems = [];

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const isMixed = item.isMixed || !item.productId || item.productId === 'prod-mixed';
      const product = isMixed ? MIXED_PRODUCT : getProduct(item.productId, false);
      const pShrink = product?.piecesPerShrink || 24;

      const s = Math.max(0, Math.floor(Number(item.shrinks) || 0));
      const lp = Math.max(0, Math.floor(Number(item.loosePieces) || 0));
      const totalPieces = s * pShrink + lp;

      if (totalPieces <= 0) {
        toast.error(`يرجى إدخال كمية (شرنكات أو قطع) في السطر رقم ${i + 1}`);
        return;
      }

      let goodPieces = 0;
      let companyPieces = 0;

      if (item.condition === RETURN_CONDITIONS.PARTIAL) {
        const gs = Math.max(0, Math.floor(Number(item.goodShrinks) || 0));
        const glp = Math.max(0, Math.floor(Number(item.goodLoosePieces) || 0));
        goodPieces = gs * pShrink + glp;
        if (goodPieces <= 0 || goodPieces >= totalPieces) {
          setError(`items.${i}.goodShrinks`, {
            type: 'manual',
            message: 'في الفرز الجزئي، يجب أن تكون الكمية السليمة أكبر من صفر وأقل من إجمالي المرتجع',
          });
          return;
        }
        companyPieces = totalPieces - goodPieces;
      }

      const targetId = isMixed ? 'prod-mixed' : item.productId;
      const replacementId = isMixed
        ? item.replacementProductId || 'prod-mixed'
        : targetId;

      preparedItems.push({
        isMixed,
        productId: targetId,
        replacementProductId: replacementId,
        shrinks: s,
        loosePieces: lp,
        quantityPieces: totalPieces,
        piecesPerShrink: pShrink,
        condition: item.condition,
        goodPieces,
        companyPieces,
        notes: item.notes?.trim() || (isMixed ? 'مرتجع شرنك مشكّل' : ''),
      });
    }

    onSubmit({
      date: data.date,
      salesmanId: data.salesmanId,
      isExchange: data.isExchange,
      notes: data.notes?.trim() || '',
      items: preparedItems,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 font-cairo text-[15px]">
      {/* Header Fields */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm font-black text-blue-700 dark:bg-sky-950 dark:text-sky-300">١</span>
          <div>
            <h4 className="text-base font-black text-gray-900 dark:text-slate-100">بيانات الإرجاع</h4>
            <p className="text-xs text-gray-500 dark:text-slate-400">حدد التاريخ والمندوب قبل إضافة الأصناف</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label text-sm font-bold text-gray-700 dark:text-slate-300">
            تاريخ الإرجاع *
          </label>
          <input type="date" {...register('date')} aria-invalid={!!errors.date} className={`form-input py-3 text-base ${errors.date ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`} />
          {errors.date && <p className="form-error">{errors.date.message}</p>}
        </div>
        <div>
          <label className="form-label text-sm font-bold text-gray-700 dark:text-slate-300">
            المندوب المرجع للبضاعة *
          </label>
          <select {...register('salesmanId')} aria-invalid={!!errors.salesmanId} className={`form-input py-3 text-base font-medium ${errors.salesmanId ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}>
            <option value="">اختر المندوب</option>
            {salesmen
              .filter((s) => s.status === 'active' || s.id === initialValues?.salesmanId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.employeeCode})
                </option>
              ))}
          </select>
          {errors.salesmanId && <p className="form-error">{errors.salesmanId.message}</p>}
        </div>
        </div>
      </div>

      {/* Exchange Toggle */}
      <div className={`rounded-2xl border p-5 shadow-sm transition-colors ${watchedIsExchange ? 'border-blue-300 bg-blue-50/70 dark:border-sky-800 dark:bg-sky-950/25' : 'border-gray-200 bg-gray-50/70 dark:border-slate-800 dark:bg-slate-900/50'}`}>
        <label className="flex items-start gap-3.5 cursor-pointer select-none">
          <input
            type="checkbox"
            {...register('isExchange')}
            className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="min-w-0 flex-1">
            <span className="block text-base font-black text-blue-950 dark:text-sky-200">
              استبدال ببضاعة سليمة (أخذ المندوب بدلاً من المرتجع بضاعة سليمة من المخزن ومشى)
            </span>
            <span className="mt-1.5 block text-sm leading-relaxed text-blue-800 dark:text-sky-300">
              عند التفعيل: تُخصم الكمية التي أخذها المندوب فوراً من <strong>المتاح الصالح للبيع</strong>. ثم بعد الفرز، ما يخرج سليماً يعود لرصيد البيع، والباقي يظهر في <strong>مرتجعات الشركة</strong>.
            </span>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${watchedIsExchange ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {watchedIsExchange ? 'مفعّل' : 'غير مفعّل'}
          </span>
        </label>
      </div>

      {/* Multi-item section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="flex items-center gap-2 text-base font-black text-gray-800 dark:text-slate-200">
              <Package size={18} className="text-blue-600 dark:text-sky-400" />
              تفاصيل الأصناف والكميات
            </h4>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              أدخل الكمية، ثم حدد حالة الفرز لكل صنف
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              append({
                isMixed: true,
                productId: 'prod-mixed',
                replacementProductId: '',
                shrinks: 0,
                loosePieces: 0,
                condition: RETURN_CONDITIONS.PENDING,
                goodShrinks: 0,
                goodLoosePieces: 0,
                notes: '',
              })
            }
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300"
          >
            <Plus size={15} /> إضافة صنف آخر
          </button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => {
            const item = watchedItems?.[index];
            const isMixed = item?.isMixed ?? true;
            const product = getProduct(item?.productId, isMixed);
            const pShrink = product?.piecesPerShrink || 24;

            const s = Math.max(0, Math.floor(Number(item?.shrinks) || 0));
            const lp = Math.max(0, Math.floor(Number(item?.loosePieces) || 0));
            const totalPieces = s * pShrink + lp;

            const gs = Math.max(0, Math.floor(Number(item?.goodShrinks) || 0));
            const glp = Math.max(0, Math.floor(Number(item?.goodLoosePieces) || 0));
            const goodPieces = gs * pShrink + glp;
            const remainingCompanyPieces = totalPieces - goodPieces;
            const partialInvalid =
              item?.condition === RETURN_CONDITIONS.PARTIAL && totalPieces > 0 && (goodPieces <= 0 || goodPieces >= totalPieces);
            const quantityError = errors.items?.[index]?.shrinks || errors.items?.[index]?.loosePieces;
            const splitError = errors.items?.[index]?.goodShrinks || errors.items?.[index]?.goodLoosePieces;

            return (
              <div
                key={field.id}
                className={`space-y-5 rounded-2xl border p-5 shadow-sm transition-colors ${quantityError || splitError || partialInvalid ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/10' : 'border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900/70'}`}
              >
                {/* Mode Selector */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/60 dark:border-slate-800 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-black text-slate-700 dark:bg-slate-700 dark:text-slate-100">{index + 1}</span>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                      نوع الصنف:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setValue(`items.${index}.isMixed`, true);
                        setValue(`items.${index}.productId`, 'prod-mixed');
                      }}
                        className={`flex cursor-pointer items-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                        isMixed
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      <Sparkles size={13} />
                      شرنك مشكّل (بدون تحديد صنف)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValue(`items.${index}.isMixed`, false);
                        if (activeRealProducts.length > 0) {
                          setValue(`items.${index}.productId`, activeRealProducts[0].id);
                        }
                      }}
                        className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                        !isMixed
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      صنف محدد
                    </button>
                  </div>

                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="flex cursor-pointer items-center gap-1 text-sm font-bold text-rose-500 hover:text-rose-700 dark:text-rose-400"
                    >
                      <Trash2 size={13} /> حذف السطر
                    </button>
                  )}
                </div>

                {/* Product + Quantity (Shrinks + Loose Pieces) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-6 space-y-2">
                    {isMixed ? (
                      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-800/60 dark:bg-amber-950/30">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-lg font-black text-amber-700 dark:text-amber-300">
                          📦
                        </div>
                        <div>
                          <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                            مرتجع مشكّل (بدون فرز صنف محدد)
                          </p>
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                            معدل الحساب الافتراضي: {pShrink} قطعة للشرنك
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="form-label text-sm font-bold text-gray-700 dark:text-slate-300">
                          اختر الصنف *
                        </label>
                        <select
                          {...register(`items.${index}.productId`)}
                          className="form-input py-3 text-base font-medium"
                        >
                          {activeRealProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.piecesPerShrink || 24} ق/ش)
                            </option>
                          ))}
                          <option value="prod-mixed">📦 شرنك مشكّل (بدون صنف)</option>
                        </select>
                      </div>
                    )}

                    {/* If Mixed AND Exchange is active, optionally let user choose which good product was handed out as replacement */}
                    {isMixed && watchedIsExchange && activeRealProducts.length > 0 && (
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-blue-700 dark:text-sky-400">
                          الصنف السليم الذي أخذه المندوب بدلاً منه:
                        </label>
                        <select
                          {...register(`items.${index}.replacementProductId`)}
                          className="form-input py-2.5 text-sm"
                        >
                          <option value="">تلقائي (شرنك مشكّل)</option>
                          {activeRealProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              بدل من: {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Shrinks Input */}
                  <div className="sm:col-span-3">
                    <label className="form-label text-sm font-bold text-blue-700 dark:text-sky-400">
                      عدد الشرنكات
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      aria-label={`عدد الشرنكات المرتجعة، الصنف ${index + 1}`}
                      aria-invalid={!!quantityError}
                      {...register(`items.${index}.shrinks`)}
                      className={`form-input py-3 text-center text-xl font-black ${quantityError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                      placeholder="0"
                    />
                  </div>

                  {/* Loose Pieces Input */}
                  <div className="sm:col-span-3">
                    <label className="form-label text-sm font-bold text-purple-700 dark:text-purple-400">
                      + قطع فرط
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      aria-label={`القطع الفرط المرتجعة، الصنف ${index + 1}`}
                      aria-invalid={!!quantityError}
                      {...register(`items.${index}.loosePieces`)}
                      className={`form-input py-3 text-center text-xl font-black bg-purple-50/50 dark:bg-purple-950/30 ${quantityError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-purple-200 dark:border-purple-800'}`}
                      placeholder="0"
                    />
                  </div>
                </div>
                {quantityError && <p className="form-error" role="alert">{quantityError.message}</p>}

                {/* Live row total */}
                {totalPieces > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm dark:border-sky-900/70 dark:bg-sky-950/20">
                    <span className="font-bold text-gray-600 dark:text-slate-300">إجمالي البضاعة المرتجعة:</span>
                    <span className="text-base font-black text-blue-800 dark:text-sky-300">
                      {Math.floor(totalPieces / pShrink).toLocaleString('en-US')} شرنك
                      {totalPieces % pShrink > 0 && ` + ${(totalPieces % pShrink).toLocaleString('en-US')} قطعة`}
                      <span className="mr-1.5 text-xs font-medium text-gray-500 dark:text-slate-400">
                        ({totalPieces.toLocaleString('en-US')} قطعة)
                      </span>
                    </span>
                  </div>
                )}

                {/* Sorting Status Selector (4 options) */}
                <div className="pt-1">
                  <label className="form-label mb-2 block text-sm font-bold text-gray-700 dark:text-slate-300">
                    حالة الفرز والتصنيف:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      {
                        val: RETURN_CONDITIONS.PENDING,
                        label: '⏳ قيد الفحص (لاحقاً)',
                        activeCls: 'bg-amber-500 text-white border-amber-500',
                      },
                      {
                        val: RETURN_CONDITIONS.PARTIAL,
                        label: '✂️ فرز الآن (سليم + للشركة)',
                        activeCls: 'bg-blue-600 text-white border-blue-600',
                      },
                      {
                        val: RETURN_CONDITIONS.GOOD,
                        label: '✅ سليم بالكامل',
                        activeCls: 'bg-emerald-600 text-white border-emerald-600',
                      },
                      {
                        val: RETURN_CONDITIONS.COMPANY,
                        label: '↩️ للشركة بالكامل',
                        activeCls: 'bg-rose-600 text-white border-rose-600',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setValue(`items.${index}.condition`, opt.val)}
                        aria-pressed={item?.condition === opt.val}
                        className={`cursor-pointer rounded-xl border px-3 py-3 text-xs font-bold transition-all text-center ${
                          item?.condition === opt.val
                            ? opt.activeCls
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline Partial Split Inputs when condition === 'partial' */}
                {item?.condition === RETURN_CONDITIONS.PARTIAL && (
                  <div className="bg-blue-50/70 dark:bg-sky-950/30 border border-blue-200 dark:border-sky-800 rounded-xl p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-emerald-200 dark:border-emerald-800 space-y-2">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                          ✓ السليم الصالح للبيع (يُضاف للمتاح):
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-gray-500 block">شرنك سليم</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-label={`شرنكات سليمة، الصنف ${index + 1}`}
                              aria-invalid={!!splitError || partialInvalid}
                              {...register(`items.${index}.goodShrinks`)}
                              className={`form-input text-center font-bold text-sm py-1 ${splitError || partialInvalid ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block">قطع سليمة</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              aria-label={`قطع سليمة، الصنف ${index + 1}`}
                              aria-invalid={!!splitError || partialInvalid}
                              {...register(`items.${index}.goodLoosePieces`)}
                              className={`form-input text-center font-bold text-sm py-1 ${splitError || partialInvalid ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 rounded-xl p-2.5 border border-rose-200 dark:border-rose-800 flex flex-col justify-center">
                        <span className="text-xs font-bold text-rose-800 dark:text-rose-300 block mb-1">
                          ↩ الباقي (مرتجع هيرجع للشركة):
                        </span>
                        {partialInvalid ? (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400" role="alert">
                            يجب أن تكون الكمية السليمة أكبر من صفر وأقل من إجمالي المرتجع.
                          </span>
                        ) : (
                          <div>
                            <span className="text-base font-black text-rose-700 dark:text-rose-400">
                              {Math.floor(remainingCompanyPieces / pShrink).toLocaleString('en-US')} شرنك
                              {remainingCompanyPieces % pShrink > 0 &&
                                ` + ${(remainingCompanyPieces % pShrink).toLocaleString('en-US')} ق`}
                            </span>
                            <span className="block text-[11px] text-gray-400">
                              ({remainingCompanyPieces.toLocaleString('en-US')} قطعة)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {splitError && <p className="form-error" role="alert">{splitError.message}</p>}
                  </div>
                )}

                {/* Optional row notes */}
                <div>
                  <input
                    {...register(`items.${index}.notes`)}
                    className="form-input py-2.5 text-sm"
                    placeholder="ملاحظات توضيحية حول هذا الصنف (اختياري)..."
                  />
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
      {summaryTotals.totalPieces > 0 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-5 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
          <div>
            <span className="mb-1 block text-sm font-bold text-blue-800 dark:text-slate-400">
              إجمالي المرتجعات ({fields.length} بند)
            </span>
            <span className="text-3xl font-black text-blue-900 dark:text-sky-300">
              {summaryTotals.totalShrinks.toLocaleString('en-US')} شرنك
              {summaryTotals.totalLoose > 0 && ` + ${summaryTotals.totalLoose.toLocaleString('en-US')} ق`}
            </span>
            <span className="mr-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              ({summaryTotals.totalPieces.toLocaleString('en-US')} قطعة)
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {summaryTotals.totalGoodPieces > 0 && (
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-xl font-bold">
                ✓ {formatBreakdownText(summaryTotals.totalGoodPieces)} سليم (يعود للبيع)
              </span>
            )}
            {summaryTotals.totalCompanyPieces > 0 && (
              <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 px-3 py-1.5 rounded-xl font-bold">
                ↩ {formatBreakdownText(summaryTotals.totalCompanyPieces)} مرتجع للشركة
              </span>
            )}
            {summaryTotals.totalPendingPieces > 0 && (
              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-3 py-1.5 rounded-xl font-bold">
                ⏳ {formatBreakdownText(summaryTotals.totalPendingPieces)} قيد الفحص
              </span>
            )}
          </div>
        </div>
      )}

      {/* General Notes */}
      <div>
        <label className="form-label">ملاحظات عامة حول إذن الإرجاع</label>
        <textarea
          {...register('notes')}
          className="form-input"
          rows={2}
          placeholder="ملاحظات إضافية حول عملية الإرجاع..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={isSubmitting}>
          <CheckCircle size={16} /> {initialValues ? 'حفظ تعديل إذن المرتجع' : 'تأكيد وتسجيل إذن المرتجع'}
        </Button>
      </div>
    </form>
  );
}

// ─── Sorting / Approving Pending Return Modal ──────────────────
function SortReturnModal({ ret, products, onApprove, onClose }) {
  const prod =
    ret.productId === 'prod-mixed'
      ? MIXED_PRODUCT
      : products.find((p) => p.id === ret.productId) || MIXED_PRODUCT;
  const pShrink = ret.piecesPerShrink || prod?.piecesPerShrink || 24;
  const totalPieces = ret.quantityPieces || 0;

  const [goodShrinks, setGoodShrinks] = useState('0');
  const [goodLoose, setGoodLoose] = useState('0');
  const [goodTargetProductId, setGoodTargetProductId] = useState(ret.productId);
  const [sortNotes, setSortNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const gsNum = Math.max(0, Math.floor(Number(goodShrinks) || 0));
  const glNum = Math.max(0, Math.floor(Number(goodLoose) || 0));
  const goodPieces = gsNum * pShrink + glNum;
  const companyPieces = totalPieces - goodPieces;
  const isOver = goodPieces > totalPieces;

  const activeRealProducts = products.filter((p) => p.isActive && p.id !== 'prod-mixed');

  const handleConfirm = async () => {
    if (isOver) {
      toast.error('الكمية السليمة لا يمكن أن تتجاوز إجمالي المرتجع');
      return;
    }
    setSaving(true);
    const res = await onApprove(ret.id, {
      goodPieces,
      companyPieces,
      goodTargetProductId,
      notes: sortNotes,
    });
    setSaving(false);
    if (res.success) {
      toast.success('✅ تم فرز المرتجع وتحديث رصيد البيع ومرتجعات الشركة بنجاح');
      onClose();
    } else {
      toast.error(res.message || 'حدث خطأ أثناء الفرز');
    }
  };

  return (
    <div className="space-y-4 font-cairo">
      {/* Header info */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-3.5 text-sm space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 text-xs">إجمالي الكمية قيد الفرز ({prod.name}):</span>
          <span className="font-mono font-bold text-blue-600 dark:text-sky-400">
            #{ret.referenceNumber}
          </span>
        </div>
        <p className="text-lg font-black text-gray-900 dark:text-white">
          {Math.floor(totalPieces / pShrink).toLocaleString('en-US')} شرنك
          {totalPieces % pShrink > 0 && ` + ${(totalPieces % pShrink).toLocaleString('en-US')} قطعة`}
          <span className="text-xs font-normal text-gray-500 mr-2">
            (إجمالي: {totalPieces.toLocaleString('en-US')} قطعة)
          </span>
        </p>
      </div>

      {/* Quick Presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-semibold">اختصار سريع:</span>
        <button
          type="button"
          onClick={() => {
            setGoodShrinks(String(Math.floor(totalPieces / pShrink)));
            setGoodLoose(String(totalPieces % pShrink));
          }}
          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
        >
          الكل سليم ({totalPieces.toLocaleString('en-US')} ق)
        </button>
        <button
          type="button"
          onClick={() => {
            setGoodShrinks('0');
            setGoodLoose('0');
          }}
          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
        >
          الكل مرتجع للشركة ({totalPieces.toLocaleString('en-US')} ق)
        </button>
      </div>

      {/* Good Sellable Section */}
      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-3">
        <p className="font-bold text-sm text-emerald-900 dark:text-emerald-300">
          1. ما تم فرزه كـ "سليم صالح للبيع" (يُضاف فوراً لرصيد البيع):
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label text-xs font-bold">شرنكات سليمة</label>
            <input
              type="number"
              min="0"
              step="1"
              value={goodShrinks}
              onChange={(e) => setGoodShrinks(e.target.value)}
              className="form-input text-center font-black text-lg bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="form-label text-xs font-bold">قطع سليمة (فرط)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={goodLoose}
              onChange={(e) => setGoodLoose(e.target.value)}
              className="form-input text-center font-black text-lg bg-white dark:bg-slate-900"
            />
          </div>
        </div>
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
          إجمالي السليم الصالح: {goodPieces.toLocaleString('en-US')} قطعة ({formatBreakdownText(goodPieces, pShrink)})
        </p>

        {ret.productId === 'prod-mixed' && goodPieces > 0 && activeRealProducts.length > 0 && (
          <div>
            <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block mb-1">
              إضافة القطع السليمة إلى رصيد صنف:
            </label>
            <select
              value={goodTargetProductId}
              onChange={(e) => setGoodTargetProductId(e.target.value)}
              className="form-input text-xs"
            >
              <option value="prod-mixed">📦 شرنك مشكّل (عام)</option>
              {activeRealProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Company Return Remainder Section */}
      <div
        className={`rounded-2xl p-4 border ${
          isOver
            ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-400 text-rose-900'
            : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
        }`}
      >
        <p className="font-bold text-sm text-rose-900 dark:text-rose-300 mb-1">
          2. الباقي: مرتجع هيرجع للشركة (يُحفظ في رصيد مرتجعات الشركة):
        </p>
        {isOver ? (
          <p className="text-xs font-bold text-rose-700">
            ⚠️ الكمية السليمة ({goodPieces.toLocaleString('en-US')} ق) أكبر من إجمالي المرتجع ({totalPieces.toLocaleString('en-US')} ق)!
          </p>
        ) : (
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <span className="text-xl font-black text-rose-700 dark:text-rose-400">
              {Math.floor(companyPieces / pShrink).toLocaleString('en-US')} شرنك
              {companyPieces % pShrink > 0 &&
                ` + ${(companyPieces % pShrink).toLocaleString('en-US')} قطعة`}
            </span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              ({companyPieces.toLocaleString('en-US')} قطعة)
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="form-label text-xs">ملاحظات الفرز (اختياري)</label>
        <input
          value={sortNotes}
          onChange={(e) => setSortNotes(e.target.value)}
          className="form-input text-xs"
          placeholder="مثال: تم فرز الشرنكين، علب منتهية أو تالفة..."
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={handleConfirm} disabled={isOver} loading={saving}>
          <Scissors size={15} /> اعتماد الفرز وحفظ النتيجة
        </Button>
      </div>
    </div>
  );
}

// ─── Dispatch Company Returns Modal ────────────────────────────
function DispatchCompanyModal({ products, stockTransactions, initialValues, onDispatch, onClose }) {
  const productsWithCompanyReturns = useMemo(() => {
    return products
      .map((p) => ({
        ...p,
        companyPieces: calculateCompanyReturnsStock(p.id, stockTransactions),
      }))
      .filter((p) => p.companyPieces > 0 || p.id === initialValues?.productId);
  }, [products, stockTransactions, initialValues]);

  const [selectedProductId, setSelectedProductId] = useState(
    initialValues?.productId || productsWithCompanyReturns[0]?.id || ''
  );
  const initialProduct = products.find((p) => p.id === initialValues?.productId);
  const initialPShrink = initialValues?.piecesPerShrink || initialProduct?.piecesPerShrink || 24;
  const [shrinks, setShrinks] = useState(initialValues ? String(Math.floor(initialValues.quantityPieces / initialPShrink)) : '0');
  const [loosePieces, setLoosePieces] = useState(initialValues ? String(initialValues.quantityPieces % initialPShrink) : '0');
  const [date, setDate] = useState(initialValues?.date || todayISO());
  const [refNo, setRefNo] = useState(initialValues?.referenceNumber || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [saving, setSaving] = useState(false);

  const selectedProduct = productsWithCompanyReturns.find((p) => p.id === selectedProductId);
  const pShrink = selectedProduct?.piecesPerShrink || 24;
  const maxPieces = (selectedProduct?.companyPieces || 0) +
    (initialValues?.productId === selectedProductId ? initialValues.quantityPieces : 0);
  const requestedPieces =
    Math.max(0, Math.floor(Number(shrinks) || 0)) * pShrink +
    Math.max(0, Math.floor(Number(loosePieces) || 0));

  const fillAll = () => {
    if (!selectedProduct) return;
    setShrinks(String(Math.floor(maxPieces / pShrink)));
    setLoosePieces(String(maxPieces % pShrink));
  };

  const handleConfirm = async () => {
    if (!selectedProductId) return;
    if (requestedPieces <= 0) {
      toast.error('يرجى تحديد كمية أكبر من صفر');
      return;
    }
    if (requestedPieces > maxPieces) {
      toast.error('الكمية المطلوبة أكبر من رصيد مرتجعات الشركة المتاح');
      return;
    }
    setSaving(true);
    const res = await onDispatch({
      date,
      productId: selectedProductId,
      quantityPieces: requestedPieces,
      referenceNumber: refNo,
      notes,
      transactionId: initialValues?.id,
    });
    setSaving(false);
    if (res.success) {
      toast.success(initialValues ? `تم حفظ تعديل التسليم #${res.referenceNumber}` : `✅ تم تسليم مرتجعات للشركة #${res.referenceNumber}`);
      onClose();
    } else {
      toast.error(res.message || 'حدث خطأ');
    }
  };

  if (productsWithCompanyReturns.length === 0) {
    return (
      <div className="text-center py-8 space-y-3 font-cairo">
        <p className="text-sm font-bold text-gray-700 dark:text-slate-300">
          لا توجد حالياً أي مرتجعات منتظرة للتسليم للشركة.
        </p>
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-cairo">
      <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
        عند تسليم البضاعة التالفة/المرتجعة لمندوب الشركة أو سيارة الشركة، سجل الكمية المسلمة هنا ليتم خصمها من رصيد <strong>مرتجعات الشركة</strong> بالمخزن.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="form-label text-xs font-bold">التاريخ *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" />
        </div>
        <div>
          <label className="form-label text-xs font-bold">رقم إذن التسليم (اختياري)</label>
          <input
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            className="form-input font-mono"
            placeholder="تلقائي..."
          />
        </div>
      </div>

      <div>
        <label className="form-label text-xs font-bold">الصنف *</label>
        <select
          value={selectedProductId}
          onChange={(e) => {
            const nextId = e.target.value;
            const nextProduct = productsWithCompanyReturns.find((p) => p.id === nextId);
            const nextPShrink = nextProduct?.piecesPerShrink || 24;
            setSelectedProductId(nextId);
            setShrinks(initialValues?.productId === nextId ? String(Math.floor((initialValues?.quantityPieces || 0) / nextPShrink)) : '0');
            setLoosePieces(initialValues?.productId === nextId ? String((initialValues?.quantityPieces || 0) % nextPShrink) : '0');
          }}
          className="form-input font-medium"
        >
          {productsWithCompanyReturns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — المتاح للشركة: {formatBreakdownText(p.companyPieces, p.piecesPerShrink, p.shrinksPerPallet)} ({p.companyPieces.toLocaleString('en-US')} ق)
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-3.5 border border-gray-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              الرصيد المتاح للتسليم: {formatBreakdownText(maxPieces, pShrink, selectedProduct.shrinksPerPallet)} ({maxPieces.toLocaleString('en-US')} ق)
            </span>
            <button
              type="button"
              onClick={fillAll}
              className="text-xs font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              تعبئة كامل الرصيد
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs font-bold">عدد الشرنكات</label>
              <input
                type="number"
                min="0"
                step="1"
                value={shrinks}
                onChange={(e) => setShrinks(e.target.value)}
                className="form-input text-center font-black text-base"
              />
            </div>
            <div>
              <label className="form-label text-xs font-bold">قطع فرط</label>
              <input
                type="number"
                min="0"
                step="1"
                value={loosePieces}
                onChange={(e) => setLoosePieces(e.target.value)}
                className="form-input text-center font-black text-base"
              />
            </div>
          </div>

          <p className="text-xs font-bold text-blue-700 dark:text-sky-400">
            سيتم تسليم: {requestedPieces.toLocaleString('en-US')} قطعة ({formatBreakdownText(requestedPieces, pShrink)})
          </p>
        </div>
      )}

      <div>
        <label className="form-label text-xs">ملاحظات</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="form-input text-xs"
          placeholder="اسم السائق أو رقم سيارة الشركة..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button onClick={handleConfirm} loading={saving}>
          <Truck size={15} /> تأكيد التسليم للشركة
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ReturnsPage() {
  const {
    products,
    salesmen,
    stockTransactions,
    returnTransactions,
    recordReturn,
    approvePendingReturn,
    dispatchCompanyReturns,
  } = useInventoryStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState(null);
  const [sortReturn, setSortReturn] = useState(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterCondition, setFilterCondition] = useState('all');

  const getProductObj = (id) =>
    id === 'prod-mixed'
      ? MIXED_PRODUCT
      : products.find((p) => p.id === id) || MIXED_PRODUCT;

  // Live Stats across all returns + current Company Returns bucket
  const stats = useMemo(() => {
    let pendingPieces = 0;
    let pendingCount = 0;
    let totalGoodPieces = 0;
    let totalReturnedPieces = 0;

    returnTransactions.forEach((r) => {
      const qty = r.quantityPieces || 0;
      totalReturnedPieces += qty;

      if (r.condition === RETURN_CONDITIONS.PENDING) {
        pendingPieces += qty;
        pendingCount += 1;
      } else if (r.condition === RETURN_CONDITIONS.GOOD) {
        totalGoodPieces += qty;
      } else if (r.condition === RETURN_CONDITIONS.PARTIAL) {
        totalGoodPieces += r.goodPieces || 0;
      }
    });

    // Live remaining company returns in warehouse (returned to company - already dispatched)
    let companyRemainingPieces = 0;
    let companyFullPallets = 0;
    let companyRemainingShrinks = 0;
    let companyLoosePieces = 0;

    products.forEach((p) => {
      const pieces = calculateCompanyReturnsStock(p.id, stockTransactions);
      if (pieces > 0) {
        companyRemainingPieces += pieces;
        const b = breakdownStockQuantity(pieces, p.piecesPerShrink || 24, p.shrinksPerPallet || 169);
        companyFullPallets += b.fullPallets;
        companyRemainingShrinks += b.totalShrinks;
        companyLoosePieces += b.loosePieces;
      }
    });

    const normalizedCompanyExtraShrinks = Math.floor(companyLoosePieces / 24);
    const totalCompanyShrinks = companyRemainingShrinks + normalizedCompanyExtraShrinks;
    const totalCompanyLoose = companyLoosePieces % 24;

    return {
      pendingPieces,
      pendingShrinks: Math.floor(pendingPieces / 24),
      pendingLoose: pendingPieces % 24,
      pendingCount,
      totalGoodPieces,
      totalGoodShrinks: Math.floor(totalGoodPieces / 24),
      totalGoodLoose: totalGoodPieces % 24,
      companyRemainingPieces,
      companyFullPallets,
      totalCompanyShrinks,
      totalCompanyLoose,
      totalReturnedPieces,
      totalReturnedShrinks: Math.floor(totalReturnedPieces / 24),
    };
  }, [returnTransactions, products, stockTransactions]);

  const filtered = useMemo(() => {
    return returnTransactions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .filter((r) => {
        const p = getProductObj(r.productId);
        const s = salesmen.find((sm) => sm.id === r.salesmanId);

        const matchSearch =
          !search ||
          r.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          p?.name.toLowerCase().includes(search.toLowerCase()) ||
          s?.name.toLowerCase().includes(search.toLowerCase()) ||
          r.notes?.toLowerCase().includes(search.toLowerCase());

        const matchSalesman = !filterSalesman || r.salesmanId === filterSalesman;
        const matchCondition =
          filterCondition === 'all' || r.condition === filterCondition;

        return matchSearch && matchSalesman && matchCondition;
      });
  }, [returnTransactions, products, salesmen, search, filterSalesman, filterCondition]);

  const companyDispatches = useMemo(
    () => stockTransactions
      .filter((tx) => tx.type === TRANSACTION_TYPES.COMPANY_RETURN_DISPATCH)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [stockTransactions]
  );

  const handleSubmit = async (data) => {
    const result = await recordReturn({
      ...data,
      editReferenceNumber: editingReturn?.referenceNumber,
    });
    if (result.success) {
      toast.success(`✅ تم تسجيل إذن المرتجع #${result.referenceNumber} بنجاح`);
      setModalOpen(false);
      setEditingReturn(null);
    } else {
      toast.error(result.message || 'حدث خطأ أثناء تسجيل المرتجع');
    }
  };

  const handleEditReturn = (row) => {
    const group = returnTransactions.filter((item) => item.referenceNumber === row.referenceNumber);
    const first = group[0];
    setEditingReturn({
      referenceNumber: row.referenceNumber,
      date: first.date || todayISO(),
      salesmanId: first.salesmanId,
      isExchange: Boolean(first.isExchange),
      notes: '',
      items: group.map((item) => {
        const product = getProductObj(item.productId);
        const pShrink = item.piecesPerShrink || product?.piecesPerShrink || 24;
        const qty = item.quantityPieces || 0;
        const good = item.goodPieces || (item.condition === RETURN_CONDITIONS.GOOD ? qty : 0);
        return {
          isMixed: item.productId === 'prod-mixed',
          productId: item.productId,
          replacementProductId: item.replacementProductId || '',
          shrinks: Math.floor(qty / pShrink),
          loosePieces: qty % pShrink,
          condition: item.condition || RETURN_CONDITIONS.PENDING,
          goodShrinks: Math.floor(good / pShrink),
          goodLoosePieces: good % pShrink,
          notes: item.notes || '',
        };
      }),
    });
    setModalOpen(true);
  };

  const conditionVariant = {
    good: 'success',
    damaged: 'danger',
    partial: 'info',
    pending: 'warning',
  };

  const columns = [
    {
      key: 'referenceNumber',
      title: 'رقم المرتجع',
      render: (val) => (
        <span className="font-mono text-blue-600 dark:text-sky-400 font-bold">
          #{val}
        </span>
      ),
    },
    { key: 'date', title: 'التاريخ', render: (val) => formatDate(val) },
    {
      key: 'salesmanId',
      title: 'المندوب',
      render: (val) => salesmen.find((s) => s.id === val)?.name || '—',
    },
    {
      key: 'productId',
      title: 'المنتج',
      render: (val) => {
        if (val === 'prod-mixed') {
          return (
            <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <span>📦</span> شرنك مشكّل (بدون صنف)
            </span>
          );
        }
        return (
          <span className="font-bold text-gray-900 dark:text-slate-100">
            {products.find((p) => p.id === val)?.name || '—'}
          </span>
        );
      },
    },
    {
      key: 'quantityPieces',
      title: 'الكمية المرتجعة',
      render: (val, row) => {
        const prod = getProductObj(row.productId);
        const pShrink = row.piecesPerShrink || prod?.piecesPerShrink || 24;
        const shrinks = Math.floor(val / pShrink);
        const loose = val % pShrink;

        return (
          <div>
            <span className="font-bold text-sm text-gray-900 dark:text-slate-100">
              {shrinks.toLocaleString('en-US')} شرنك
              {loose > 0 && (
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 mr-1">
                  +{loose.toLocaleString('en-US')} ق
                </span>
              )}
            </span>
            <span className="block text-[11px] text-gray-400">
              ({val.toLocaleString('en-US')} قطعة)
              {row.isExchange && ' · استبدل بسليم'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'sortingDetails',
      title: 'نتيجة الفرز (سليم / للشركة)',
      render: (_, row) => {
        const prod = getProductObj(row.productId);
        const pShrink = row.piecesPerShrink || prod?.piecesPerShrink || 24;

        if (row.condition === RETURN_CONDITIONS.PENDING) {
          return (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              في انتظار الفرز...
            </span>
          );
        }

        const goodPcs =
          row.goodPieces !== undefined
            ? row.goodPieces
            : row.condition === RETURN_CONDITIONS.GOOD
            ? row.quantityPieces
            : 0;
        const companyPcs =
          row.companyPieces !== undefined
            ? row.companyPieces
            : row.condition === RETURN_CONDITIONS.COMPANY
            ? row.quantityPieces
            : 0;

        return (
          <div className="space-y-1 text-xs">
            {goodPcs > 0 && (
              <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                ✓ سليم: {formatBreakdownText(goodPcs, pShrink)} ({goodPcs.toLocaleString('en-US')} ق)
              </div>
            )}
            {companyPcs > 0 && (
              <div className="text-rose-700 dark:text-rose-400 font-bold">
                ↩ للشركة: {formatBreakdownText(companyPcs, pShrink)} ({companyPcs.toLocaleString('en-US')} ق)
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'condition',
      title: 'الحالة',
      render: (val) => (
        <StatusBadge variant={conditionVariant[val] || 'muted'}>
          {RETURN_CONDITION_LABELS[val] || val}
        </StatusBadge>
      ),
    },
    {
      key: 'notes',
      title: 'ملاحظات',
      render: (val) => (
        <span className="text-xs text-gray-500 max-w-xs truncate block">
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'id',
      title: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleEditReturn(row)}
            className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
            title="تعديل إذن المرتجع"
          ><Pencil size={15} /></button>
          {row.condition === RETURN_CONDITIONS.PENDING && (
            <button
              onClick={() => setSortReturn(row)}
              className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl hover:bg-amber-200 cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <Scissors size={13} /> فرز واعتماد
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="المرتجعات والفرز"
        subtitle="تسجيل استبدال المرتجعات، فرز السليم الصالح للبيع، ومتابعة مرتجعات الشركة"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {stats.companyRemainingPieces > 0 && (
              <Button
                variant="secondary"
                onClick={() => { setEditingDispatch(null); setDispatchModalOpen(true); }}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
              >
                <Truck size={16} /> تسليم مرتجعات للشركة
              </Button>
            )}
            <Button onClick={() => { setEditingReturn(null); setModalOpen(true); }}>
              <Plus size={16} /> تسجيل مرتجع
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className={`card py-4 text-center ${
            stats.pendingPieces > 0
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : ''
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-amber-700 dark:text-amber-400 mb-1">
            <Clock size={16} />
            <span className="text-xs font-bold">مرتجعات قيد الفرز</span>
          </div>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-300">
            {stats.pendingShrinks.toLocaleString('en-US')} شرنك
            {stats.pendingLoose > 0 && ` + ${stats.pendingLoose} ق`}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {stats.pendingCount > 0
              ? `${stats.pendingCount.toLocaleString('en-US')} عملية (${stats.pendingPieces.toLocaleString('en-US')} ق)`
              : 'لا توجد مرتجعات تنتظر الفرز'}
          </p>
        </div>

        <div className="card py-4 text-center bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
            ✓ السليم المفروز (عاد للبيع)
          </p>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-300">
            {stats.totalGoodShrinks.toLocaleString('en-US')} شرنك
            {stats.totalGoodLoose > 0 && ` + ${stats.totalGoodLoose} ق`}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            ({stats.totalGoodPieces.toLocaleString('en-US')} قطعة)
          </p>
        </div>

        <div className="card py-4 text-center bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">
            ↩ مرتجع هيرجع للشركة (بالمخزن)
          </p>
          <p className="text-2xl font-black text-rose-800 dark:text-rose-300">
            {stats.totalCompanyShrinks.toLocaleString('en-US')} شرنك
            {stats.totalCompanyLoose > 0 && ` + ${stats.totalCompanyLoose} ق`}
          </p>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
            {stats.companyFullPallets > 0 ? `${stats.companyFullPallets} بالتة · ` : ''}
            ({stats.companyRemainingPieces.toLocaleString('en-US')} قطعة متبقية للشركة)
          </p>
        </div>

        <div className="card py-4 text-center">
          <p className="text-xs text-gray-500 font-semibold mb-1">إجمالي المرتجعات المسجلة</p>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200">
            {stats.totalReturnedShrinks.toLocaleString('en-US')} شرنك
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {returnTransactions.length.toLocaleString('en-US')} عملية ({stats.totalReturnedPieces.toLocaleString('en-US')} قطعة)
          </p>
        </div>
      </div>

      {/* Alert for Pending Returns */}
      {stats.pendingCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-amber-900 dark:text-amber-300">
                ⏳ يوجد {stats.pendingShrinks.toLocaleString('en-US')} شرنك
                {stats.pendingLoose > 0 ? ` + ${stats.pendingLoose} قطعة` : ''} ({stats.pendingCount} عملية) مرتجعات "قيد الفحص / الفرز"
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                اضغط على زر "فرز واعتماد" في الجدول لتحديد عدد القطع السليمة الصالحة للبيع والباقي كمرتجع للشركة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="بحث برقم المرتجع، الصنف، المندوب..."
            />
          </div>
          <div className="sm:w-52">
            <select
              value={filterSalesman}
              onChange={(e) => setFilterSalesman(e.target.value)}
              className="form-input"
            >
              <option value="">كل المندوبين</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ['all', 'الكل'],
              ['pending', 'قيد الفرز'],
              ['partial', 'مفروز جزئياً'],
              ['good', 'سليم بالكامل'],
              ['damaged', 'للشركة بالكامل'],
            ].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilterCondition(val)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  filterCondition === val
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle="لا توجد مرتجعات مسجلة"
          emptyIcon={RotateCcw}
        />
      </div>

      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
          <h3 className="font-bold text-gray-800 dark:text-slate-100">تسليمات مرتجعات الشركة</h3>
          <p className="text-xs text-gray-500 mt-1">يمكن تعديل إذن التسليم لتصحيح الصنف أو الكمية أو التاريخ.</p>
        </div>
        {companyDispatches.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">لا توجد أذون تسليم للشركة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>رقم الإذن</th><th>التاريخ</th><th>الصنف</th><th>الكمية</th><th>ملاحظات</th><th></th></tr></thead>
              <tbody>
                {companyDispatches.map((tx) => {
                  const product = getProductObj(tx.productId);
                  const pShrink = product?.piecesPerShrink || 24;
                  return (
                    <tr key={tx.id}>
                      <td className="font-mono font-bold">#{tx.referenceNumber}</td>
                      <td>{formatDate(tx.date)}</td>
                      <td>{product?.name || tx.productId}</td>
                      <td>{Math.floor(tx.quantityPieces / pShrink)} ش + {tx.quantityPieces % pShrink} ق ({tx.quantityPieces} قطعة)</td>
                      <td>{tx.notes || '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => { setEditingDispatch(tx); setDispatchModalOpen(true); }}
                          className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
                          title="تعديل إذن التسليم"
                        ><Pencil size={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Multi-item Return Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingReturn(null); }}
        title={editingReturn ? `تعديل إذن المرتجع #${editingReturn.referenceNumber}` : 'تسجيل إذن مرتجع بضاعة'}
        size="xl"
      >
        <ReturnForm
          key={editingReturn?.referenceNumber || 'new-return'}
          products={products}
          salesmen={salesmen}
          initialValues={editingReturn}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
        />
      </Modal>

      {/* Sort / Approve Pending Return Modal */}
      {sortReturn && (
        <Modal
          isOpen={!!sortReturn}
          onClose={() => setSortReturn(null)}
          title="فرز واعتماد المرتجع (تحديد السليم ومرتجع الشركة)"
          size="md"
        >
          <SortReturnModal
            ret={sortReturn}
            products={products}
            onApprove={approvePendingReturn}
            onClose={() => setSortReturn(null)}
          />
        </Modal>
      )}

      {/* Dispatch Company Returns Modal */}
      {dispatchModalOpen && (
        <Modal
          isOpen={dispatchModalOpen}
          onClose={() => { setDispatchModalOpen(false); setEditingDispatch(null); }}
          title={editingDispatch ? `تعديل إذن التسليم #${editingDispatch.referenceNumber}` : 'تسليم مرتجعات للشركة'}
          size="md"
        >
          <DispatchCompanyModal
            products={products}
            stockTransactions={stockTransactions}
            initialValues={editingDispatch ? {
              ...editingDispatch,
              date: editingDispatch.date?.slice(0, 10) || todayISO(),
            } : null}
            onDispatch={dispatchCompanyReturns}
            onClose={() => { setDispatchModalOpen(false); setEditingDispatch(null); }}
          />
        </Modal>
      )}
    </div>
  );
}
