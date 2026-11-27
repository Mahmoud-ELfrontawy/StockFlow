// ============================================================
// STOCKFLOW — STOCK IN PAGE
// Register incoming products from suppliers with Pallets-First workflow.
// ============================================================

import { useState, useMemo } from 'react';
import { Plus, Trash2, PackagePlus, CheckCircle, Layers, Pencil } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import SearchInput from '../../components/common/SearchInput';
import { formatDate } from '../../utils/formatters';
import { TRANSACTION_TYPES } from '../../utils/constants';
import { todayISO } from '../../utils/formatters';

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  referenceNumber: z.string().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().min(1, 'اختر الصنف المستلم'),
    pallets: z.coerce.number().int('عدد البالتات يجب أن يكون رقمًا صحيحًا').min(1, 'أدخل بالتة كاملة واحدة على الأقل'),
  })).min(1, 'أضف صنفاً واحداً على الأقل'),
});

function StockInForm({ products, initialValues, onSubmit, onClose }) {
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues || {
      date: todayISO(),
      items: [{ productId: '', pallets: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const getProduct = (id) => products.find((p) => p.id === id);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 font-cairo">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">تاريخ الاستلام *</label>
          <input type="date" {...register('date')} className="form-input" />
          {errors.date && <p className="form-error">{errors.date.message}</p>}
        </div>
        <div>
          <label className="form-label">رقم إذن الاستلام / الفاتورة</label>
          <input {...register('referenceNumber')} className="form-input" placeholder="مثال: SI-001 (يُنشأ تلقائياً إن تُرِك فارغاً)" />
        </div>
        <div>
          <label className="form-label">المورد / المصنع</label>
          <input {...register('supplier')} className="form-input" placeholder="اسم الشركة الموردة أو المصنع" />
        </div>
        <div>
          <label className="form-label">ملاحظات / رقم السيارة</label>
          <input {...register('notes')} className="form-input" placeholder="رقم الشاحنة أو اسم السائق وملاحظات..." />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            الأصناف والكميات المستلمة
          </h4>
          <button
            type="button"
            onClick={() => append({ productId: '', pallets: '' })}
            className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={15} /> إضافة صنف آخر
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const item = watchedItems?.[index];
            const product = getProduct(item?.productId);
            const shrinksPerPallet = product?.shrinksPerPallet || 169;
            const piecesPerShrink = product?.piecesPerShrink || 24;

            const pCount = Math.max(0, Math.floor(Number(item?.pallets) || 0));
            const totalShrinks = pCount * shrinksPerPallet;
            const totalPieces = totalShrinks * piecesPerShrink;

            return (
              <div key={field.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs font-black text-blue-700 dark:bg-sky-950/60 dark:text-sky-300">{index + 1}</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-slate-200">بيانات الصنف</span>
                  </div>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="btn-icon text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title="حذف هذا الصنف">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  {/* 1. Product select */}
                  <div className="sm:col-span-8">
                    <label className="form-label text-xs font-bold text-gray-700 dark:text-gray-300">
                      الصنف المستلم *
                    </label>
                    <select
                      {...register(`items.${index}.productId`)}
                      className="form-input font-medium"
                    >
                      <option value="">-- اختر الصنف المستلم --</option>
                      {products.filter((p) => p.isActive || initialValues?.items?.some((item) => item.productId === p.id)).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.shrinksPerPallet || 169} شرنك/بالتة · {p.piecesPerShrink} ق/شرنك)
                        </option>
                      ))}
                    </select>
                    {errors.items?.[index]?.productId && (
                      <p className="form-error">{errors.items[index].productId.message}</p>
                    )}
                  </div>

                  {/* 2. Pallets input (The only required manual number!) */}
                  <div className="sm:col-span-4">
                    <label className="form-label text-xs font-bold text-blue-700 dark:text-sky-400">
                      بالتات كاملة
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      inputMode="numeric"
                      aria-label={`عدد البالتات الكاملة للصنف ${index + 1}`}
                      aria-invalid={!!errors.items?.[index]?.pallets}
                      {...register(`items.${index}.pallets`)}
                      className={`form-input text-center text-lg font-black text-blue-900 dark:text-sky-300 bg-blue-50/60 dark:bg-sky-950/40 ${errors.items?.[index]?.pallets ? 'border-rose-500 focus:border-rose-500' : 'border-blue-300 dark:border-sky-800'} focus:ring-blue-500`}
                      placeholder="0"
                    />
                    {errors.items?.[index]?.pallets && (
                      <p className="form-error">{errors.items[index].pallets.message}</p>
                    )}
                  </div>
                  <div className="sm:col-span-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="form-label text-xs font-bold text-slate-600 dark:text-slate-300">إجمالي الشرنكات (تلقائي)</label>
                      <div className="form-input flex select-none items-center justify-center border-slate-200 bg-slate-50 text-center font-black text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {totalShrinks > 0 ? <span>{totalShrinks.toLocaleString('en-US')} شرنك</span> : <span className="text-gray-400">—</span>}
                      </div>
                    </div>
                    <div>
                      <label className="form-label text-xs font-bold text-emerald-700 dark:text-emerald-400">إجمالي القطع (تلقائي)</label>
                      <div className="form-input flex select-none items-center justify-center border-emerald-200 bg-emerald-50 text-center font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {totalPieces > 0 ? <span>{totalPieces.toLocaleString('en-US')} قطعة</span> : <span className="text-gray-400">—</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculation breakdown summary */}
                {product && totalPieces > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/80">
                    <span className="font-bold text-blue-700 dark:text-sky-300">
                      {pCount.toLocaleString('en-US')} بالتة كاملة × {shrinksPerPallet.toLocaleString('en-US')} شرنك
                    </span>
                    <span className="text-gray-400">←</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{totalShrinks.toLocaleString('en-US')} شرنك</span>
                    <span className="text-gray-400">←</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-400">{totalPieces.toLocaleString('en-US')} قطعة</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {errors.items?.message && (
          <p className="form-error mt-2">{errors.items.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
        <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>
          <CheckCircle size={16} /> {initialValues ? 'حفظ تعديل إذن الاستلام' : 'تسجيل وحفظ إذن الاستلام'}
        </Button>
      </div>
    </form>
  );
}

export default function StockInPage() {
  const { products, stockTransactions, receiveStock } = useInventoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [search, setSearch] = useState('');

  // Get stock-in transactions grouped by referenceNumber
  const stockInRecords = useMemo(() => {
    const groups = {};
    stockTransactions
      .filter((tx) => tx.type === TRANSACTION_TYPES.STOCK_IN)
      .forEach((tx) => {
        const ref = tx.referenceNumber;
        if (!groups[ref]) {
          groups[ref] = {
            id: ref,
            referenceNumber: ref,
            date: tx.date || tx.createdAt,
            createdAt: tx.createdAt,
            supplier: tx.supplier || '—',
            notes: tx.notes || '',
            items: [],
            rawItems: [],
            totalPieces: 0,
          };
        }
        const product = products.find((p) => p.id === tx.productId);
        const pPerShrink = product?.piecesPerShrink || 24;
        const sPerPallet = product?.shrinksPerPallet || 169;
        const totalShrinks = Math.floor(tx.quantityPieces / pPerShrink);
        const palletsCount = Math.floor(totalShrinks / sPerPallet);
        const extraShrinks = totalShrinks % sPerPallet;
        const extraPieces = tx.quantityPieces % pPerShrink;

        groups[ref].items.push({
          productId: tx.productId,
          product: product?.name || tx.productId,
          qty: tx.quantityPieces,
          shrinks: totalShrinks,
          pallets: palletsCount,
          extraShrinks,
          extraPieces,
        });
        groups[ref].rawItems.push({
          productId: tx.productId,
          pallets: palletsCount,
        });
        groups[ref].totalPieces += tx.quantityPieces;
      });
    return Object.values(groups)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [stockTransactions, products]);

  const filtered = useMemo(() => {
    if (!search) return stockInRecords;
    return stockInRecords.filter(
      (r) =>
        r.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.supplier.toLowerCase().includes(search.toLowerCase())
    );
  }, [stockInRecords, search]);

  const handleSubmit = async (data) => {
    const items = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const shrinksPerPallet = product?.shrinksPerPallet || 169;
      const piecesPerShrink = product?.piecesPerShrink || 24;

      const pCount = Math.max(1, Math.floor(Number(item.pallets) || 0));
      const totalShrinks = pCount * shrinksPerPallet;
      const quantityPieces = totalShrinks * piecesPerShrink;

      return {
        productId: item.productId,
        quantityPieces,
        quantityShrinks: totalShrinks,
        pallets: pCount,
        piecesPerShrink,
        shrinksPerPallet,
      };
    });

    const result = await receiveStock({
      date: data.date,
      referenceNumber: data.referenceNumber,
      supplier: data.supplier,
      notes: data.notes,
      items,
      editReferenceNumber: editingReceipt?.referenceNumber,
    });

    if (result.success) {
      toast.success(`تم تسجيل إذن الاستلام #${result.referenceNumber} بنجاح`);
      setModalOpen(false);
      setEditingReceipt(null);
    } else {
      toast.error(result.message);
    }
  };

  const columns = [
    {
      key: 'referenceNumber',
      title: 'رقم الإيصال',
      render: (val) => <span className="font-mono font-bold text-blue-600">#{val}</span>
    },
    { key: 'date', title: 'تاريخ الاستلام', render: (val) => formatDate(val) },
    { key: 'supplier', title: 'المورد / المصنع' },
    {
      key: 'items',
      title: 'الأصناف المستلمة',
      render: (val) => (
        <div className="space-y-2">
          {val.slice(0, 3).map((item, i) => (
            <div key={i} className="flex min-w-60 items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-l from-blue-50 to-white px-3 py-2.5 dark:border-sky-900/70 dark:from-sky-950/40 dark:to-slate-900/60">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-slate-100">{item.product}</p>
                <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-slate-400">{item.shrinks.toLocaleString('en-US')} شرنك</p>
              </div>
              <span className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-base font-black text-white shadow-sm">
                {item.pallets.toLocaleString('en-US')} بالتة
              </span>
            </div>
          ))}
          {val.length > 3 && <p className="text-xs text-gray-400">+{val.length - 3} أصناف أخرى</p>}
        </div>
      )
    },
    {
      key: 'totalPieces',
      title: 'إجمالي القطع',
      render: (val) => (
        <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
          {val.toLocaleString('en-US')} ق
        </span>
      )
    },
    { key: 'notes', title: 'ملاحظات', render: (val) => val || '—' },
    {
      key: 'actions',
      title: '',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => { setEditingReceipt(row); setModalOpen(true); }}
          className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
          title="تعديل إذن الاستلام"
        ><Pencil size={15} /></button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="استلام البضاعة (الوارد)"
        subtitle={`تسجيل توريدات المصنع بالبالتات الكاملة والزيادات المفردة · ${stockInRecords.length} إذن مسجل`}
        actions={
          <Button onClick={() => { setEditingReceipt(null); setModalOpen(true); }}>
            <Plus size={16} /> تسجيل إذن استلام بالبالتات
          </Button>
        }
      />

      <div className="card p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث برقم الإذن أو المورد..." />
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle="لا توجد أذون استلام"
          emptyDescription="سجل أول شحنة بضاعة مستلمة من المصنع"
          emptyIcon={PackagePlus}
        />
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingReceipt(null); }}
        title={editingReceipt ? `تعديل إذن الاستلام #${editingReceipt.referenceNumber}` : 'تسجيل إذن استلام بضاعة جديدة (بالبالتات)'}
        size="xl"
      >
        <StockInForm
          key={editingReceipt?.referenceNumber || 'new-stock-in'}
          products={products}
          initialValues={editingReceipt ? {
            date: editingReceipt.date?.slice(0, 10) || todayISO(),
            referenceNumber: editingReceipt.referenceNumber,
            supplier: editingReceipt.supplier === '—' ? '' : editingReceipt.supplier,
            notes: editingReceipt.notes || '',
            items: editingReceipt.rawItems,
          } : null}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
