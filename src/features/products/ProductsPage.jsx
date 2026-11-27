// STOCKFLOW — PRODUCTS PAGE
import { useState, useMemo } from 'react';
import { Plus, Edit2, Power, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';
import { formatDate, formatQty } from '../../utils/formatters';
import { PRODUCT_CATEGORIES } from '../../utils/constants';

const schema = z.object({
  name: z.string().min(2, 'اسم المنتج مطلوب'),
  sku: z.string().min(1, 'رمز المنتج مطلوب'),
  category: z.string().min(1, 'الفئة مطلوبة'),
  packageSize: z.string().min(1, 'الحجم مطلوب'),
  shrinksPerPallet: z.coerce.number().min(1, 'يجب أن يكون أكبر من صفر').default(169),
  piecesPerShrink: z.coerce.number().min(1, 'يجب أن يكون أكبر من صفر').max(999),
  minimumStock: z.coerce.number().min(0, 'يجب أن يكون صفر أو أكثر'),
  description: z.string().optional(),
});

function ProductForm({ defaultValues, onSubmit, onClose }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || { shrinksPerPallet: 169, piecesPerShrink: 24, minimumStock: 20 },
  });

  const watchMinShrinks = watch('minimumStock');
  const watchPieces = watch('piecesPerShrink');
  const minPiecesEquivalent = (parseFloat(watchMinShrinks) || 0) * (parseFloat(watchPieces) || 24);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-cairo">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">اسم المنتج *</label>
          <input {...register('name')} className="form-input" placeholder="مثال: بيبسي 330 مل" />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="form-label">رمز SKU *</label>
          <input {...register('sku')} className="form-input" placeholder="مثال: PEP-330" />
          {errors.sku && <p className="form-error">{errors.sku.message}</p>}
        </div>
        <div>
          <label className="form-label">الفئة *</label>
          <select {...register('category')} className="form-input">
            <option value="">اختر الفئة</option>
            {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.category && <p className="form-error">{errors.category.message}</p>}
        </div>
        <div>
          <label className="form-label">الحجم / العبوة *</label>
          <input {...register('packageSize')} className="form-input" placeholder="مثال: 330 مل كانز" />
          {errors.packageSize && <p className="form-error">{errors.packageSize.message}</p>}
        </div>
        <div>
          <label className="form-label">شرنكات في البالتة *</label>
          <input type="number" {...register('shrinksPerPallet')} className="form-input" min={1} max={9999} />
          {errors.shrinksPerPallet && <p className="form-error">{errors.shrinksPerPallet.message}</p>}
        </div>
        <div>
          <label className="form-label">قطع في الشرنك *</label>
          <input type="number" {...register('piecesPerShrink')} className="form-input" min={1} max={999} />
          {errors.piecesPerShrink && <p className="form-error">{errors.piecesPerShrink.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="form-label font-bold text-amber-800 dark:text-amber-400">
            حد المخزون الأدنى (بالشرنك) *
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              {...register('minimumStock')}
              className="form-input font-bold text-base"
              min={0}
              placeholder="مثال: 20 شرنك"
            />
            {minPiecesEquivalent > 0 && (
              <span className="text-xs text-gray-500 whitespace-nowrap bg-gray-100 dark:bg-slate-800 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700">
                يعادل: <strong>{minPiecesEquivalent.toLocaleString('en-US')} قطعة</strong>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            سيقوم النظام بتنبيهك بنقص المخزون إذا قل رصيد الصنف عن هذا العدد من الشرنكات.
          </p>
          {errors.minimumStock && <p className="form-error">{errors.minimumStock.message}</p>}
        </div>
      </div>
      <div>
        <label className="form-label">وصف (اختياري)</label>
        <textarea {...register('description')} className="form-input" rows={2} placeholder="ملاحظات حول الصنف..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>حفظ المنتج</Button>
      </div>
    </form>
  );
}

export default function ProductsPage() {
  const { products, addProduct, updateProduct, toggleProductStatus, stockTransactions } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const stockSummary = useMemo(
    () => buildWarehouseStockSummary(products, stockTransactions),
    [products, stockTransactions]
  );

  const filtered = useMemo(() => {
    return stockSummary.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.category.includes(search);
      const matchActive =
        filterActive === 'all' ||
        (filterActive === 'active' && p.isActive) ||
        (filterActive === 'inactive' && !p.isActive) ||
        (filterActive === 'low' && p.isLowStock);
      return matchSearch && matchActive;
    });
  }, [stockSummary, search, filterActive]);

  const handleSubmit = async (data) => {
    if (editProduct) {
      await updateProduct(editProduct.id, data);
      toast.success('تم تحديث المنتج بنجاح');
    } else {
      await addProduct(data);
      toast.success('تم إضافة المنتج بنجاح');
    }
    setModalOpen(false);
    setEditProduct(null);
  };

  const columns = [
    { key: 'name', title: 'اسم المنتج', render: (val, row) => (
      <div>
        <p className="font-bold text-gray-900 dark:text-slate-100">{val}</p>
        <p className="text-xs text-gray-500">{row.sku} · {row.category}</p>
      </div>
    )},
    { key: 'packageSize', title: 'الحجم' },
    { key: 'shrinksPerPallet', title: 'شرنك/بالتة', render: (val) => `${val || 169} ش` },
    { key: 'piecesPerShrink', title: 'ق/شرنك', render: (val) => `${val} ق` },
    { key: 'minimumStock', title: 'حد الطلب', render: (val) => (
      <span className="font-bold text-slate-700 dark:text-slate-300">
        {val || 0} شرنك
      </span>
    )},
    { key: 'currentStock', title: 'المخزون الحالي', render: (val, row) => {
      const pPerShrink = row.piecesPerShrink || 24;
      const shrinks = Math.floor(val / pPerShrink);
      const remainderPieces = val % pPerShrink;
      return (
        <div>
          <span className={`font-black text-sm ${row.isLowStock ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {shrinks.toLocaleString('en-US')} شرنك
            {remainderPieces > 0 && <span className="text-xs font-normal text-gray-500 mr-1">(+{remainderPieces} ق)</span>}
          </span>
          <p className="text-xs text-gray-400">{val.toLocaleString('en-US')} قطعة</p>
        </div>
      );
    }},
    { key: 'isLowStock', title: 'الحالة', render: (val, row) => (
      <div className="flex gap-2">
        <StatusBadge variant={row.isActive ? 'success' : 'muted'}>
          {row.isActive ? 'نشط' : 'موقوف'}
        </StatusBadge>
        {val && <StatusBadge variant="warning">مخزون منخفض</StatusBadge>}
      </div>
    )},
    { key: 'id', title: 'إجراءات', render: (_, row) => (
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setEditProduct(row); setModalOpen(true); }}
          className="btn-icon text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800"
          title="تعديل"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => setConfirmToggle(row)}
          className={`btn-icon ${row.isActive ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'}`}
          title={row.isActive ? 'إيقاف' : 'تفعيل'}
        >
          <Power size={15} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المنتجات والأصناف"
        subtitle={`${products.length} منتج مسجل · ${products.filter((p) => p.isActive).length} نشط`}
        actions={
          <Button onClick={() => { setEditProduct(null); setModalOpen(true); }}>
            <Plus size={16} />
            إضافة صنف جديد
          </Button>
        }
      />

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو SKU أو الفئة..." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[['all','الكل'],['active','نشط'],['inactive','موقوف'],['low','مخزون منخفض']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilterActive(val)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  filterActive === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          emptyTitle="لا توجد منتجات مسجلة"
          emptyDescription="أضف أصنافك للبدء في حركة المخزن"
          emptyIcon={Package}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditProduct(null); }}
        title={editProduct ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد للمخزن'}
      >
        <ProductForm
          defaultValues={editProduct}
          onSubmit={handleSubmit}
          onClose={() => { setModalOpen(false); setEditProduct(null); }}
        />
      </Modal>

      {/* Confirm toggle */}
      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={async () => {
          await toggleProductStatus(confirmToggle.id);
          toast.success(confirmToggle.isActive ? 'تم إيقاف الصنف' : 'تم تفعيل الصنف');
        }}
        title={confirmToggle?.isActive ? 'إيقاف الصنف' : 'تفعيل الصنف'}
        message={`هل تريد ${confirmToggle?.isActive ? 'إيقاف' : 'تفعيل'} الصنف "${confirmToggle?.name}"؟`}
        confirmText={confirmToggle?.isActive ? 'إيقاف' : 'تفعيل'}
        variant={confirmToggle?.isActive ? 'danger' : 'primary'}
      />
    </div>
  );
}
