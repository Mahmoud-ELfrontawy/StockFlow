// STOCKFLOW — DAMAGED GOODS PAGE
import { useState, useMemo } from 'react';
import { Plus, AlertTriangle, Pencil } from 'lucide-react';
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
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { DAMAGE_SOURCES, DAMAGE_SOURCE_LABELS } from '../../utils/constants';
import { formatDate, todayISO } from '../../utils/formatters';

const schema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب'),
  productId: z.string().min(1, 'المنتج مطلوب'),
  quantityShrinks: z.coerce.number().min(0.5, 'الكمية مطلوبة'),
  source: z.string().min(1),
  reason: z.string().min(2, 'سبب التلف مطلوب'),
  salesmanId: z.string().optional(),
  notes: z.string().optional(),
});

function DamageForm({ products, salesmen, initialValues, onSubmit, onClose }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues || { date: todayISO(), source: DAMAGE_SOURCES.WAREHOUSE },
  });
  const watchProductId = watch('productId');
  const product = products.find((p) => p.id === watchProductId);
  const watchQty = watch('quantityShrinks');
  const watchSource = watch('source');
  const totalPieces = product && watchQty ? Math.round(Number(watchQty) * product.piecesPerShrink) : 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-cairo">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="form-label">التاريخ *</label><input type="date" {...register('date')} className="form-input" />{errors.date && <p className="form-error">{errors.date.message}</p>}</div>
        <div>
          <label className="form-label">المنتج *</label>
          <select {...register('productId')} className="form-input">
            <option value="">اختر المنتج</option>
            {products.filter((p) => p.isActive || p.id === initialValues?.productId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.productId && <p className="form-error">{errors.productId.message}</p>}
        </div>
        <div>
          <label className="form-label font-bold text-rose-700 dark:text-rose-400">
            الكمية بالشرنك *{product && <span className="text-gray-400 font-normal"> ({product.piecesPerShrink} ق/شرنك)</span>}
          </label>
          <input type="number" step="0.5" min="0.5" {...register('quantityShrinks')} className="form-input font-bold" placeholder="عدد الشرنكات التالفة" />
          {totalPieces > 0 && watchSource === 'warehouse' && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-semibold">{totalPieces.toLocaleString('en-US')} قطعة ستُخصم من المخزن</p>}
          {errors.quantityShrinks && <p className="form-error">{errors.quantityShrinks.message}</p>}
        </div>
        <div>
          <label className="form-label">مصدر التلف *</label>
          <select {...register('source')} className="form-input">
            {Object.entries(DAMAGE_SOURCE_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="form-label">سبب التلف *</label>
          <input {...register('reason')} className="form-input" placeholder="كسر أثناء التخزين، سوء مناولة، انتهاء صلاحية..." />
          {errors.reason && <p className="form-error">{errors.reason.message}</p>}
        </div>
        <div>
          <label className="form-label">المندوب المسؤول (إن وجد)</label>
          <select {...register('salesmanId')} className="form-input">
            <option value="">— لا يوجد —</option>
            {salesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className="form-label">ملاحظات</label><input {...register('notes')} className="form-input" placeholder="ملاحظات إضافية..." /></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
        <Button type="submit" variant="danger" loading={isSubmitting}>تسجيل تالف</Button>
      </div>
    </form>
  );
}

export default function DamagedGoodsPage() {
  const { products, salesmen, damageRecords, recordDamage, updateDamageRecord, approveDamageRecord } = useInventoryStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState(null);
  const [approveConfirm, setApproveConfirm] = useState(null);

  const sorted = useMemo(() => [...damageRecords].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [damageRecords]);
  const totalDamagedPieces = sorted.reduce((s, d) => s + d.quantityPieces, 0);

  const totalDamagedShrinks = useMemo(() => {
    return sorted.reduce((s, d) => {
      const prod = products.find((p) => p.id === d.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      return s + Math.floor(d.quantityPieces / pShrink);
    }, 0);
  }, [sorted, products]);

  const pendingCount = sorted.filter((d) => d.reviewStatus === 'pending').length;

  const handleSubmit = async (data) => {
    const product = products.find((p) => p.id === data.productId);
    const payload = {
      date: data.date, productId: data.productId,
      quantityPieces: Math.round(Number(data.quantityShrinks) * (product?.piecesPerShrink || 1)),
      piecesPerShrink: product?.piecesPerShrink, source: data.source,
      reason: data.reason, salesmanId: data.salesmanId || null, notes: data.notes,
    };
    const result = editingDamage
      ? await updateDamageRecord(editingDamage.id, payload)
      : await recordDamage(payload);
    if (result.success) { toast.success(editingDamage ? 'تم حفظ تعديل التالف' : `تم تسجيل التالف ${result.referenceNumber}`); setModalOpen(false); setEditingDamage(null); }
    else toast.error(result.message || 'حدث خطأ أثناء تسجيل التالف');
  };

  const handleApproveDamage = async () => {
    try {
      const result = await approveDamageRecord(approveConfirm.id);
      if (!result?.success) throw new Error(result?.message || 'تعذر اعتماد تسجيل التالف');
      toast.success('تم اعتماد تسجيل التالف');
      setApproveConfirm(null);
    } catch (error) {
      toast.error(error.message || 'تعذر اعتماد تسجيل التالف');
    }
  };

  const statusVariant = { pending: 'warning', approved: 'success', rejected: 'danger' };
  const statusLabel = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' };

  const columns = [
    { key: 'referenceNumber', title: 'رقم التلف', render: (val) => <span className="font-mono text-red-600 font-bold">#{val}</span> },
    { key: 'date', title: 'التاريخ', render: (val) => formatDate(val) },
    { key: 'productId', title: 'المنتج', render: (val) => products.find((p) => p.id === val)?.name || '—' },
    { key: 'quantityPieces', title: 'الكمية التالفة', render: (val, row) => {
      const prod = products.find((p) => p.id === row.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const shrinks = Math.floor(val / pShrink);
      const loose = val % pShrink;
      return (
        <div>
          <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
            {shrinks.toLocaleString('en-US')} شرنك
            {loose > 0 && <span className="text-xs font-normal text-amber-600 mr-1">(+{loose} ق)</span>}
          </span>
          <span className="block text-[11px] text-gray-400">({val.toLocaleString('en-US')} قطعة)</span>
        </div>
      );
    }},
    { key: 'source', title: 'المصدر', render: (val) => DAMAGE_SOURCE_LABELS[val] || val },
    { key: 'reason', title: 'السبب' },
    { key: 'reviewStatus', title: 'الحالة', render: (val) => <StatusBadge variant={statusVariant[val]}>{statusLabel[val]}</StatusBadge> },
    { key: 'id', title: '', render: (_, row) => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const product = products.find((p) => p.id === row.productId);
            const pShrink = row.piecesPerShrink || product?.piecesPerShrink || 24;
            setEditingDamage({
              ...row,
              quantityShrinks: row.quantityPieces / pShrink,
              date: row.date?.slice(0, 10) || todayISO(),
            });
            setModalOpen(true);
          }}
          className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400 cursor-pointer"
          title="تعديل تسجيل التالف"
        ><Pencil size={15} /></button>
        {row.reviewStatus === 'pending' && (
          <button onClick={() => setApproveConfirm(row)} className="text-xs text-blue-600 dark:text-sky-400 hover:underline font-bold">اعتماد</button>
        )}
      </div>
    ) },
  ];

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="البضاعة التالفة"
        subtitle={`إجمالي التالف: ${totalDamagedShrinks.toLocaleString('en-US')} شرنك (${totalDamagedPieces.toLocaleString('en-US')} قطعة) · ${pendingCount} قيد المراجعة`}
        actions={<Button variant="danger" onClick={() => { setEditingDamage(null); setModalOpen(true); }}><Plus size={16} /> تسجيل تالف</Button>}
      />
      <div className="card p-0 overflow-hidden">
        <DataTable columns={columns} data={sorted} emptyTitle="لا توجد تسجيلات تلف" emptyIcon={AlertTriangle} />
      </div>
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingDamage(null); }} title={editingDamage ? `تعديل تسجيل التالف #${editingDamage.referenceNumber}` : 'تسجيل بضاعة تالفة'}>
        <DamageForm
          key={editingDamage?.id || 'new-damage'}
          products={products}
          salesmen={salesmen}
          initialValues={editingDamage}
          onSubmit={handleSubmit}
          onClose={() => { setModalOpen(false); setEditingDamage(null); }}
        />
      </Modal>
      <ConfirmDialog
        isOpen={!!approveConfirm}
        onClose={() => setApproveConfirm(null)}
        onConfirm={handleApproveDamage}
        title="اعتماد تسجيل التالف"
        message={(() => {
          if (!approveConfirm) return '';
          return `هل تريد اعتماد تسجيل التلف رقم ${approveConfirm.referenceNumber}؟`;
        })()}
      />
    </div>
  );
}
