// ============================================================
// STOCKFLOW — STOCK IN PAGE
// Register incoming products from suppliers with Pallets-First workflow.
// ============================================================

import { useState, useMemo } from 'react';
import { Plus, Trash2, PackagePlus, CheckCircle, Layers } from 'lucide-react';
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
    productId: z.string().min(1, 'الرجاء اختيار الصنف المستلم'),
    pallets: z.coerce.number().min(0.01, 'أدخل عدد البالتات (مثال: 10)'),
    extraShrinks: z.coerce.number().min(0).optional(),
  })).min(1, 'أضف صنفاً واحداً على الأقل'),
});

function StockInForm({ products, onSubmit, onClose }) {
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      date: todayISO(),
      items: [{ productId: '', pallets: '', extraShrinks: '' }],
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
            الأصناف المستلمة (أدخل عدد البالتات فقط)
          </h4>
          <button
            type="button"
            onClick={() => append({ productId: '', pallets: '', extraShrinks: '' })}
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

            const pCount = parseFloat(item?.pallets) || 0;
            const extra = parseFloat(item?.extraShrinks) || 0;

            // Automatic exact calculations:
            const totalShrinks = Math.round((pCount * shrinksPerPallet) + extra);
            const totalPieces = Math.round(totalShrinks * piecesPerShrink);

            return (
              <div key={field.id} className="bg-gray-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-gray-200 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  {/* 1. Product select */}
                  <div className="sm:col-span-5">
                    <label className="form-label text-xs font-bold text-gray-700 dark:text-gray-300">
                      الصنف المستلم *
                    </label>
                    <select
                      {...register(`items.${index}.productId`)}
                      className="form-input font-medium"
                    >
                      <option value="">-- اختر الصنف المستلم --</option>
                      {products.filter((p) => p.isActive).map((p) => (
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
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-blue-700 dark:text-sky-400">
                      عدد البالتات *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      {...register(`items.${index}.pallets`)}
                      className="form-input text-center font-black text-base text-blue-900 dark:text-sky-300 bg-blue-50/60 dark:bg-sky-950/40 border-blue-300 dark:border-sky-800 focus:ring-blue-500"
                      placeholder="كم بالتة؟"
                    />
                    {errors.items?.[index]?.pallets && (
                      <p className="form-error">{errors.items[index].pallets.message}</p>
                    )}
                  </div>

                  {/* 3. Automatic Total Shrinks (Read-only calculation) */}
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-gray-600 dark:text-gray-400">
                      إجمالي الشرنكات (تلقائي)
                    </label>
                    <div className="form-input bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 font-extrabold text-slate-800 dark:text-slate-200 text-center flex items-center justify-center select-none">
                      {totalShrinks > 0 ? (
                        <span>{totalShrinks.toLocaleString('ar-EG')} ش</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>

                  {/* 4. Automatic Total Pieces (Read-only calculation) */}
                  <div className="sm:col-span-2">
                    <label className="form-label text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      إجمالي القطع / علب (تلقائي)
                    </label>
                    <div className="form-input bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-black text-center flex items-center justify-center select-none">
                      {totalPieces > 0 ? (
                        <span>{totalPieces.toLocaleString('ar-EG')} ق</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>

                  {/* 5. Delete button */}
                  {fields.length > 1 && (
                    <div className="sm:col-span-1 flex justify-center pt-7">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="btn-icon text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="حذف هذا الصنف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Calculation breakdown summary */}
                {product && pCount > 0 && (
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
                    <span className="font-semibold text-blue-700 dark:text-sky-400">
                      {pCount} بالتة × {shrinksPerPallet} شرنك = {totalShrinks.toLocaleString('ar-EG')} شرنك
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      × {piecesPerShrink} قطعة = {totalPieces.toLocaleString('ar-EG')} قطعة في المخزن
                    </span>
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
          <CheckCircle size={16} /> تسجيل وحفظ إذن الاستلام
        </Button>
      </div>
    </form>
  );
}

export default function StockInPage() {
  const { products, stockTransactions, receiveStock } = useInventoryStore();
  const [modalOpen, setModalOpen] = useState(false);
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
            totalPieces: 0,
          };
        }
        const product = products.find((p) => p.id === tx.productId);
        const pPerShrink = product?.piecesPerShrink || 24;
        const sPerPallet = product?.shrinksPerPallet || 169;
        const totalShrinks = Math.round(tx.quantityPieces / pPerShrink);
        const palletsCount = (totalShrinks / sPerPallet).toFixed(1);

        groups[ref].items.push({
          product: product?.name || tx.productId,
          qty: tx.quantityPieces,
          shrinks: totalShrinks,
          pallets: Number(palletsCount) >= 0.5 ? palletsCount : null,
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

      const pCount = parseFloat(item.pallets) || 0;
      const extra = parseFloat(item.extraShrinks) || 0;
      const totalShrinks = Math.round((pCount * shrinksPerPallet) + extra);
      const quantityPieces = Math.round(totalShrinks * piecesPerShrink);

      return {
        productId: item.productId,
        quantityPieces,
        quantityShrinks: totalShrinks,
        pallets: pCount,
        piecesPerShrink,
      };
    });

    const result = await receiveStock({
      date: data.date,
      referenceNumber: data.referenceNumber,
      supplier: data.supplier,
      notes: data.notes,
      items,
    });

    if (result.success) {
      toast.success(`تم تسجيل إذن الاستلام #${result.referenceNumber} بنجاح`);
      setModalOpen(false);
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
        <div className="space-y-1">
          {val.slice(0, 3).map((item, i) => (
            <p key={i} className="text-xs text-gray-800 dark:text-gray-200">
              {item.product}:{' '}
              {item.pallets && (
                <span className="font-bold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded mr-1">
                  {item.pallets} بالتة
                </span>
              )}
              <span className="font-semibold text-gray-600 dark:text-gray-400">
                ({item.shrinks.toLocaleString('ar-EG')} شرنك)
              </span>
            </p>
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
          {val.toLocaleString('ar-EG')} ق
        </span>
      )
    },
    { key: 'notes', title: 'ملاحظات', render: (val) => val || '—' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="استلام البضاعة (الوارد)"
        subtitle={`تسجيل توريدات المصنع بالبالتات (${stockInRecords.length} إذن مسجل)`}
        actions={
          <Button onClick={() => setModalOpen(true)}>
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
        onClose={() => setModalOpen(false)}
        title="تسجيل إذن استلام بضاعة جديدة (بالبالتات)"
        size="xl"
      >
        <StockInForm
          products={products}
          onSubmit={handleSubmit}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
