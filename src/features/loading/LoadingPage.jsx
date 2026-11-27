// ============================================================
// STOCKFLOW — LOADING PAGE
// Core operational module: dispatch products to salesmen.
// ============================================================

import { useState, useMemo } from 'react';
import { Plus, Trash2, Truck, Printer, CheckCircle, Eye, Pencil } from 'lucide-react';
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
import StatusBadge from '../../components/common/StatusBadge';
import { calculateWarehouseStock } from '../../utils/stockCalculations';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { todayISO } from '../../utils/formatters';

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  salesmanId: z.string().min(1, 'المندوب مطلوب'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'المنتج مطلوب'),
        quantityShrinks: z.coerce
          .number()
          .min(0.5, 'الكمية يجب أن تكون أكبر من صفر'),
      })
    )
    .min(1, 'أضف منتجاً واحداً على الأقل'),
});

// ─── Loading Form ─────────────────────────────────────────────
function LoadingForm({ products, salesmen, stockTransactions, initialValues, onSubmit, onClose }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues || {
      date: todayISO(), salesmanId: '', notes: '',
      items: [{ productId: '', quantityShrinks: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const getProduct = (id) => products.find((p) => p.id === id);

  const getAvailableStock = (productId) => {
    if (!productId) return 0;
    const alreadyLoaded = initialValues?.items
      ?.filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + (item.quantityPieces || 0), 0) || 0;
    return calculateWarehouseStock(productId, stockTransactions) + alreadyLoaded;
  };

  const { totalItems, totalShrinks } = useMemo(() => {
    let pieces = 0;
    let shrinks = 0;
    watchedItems?.forEach((item) => {
      const product = getProduct(item?.productId);
      const s = Number(item?.quantityShrinks) || 0;
      if (s > 0) {
        shrinks += s;
        if (product) {
          pieces += Math.round(s * product.piecesPerShrink);
        }
      }
    });
    return { totalItems: pieces, totalShrinks: shrinks };
  }, [watchedItems, products]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 font-cairo">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="form-label">تاريخ التحميل *</label>
          <input type="date" {...register('date')} className="form-input" />
          {errors.date && <p className="form-error">{errors.date.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">المندوب *</label>
          <select {...register('salesmanId')} className="form-input">
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

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-800 dark:text-slate-200">المنتجات المحملة</h4>
          <button
            type="button"
            onClick={() => append({ productId: '', quantityShrinks: '' })}
            className="text-sm text-blue-600 dark:text-sky-400 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={15} /> إضافة صنف
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const item = watchedItems?.[index];
            const product = getProduct(item?.productId);
            const available = getAvailableStock(item?.productId);
            const requested = product && item?.quantityShrinks
              ? Math.round(Number(item.quantityShrinks) * product.piecesPerShrink)
              : 0;
            const totalRequestedForProduct = product
              ? (watchedItems || [])
                  .filter((entry) => entry.productId === item?.productId)
                  .reduce((sum, entry) => sum + Math.round((Number(entry.quantityShrinks) || 0) * product.piecesPerShrink), 0)
              : requested;
            const isInsufficient = requested > 0 && totalRequestedForProduct > available;

            return (
              <div
                key={field.id}
                className={`rounded-2xl p-4 border transition-colors ${
                  isInsufficient
                    ? 'bg-red-50/70 border-red-200 dark:bg-rose-950/30 dark:border-rose-900/50'
                    : 'bg-gray-50/80 border-gray-200/80 dark:bg-slate-900/70 dark:border-slate-800'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
                  <div className="sm:col-span-2">
                    <label className="form-label font-bold text-gray-700 dark:text-slate-300">المنتج *</label>
                    <select
                      {...register(`items.${index}.productId`)}
                      className="form-input font-medium"
                    >
                      <option value="">اختر المنتج</option>
                      {products
                        .filter((p) => p.isActive || initialValues?.items?.some((old) => old.productId === p.id))
                        .map((p) => {
                          const stock = getAvailableStock(p.id);
                          const pPerShrink = p.piecesPerShrink || 24;
                          const stockShrinks = Math.floor(stock / pPerShrink);
                          return (
                            <option key={p.id} value={p.id} disabled={stock <= 0}>
                              {p.name} — متاح: {stockShrinks.toLocaleString('en-US')} شرنك
                            </option>
                          );
                        })}
                    </select>
                    {product && (() => {
                      const pPerShrink = product.piecesPerShrink || 24;
                      const availableShrinks = Math.floor(available / pPerShrink);
                      const minShrinks = product.minimumStock || 0;
                      return (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          المتاح: <span className={availableShrinks < minShrinks ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-700 dark:text-emerald-400 font-bold'}>
                            {availableShrinks.toLocaleString('en-US')} شرنك
                          </span>
                          {' '}<span className="text-gray-400 font-normal">({available.toLocaleString('en-US')} قطعة · {product.piecesPerShrink} ق/ش)</span>
                        </p>
                      );
                    })()}
                    {errors.items?.[index]?.productId && (
                      <p className="form-error">{errors.items[index].productId.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label font-bold text-blue-700 dark:text-sky-400">الكمية بالشرنك *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      {...register(`items.${index}.quantityShrinks`)}
                      className="form-input font-bold text-base text-center"
                      placeholder="عدد الشرنكات"
                    />
                    {errors.items?.[index]?.quantityShrinks && (
                      <p className="form-error">{errors.items[index].quantityShrinks.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="form-label text-xs font-semibold text-gray-600 dark:text-slate-400">إجمالي القطع</label>
                    <div
                      className={`form-input font-bold text-center flex items-center justify-center transition-colors ${
                        isInsufficient
                          ? 'bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                          : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800/90 dark:border-slate-700 dark:text-sky-300'
                      }`}
                    >
                      {requested > 0 ? `${requested.toLocaleString('en-US')} ق` : '—'}
                    </div>
                    {isInsufficient && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-semibold">
                        ⚠️ تتجاوز المخزون المتاح!
                      </p>
                    )}
                  </div>
                </div>

                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="mt-3 text-xs text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> حذف الصنف
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {errors.items?.message && (
          <p className="form-error mt-2">{errors.items.message}</p>
        )}
      </div>

      {/* Total summary (Styled for both Light and Dark mode) */}
      {totalShrinks > 0 && (
        <div className="bg-blue-50/80 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-xs">
          <div>
            <span className="text-xs text-blue-800 dark:text-slate-400 font-bold block mb-0.5">إجمالي الحمولة المسجلة</span>
            <span className="text-xl font-black text-blue-900 dark:text-sky-300">
              {totalShrinks.toLocaleString('en-US')} شرنك
            </span>
          </div>
          <div className="text-left">
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">يعادل بالقطع</span>
            <span className="text-base font-bold text-slate-700 dark:text-slate-300">
              {totalItems.toLocaleString('en-US')} قطعة
            </span>
          </div>
        </div>
      )}

      <div>
        <label className="form-label">ملاحظات</label>
        <input {...register('notes')} className="form-input" placeholder="ملاحظات التحميل..." />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={isSubmitting}>
          <CheckCircle size={16} /> تأكيد التحميل
        </Button>
      </div>
    </form>
  );
}

// ─── Loading Receipt Modal ────────────────────────────────────
function LoadingReceipt({ loading, products, salesmen, onClose }) {
  if (!loading) return null;
  const salesman = salesmen.find((s) => s.id === loading.salesmanId);
  const totalShrinks = loading.items.reduce((s, i) => s + (Number(i.quantityShrinks) || 0), 0);
  const totalPieces = loading.items.reduce((s, i) => s + i.quantityPieces, 0);

  return (
    <div className="space-y-5 font-cairo">
      <div className="bg-blue-50 dark:bg-sky-950/40 rounded-xl p-4 text-center border border-blue-200 dark:border-sky-800">
        <h3 className="font-bold text-blue-900 dark:text-sky-300 text-lg">وصل تحميل بضاعة</h3>
        <p className="text-blue-600 dark:text-sky-400 text-sm mt-1">ستوك فلو — نظام إدارة المخازن</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">رقم التحميل</p>
          <p className="font-bold text-gray-900 dark:text-slate-100 font-mono">#{loading.referenceNumber}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">التاريخ</p>
          <p className="font-bold text-gray-900 dark:text-slate-100">{formatDate(loading.date)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 col-span-2">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">المندوب</p>
          <p className="font-bold text-gray-900 dark:text-slate-100">
            {salesman?.name} ({salesman?.employeeCode})
          </p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 dark:text-slate-200 mb-3">تفاصيل البضاعة</h4>
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th className="text-center">شرنك</th>
                <th className="text-center">قطعة</th>
              </tr>
            </thead>
            <tbody>
              {loading.items.map((item, i) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <tr key={i}>
                    <td className="font-medium text-gray-900 dark:text-slate-100">{product?.name || item.productId}</td>
                    <td className="text-center font-bold text-emerald-700 dark:text-emerald-400">{item.quantityShrinks}</td>
                    <td className="text-center text-gray-500 dark:text-gray-400">{item.quantityPieces.toLocaleString('en-US')}</td>
                  </tr>
                );
              })}
              <tr className="bg-blue-50/50 dark:bg-sky-950/30 font-bold">
                <td>الإجمالي</td>
                <td className="text-center text-emerald-700 dark:text-emerald-400">{totalShrinks.toLocaleString('en-US')} شرنك</td>
                <td className="text-center text-blue-700 dark:text-sky-300">{totalPieces.toLocaleString('en-US')} ق</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {loading.notes && (
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ملاحظات</p>
          <p className="text-sm text-gray-700 dark:text-slate-300">{loading.notes}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-dashed border-gray-300 dark:border-slate-700">
        <div className="text-center">
          <div className="border-b border-gray-400 dark:border-slate-600 mb-2 h-10" />
          <p className="text-xs text-gray-500 dark:text-gray-400">توقيع أمين المخزن</p>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-400 dark:border-slate-600 mb-2 h-10" />
          <p className="text-xs text-gray-500 dark:text-gray-400">توقيع المندوب</p>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>إغلاق</Button>
        <Button onClick={() => window.print()}>
          <Printer size={16} /> طباعة الوصل
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function LoadingPage() {
  const {
    products,
    salesmen,
    stockTransactions,
    loadingTransactions,
    createLoading,
    updateLoading,
  } = useInventoryStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLoading, setEditingLoading] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');

  const filtered = useMemo(() => {
    return loadingTransactions
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .filter((l) => {
        const matchSearch = !search || l.referenceNumber.includes(search);
        const matchSalesman = !filterSalesman || l.salesmanId === filterSalesman;
        return matchSearch && matchSalesman;
      });
  }, [loadingTransactions, search, filterSalesman]);

  const handleSubmit = async (data) => {
    const items = data.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const quantityPieces = Math.round(
        Number(item.quantityShrinks) * (product?.piecesPerShrink || 1)
      );
      return {
        productId: item.productId,
        quantityPieces,
        quantityShrinks: Number(item.quantityShrinks),
        piecesPerShrink: product?.piecesPerShrink || 1,
      };
    });

    const payload = {
      date: data.date,
      salesmanId: data.salesmanId,
      notes: data.notes,
      items,
    };
    const result = editingLoading
      ? await updateLoading(editingLoading.id, payload)
      : await createLoading(payload);

    if (result.success) {
      toast.success(`✅ تم التحميل ${result.referenceNumber} بنجاح`);
      setModalOpen(false);
      setEditingLoading(null);
    } else {
      toast.error(result.message || 'حدث خطأ أثناء حفظ التحميل');
    }
  };

  const getSalesmanName = (id) => {
    const s = salesmen.find((s) => s.id === id);
    return s ? `${s.name} (${s.employeeCode})` : '—';
  };

  const columns = [
    {
      id: 'col-ref',
      key: 'referenceNumber',
      title: 'رقم التحميل',
      render: (val) => <span className="font-mono font-bold text-blue-600 dark:text-sky-400">#{val}</span>,
    },
    { id: 'col-date', key: 'date', title: 'التاريخ', render: (val) => formatDate(val) },
    {
      id: 'col-salesman',
      key: 'salesmanId',
      title: 'المندوب',
      render: (val) => <span className="font-medium text-gray-900 dark:text-slate-100">{getSalesmanName(val)}</span>,
    },
    {
      id: 'col-items-list',
      key: 'items',
      title: 'الأصناف المحمّلة',
      render: (val) => (
        <div className="space-y-1">
          {val && val.slice(0, 2).map((item, i) => {
            const p = products.find((pr) => pr.id === item.productId);
            return (
              <p key={i} className="text-xs">
                <span className="font-bold text-gray-900 dark:text-slate-100">{p?.name || item.productId}:</span>{' '}
                <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  {item.quantityShrinks} شرنك
                </span>
                <span className="text-[11px] text-gray-400 mr-1.5">
                  ({item.quantityPieces ? item.quantityPieces.toLocaleString('en-US') : 0} قطعة)
                </span>
              </p>
            );
          })}
          {val && val.length > 2 && <p className="text-xs text-gray-400">+{val.length - 2} أصناف أخرى</p>}
        </div>
      ),
    },
    {
      id: 'col-total-shrinks',
      key: 'totalShrinks',
      title: 'إجمالي المحمّل (شرنك)',
      render: (_, row) => {
        const rowItems = row.items || [];
        const totalShrinks = rowItems.reduce((s, i) => s + (Number(i.quantityShrinks) || 0), 0);
        const totalPieces = rowItems.reduce((s, i) => s + (i.quantityPieces || 0), 0);
        return (
          <div className="text-center">
            <span className="font-black text-base text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 inline-block">
              {totalShrinks.toLocaleString('en-US')} شرنك
            </span>
            <span className="block text-[11px] font-semibold text-gray-400 mt-0.5">
              ({totalPieces.toLocaleString('en-US')} قطعة)
            </span>
          </div>
        );
      },
    },
    {
      id: 'col-actions',
      key: 'actions',
      title: '',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditingLoading(row); setModalOpen(true); }}
            className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
            title="تعديل إذن التحميل"
          ><Pencil size={15} /></button>
          <button
            onClick={() => setReceiptLoading(row)}
            className="btn-icon text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 dark:hover:text-sky-400 cursor-pointer"
            title="عرض الوصل"
          ><Eye size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="عمليات التحميل"
        subtitle={`${loadingTransactions.length} عملية تحميل مسجلة بالشرنكات`}
        actions={
          <Button onClick={() => { setEditingLoading(null); setModalOpen(true); }}>
            <Truck size={16} /> تحميل جديد
          </Button>
        }
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="بحث برقم التحميل..."
            />
          </div>
          <div className="sm:w-56">
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
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle="لا توجد عمليات تحميل"
          emptyDescription="سجل أول عملية تحميل لمندوب"
          emptyIcon={Truck}
        />
      </div>

      {/* New Loading Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingLoading(null); }}
        title={editingLoading ? `تعديل إذن التحميل #${editingLoading.referenceNumber}` : 'تسجيل عملية تحميل جديدة'}
        size="xl"
      >
        <LoadingForm
          key={editingLoading?.id || 'new-loading'}
          products={products}
          salesmen={salesmen}
          stockTransactions={stockTransactions}
          initialValues={editingLoading ? {
            date: editingLoading.date,
            salesmanId: editingLoading.salesmanId,
            notes: editingLoading.notes || '',
            items: editingLoading.items.map((item) => ({
              productId: item.productId,
              quantityShrinks: item.quantityShrinks,
              quantityPieces: item.quantityPieces,
            })),
          } : null}
          onSubmit={handleSubmit}
          onClose={() => { setModalOpen(false); setEditingLoading(null); }}
        />
      </Modal>

      {/* Receipt Modal */}
      <Modal
        isOpen={!!receiptLoading}
        onClose={() => setReceiptLoading(null)}
        title="وصل التحميل"
        size="md"
      >
        <LoadingReceipt
          loading={receiptLoading}
          products={products}
          salesmen={salesmen}
          onClose={() => setReceiptLoading(null)}
        />
      </Modal>
    </div>
  );
}
