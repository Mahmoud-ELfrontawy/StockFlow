// STOCKFLOW — RETURNS PAGE
import { useState, useMemo } from 'react';
import { Plus, RotateCcw, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { RETURN_CONDITIONS, RETURN_CONDITION_LABELS } from '../../utils/constants';
import { formatDate, todayISO } from '../../utils/formatters';

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  salesmanId: z.string().min(1, 'المندوب مطلوب'),
  productId: z.string().min(1, 'المنتج مطلوب'),
  quantityShrinks: z.coerce.number().min(0.5, 'الكمية بالشرنك مطلوبة'),
  condition: z.enum(['good', 'damaged', 'pending']),
  notes: z.string().optional(),
});

function ReturnForm({ products, salesmen, onSubmit, onClose }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), condition: RETURN_CONDITIONS.GOOD },
  });
  const watchProductId = watch('productId');
  const product = products.find((p) => p.id === watchProductId);
  const watchQty = watch('quantityShrinks');
  const totalPieces = product && watchQty ? Math.round(Number(watchQty) * product.piecesPerShrink) : 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-cairo">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">التاريخ *</label>
          <input type="date" {...register('date')} className="form-input" />
          {errors.date && <p className="form-error">{errors.date.message}</p>}
        </div>
        <div>
          <label className="form-label">المندوب *</label>
          <select {...register('salesmanId')} className="form-input">
            <option value="">اختر المندوب</option>
            {salesmen.filter((s) => s.status === 'active').map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.employeeCode})</option>
            ))}
          </select>
          {errors.salesmanId && <p className="form-error">{errors.salesmanId.message}</p>}
        </div>
        <div>
          <label className="form-label">المنتج *</label>
          <select {...register('productId')} className="form-input">
            <option value="">اختر المنتج</option>
            {products.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.productId && <p className="form-error">{errors.productId.message}</p>}
        </div>
        <div>
          <label className="form-label font-bold text-blue-700 dark:text-sky-400">
            الكمية بالشرنك *{product && <span className="text-gray-400 font-normal"> ({product.piecesPerShrink} ق/شرنك)</span>}
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            {...register('quantityShrinks')}
            className="form-input font-bold"
            placeholder="عدد الشرنكات المرتجعة"
          />
          {totalPieces > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
              يعادل: {totalPieces.toLocaleString('ar-EG')} قطعة
            </p>
          )}
          {errors.quantityShrinks && <p className="form-error">{errors.quantityShrinks.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">حالة البضاعة المرتجعة *</label>
          <select {...register('condition')} className="form-input">
            {Object.entries(RETURN_CONDITION_LABELS).map(([val, lbl]) => (
              <option key={val} value={val}>{lbl}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">البضاعة السليمة تعود فوراً لرصيد المخزن المتاح، التالفة تسجل كتالف، المعلقة تحتاج فحصاً قبل الاعتماد.</p>
        </div>
      </div>
      <div>
        <label className="form-label">ملاحظات</label>
        <textarea {...register('notes')} className="form-input" rows={2} placeholder="سبب الإرجاع أو ملاحظات الفحص..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}><CheckCircle size={16} /> تسجيل المرتجع</Button>
      </div>
    </form>
  );
}

export default function ReturnsPage() {
  const { products, salesmen, returnTransactions, recordReturn, approvePendingReturn } = useInventoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [approveReturn, setApproveReturn] = useState(null);
  const [approveCondition, setApproveCondition] = useState('good');

  const sorted = useMemo(
    () => [...returnTransactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [returnTransactions]
  );

  const handleSubmit = (data) => {
    const product = products.find((p) => p.id === data.productId);
    const result = recordReturn({
      date: data.date,
      salesmanId: data.salesmanId,
      productId: data.productId,
      quantityPieces: Math.round(Number(data.quantityShrinks) * (product?.piecesPerShrink || 1)),
      piecesPerShrink: product?.piecesPerShrink || 1,
      condition: data.condition,
      notes: data.notes,
    });
    if (result.success) {
      toast.success(`تم تسجيل المرتجع ${result.referenceNumber} بنجاح`);
      setModalOpen(false);
    } else {
      toast.error(result.message);
    }
  };

  const conditionVariant = { good: 'success', damaged: 'danger', pending: 'warning' };

  const columns = [
    { key: 'referenceNumber', title: 'رقم المرتجع', render: (val) => <span className="font-mono text-blue-600 dark:text-sky-400 font-bold">#{val}</span> },
    { key: 'date', title: 'التاريخ', render: (val) => formatDate(val) },
    { key: 'salesmanId', title: 'المندوب', render: (val) => salesmen.find((s) => s.id === val)?.name || '—' },
    { key: 'productId', title: 'المنتج', render: (val) => products.find((p) => p.id === val)?.name || '—' },
    { key: 'quantityPieces', title: 'الكمية بالشرنك', render: (val, row) => {
      const prod = products.find((p) => p.id === row.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const shrinks = Math.floor(val / pShrink);
      const loose = val % pShrink;
      return (
        <div>
          <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
            {shrinks.toLocaleString('ar-EG')} شرنك
            {loose > 0 && <span className="text-xs font-normal text-amber-600 mr-1">(+{loose} ق)</span>}
          </span>
          <span className="block text-[11px] text-gray-400">({val.toLocaleString('ar-EG')} قطعة)</span>
        </div>
      );
    }},
    { key: 'condition', title: 'الحالة', render: (val) => (
      <StatusBadge variant={conditionVariant[val]}>{RETURN_CONDITION_LABELS[val]}</StatusBadge>
    )},
    { key: 'id', title: '', render: (_, row) => row.condition === 'pending' ? (
      <button onClick={() => setApproveReturn(row)} className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-lg hover:bg-amber-200">فحص واعتماد</button>
    ) : null },
  ];

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="المرتجعات"
        subtitle={`${returnTransactions.length} عملية إرجاع مسجلة`}
        actions={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> تسجيل مرتجع</Button>}
      />
      <div className="card p-0 overflow-hidden">
        <DataTable columns={columns} data={sorted} emptyTitle="لا توجد مرتجعات" emptyIcon={RotateCcw} />
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="تسجيل مرتجع بضاعة">
        <ReturnForm products={products} salesmen={salesmen} onSubmit={handleSubmit} onClose={() => setModalOpen(false)} />
      </Modal>
      {approveReturn && (
        <Modal isOpen={!!approveReturn} onClose={() => setApproveReturn(null)} title="فحص واعتماد المرتجع المعلق" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">حدد حالة البضاعة بعد الفحص الفعلي لإدراجها في حسابات المخزون:</p>
            <select value={approveCondition} onChange={(e) => setApproveCondition(e.target.value)} className="form-input">
              <option value="good">سليم (يُضاف للمخزن فوراً)</option>
              <option value="damaged">تالف (يسجل تالف ولا يضاف للمخزن)</option>
            </select>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setApproveReturn(null)}>إلغاء</Button>
              <Button onClick={() => {
                const r = approvePendingReturn(approveReturn.id, approveCondition);
                if (r.success) { toast.success('تم اعتماد المرتجع بنجاح'); setApproveReturn(null); }
              }}>اعتماد الفحص</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}