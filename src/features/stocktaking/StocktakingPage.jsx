// STOCKFLOW — STOCKTAKING PAGE
import { useState, useMemo } from 'react';
import { Plus, ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { STOCKTAKING_STATUS, STOCKTAKING_STATUS_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

const statusVariant = { draft: 'muted', pending: 'warning', approved: 'success', rejected: 'danger' };

function StocktakingSession({ session, products, onUpdateItem, onSubmit, onApprove, onReject, onClose }) {
  // We represent the input in shrinks
  const [localItems, setLocalItems] = useState(
    session.items.map((i) => {
      const prod = products.find((p) => p.id === i.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const initialShrinks = i.physicalQuantity !== undefined ? Math.floor(i.physicalQuantity / pShrink) : '';
      return {
        ...i,
        inputShrinks: initialShrinks,
      };
    })
  );

  const handleChange = (productId, val) => {
    setLocalItems((prev) => prev.map((i) => i.productId === productId ? { ...i, inputShrinks: val } : i));
  };

  const handleSave = () => {
    localItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const shrinks = Number(item.inputShrinks);
      if (!isNaN(shrinks) && shrinks >= 0 && item.inputShrinks !== '') {
        const physicalPieces = Math.round(shrinks * pShrink);
        onUpdateItem(session.id, item.productId, physicalPieces, item.notes);
      }
    });
    toast.success('تم حفظ بيانات الجرد الفعلي');
  };

  return (
    <div className="space-y-4 font-cairo">
      <div className="bg-blue-50 dark:bg-sky-950/30 rounded-xl p-3 flex gap-4 text-sm border border-blue-200 dark:border-sky-800">
        <div><span className="text-gray-500">تاريخ الجرد:</span> <strong>{formatDate(session.date)}</strong></div>
        <div><span className="text-gray-500">الحالة:</span> <StatusBadge variant={statusVariant[session.status]}>{STOCKTAKING_STATUS_LABELS[session.status]}</StatusBadge></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-800">
        <table className="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th className="text-center">كمية النظام (دفترية)</th>
              <th className="text-center bg-blue-50/40 dark:bg-sky-950/20 font-bold">الكمية الفعلية (بالشرنك)</th>
              <th className="text-center">الفرق (عجز / زيادة)</th>
            </tr>
          </thead>
          <tbody>
            {localItems.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const pShrink = product?.piecesPerShrink || 24;
              const systemShrinks = Math.floor(item.systemQuantity / pShrink);

              const inputShrinksNum = Number(item.inputShrinks);
              const hasPhysical = !isNaN(inputShrinksNum) && item.inputShrinks !== '';
              const physicalPieces = hasPhysical ? inputShrinksNum * pShrink : null;
              const variancePieces = hasPhysical ? physicalPieces - item.systemQuantity : null;
              const varianceShrinks = variancePieces !== null ? Math.round(variancePieces / pShrink) : null;

              return (
                <tr key={item.productId}>
                  <td className="font-medium">
                    <p className="font-bold text-gray-900 dark:text-slate-100">{product?.name || item.productId}</p>
                    <p className="text-xs text-gray-400">{product?.sku} · {pShrink} ق/ش</p>
                  </td>
                  <td className="text-center">
                    <span className="font-bold text-gray-800 dark:text-slate-200">{systemShrinks.toLocaleString('ar-EG')} شرنك</span>
                    <span className="block text-[11px] text-gray-400">({item.systemQuantity.toLocaleString('ar-EG')} قطعة)</span>
                  </td>
                  <td className="text-center bg-blue-50/30 dark:bg-sky-950/10">
                    {session.status === STOCKTAKING_STATUS.DRAFT ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={item.inputShrinks}
                          onChange={(e) => handleChange(item.productId, e.target.value)}
                          className="form-input text-center w-28 text-sm py-1.5 font-bold"
                          placeholder="عدد الشرنكات"
                        />
                        <span className="text-xs font-bold text-gray-500">شرنك</span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-blue-700 dark:text-sky-300">
                          {item.physicalQuantity !== undefined ? `${Math.floor(item.physicalQuantity / pShrink).toLocaleString('ar-EG')} شرنك` : '—'}
                        </span>
                        {item.physicalQuantity !== undefined && (
                          <span className="block text-[11px] text-gray-400">({item.physicalQuantity.toLocaleString('ar-EG')} قطعة)</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-center">
                    {varianceShrinks !== null && (
                      <div>
                        <span className={`font-bold ${
                          varianceShrinks > 0 ? 'text-emerald-600 dark:text-emerald-400' : varianceShrinks < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500'
                        }`}>
                          {varianceShrinks > 0 ? '+' : ''}{varianceShrinks.toLocaleString('ar-EG')} شرنك
                        </span>
                        <span className="block text-[11px] text-gray-400">
                          ({variancePieces > 0 ? '+' : ''}{variancePieces.toLocaleString('ar-EG')} ق)
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3 flex-wrap pt-2">
        {session.status === STOCKTAKING_STATUS.DRAFT && (
          <>
            <Button variant="secondary" onClick={handleSave}>حفظ كمسودة</Button>
            <Button onClick={() => { handleSave(); onSubmit(session.id); toast.success('تم رفع الجرد للمراجعة'); onClose(); }}>رفع للمراجعة</Button>
          </>
        )}
        {session.status === STOCKTAKING_STATUS.PENDING && (
          <>
            <Button variant="danger" onClick={() => { onReject(session.id); toast.success('تم رفض الجرد'); onClose(); }}>
              <XCircle size={16} /> رفض
            </Button>
            <Button variant="success" onClick={() => { onApprove(session.id); toast.success('تم اعتماد الجرد وتسوية المخزون آلياً'); onClose(); }}>
              <CheckCircle size={16} /> اعتماد وتسوية الفروقات
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
}

export default function StocktakingPage() {
  const { products, stocktakingSessions, startStocktaking, updateStocktakingItem, submitStocktaking, approveStocktaking, rejectStocktaking } = useInventoryStore();
  const [viewSession, setViewSession] = useState(null);
  const [confirmStart, setConfirmStart] = useState(false);

  const sorted = useMemo(() => [...stocktakingSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [stocktakingSessions]);

  const handleStart = () => {
    const session = startStocktaking();
    toast.success(`تم بدء جلسة جرد جديدة #${session.referenceNumber}`);
    setViewSession(session);
  };

  const currentViewSession = viewSession ? stocktakingSessions.find((s) => s.id === viewSession.id) || viewSession : null;

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="الجرد المخزني"
        subtitle="حصر المخزون الفعلي بالشرنك ومطابقته دفترياً وتسوية الفروقات"
        actions={<Button onClick={() => setConfirmStart(true)}><Plus size={16} /> بدء جلسة جرد</Button>}
      />

      <div className="card p-0 overflow-hidden">
        {sorted.length === 0 ? (
          <EmptyState title="لا توجد جلسات جرد سابقة" icon={ClipboardCheck} description="ابدأ جلسة جرد لمطابقة المخزون الفعلي داخل المخزن بالشرنكات" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>رقم الجرد</th><th>التاريخ</th><th>عدد الأصناف</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id}>
                    <td><span className="font-mono font-bold text-blue-600 dark:text-sky-400">#{s.referenceNumber}</span></td>
                    <td>{formatDate(s.date)}</td>
                    <td>{s.items.length} صنف</td>
                    <td><StatusBadge variant={statusVariant[s.status]}>{STOCKTAKING_STATUS_LABELS[s.status]}</StatusBadge></td>
                    <td><button onClick={() => setViewSession(s)} className="text-sm font-bold text-blue-600 dark:text-sky-400 hover:underline">عرض وتعديل</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={!!viewSession} onClose={() => setViewSession(null)} title={`جلسة جرد #${currentViewSession?.referenceNumber}`} size="xl">
        {currentViewSession && (
          <StocktakingSession
            session={currentViewSession}
            products={products}
            onUpdateItem={updateStocktakingItem}
            onSubmit={submitStocktaking}
            onApprove={approveStocktaking}
            onReject={rejectStocktaking}
            onClose={() => setViewSession(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmStart}
        onClose={() => setConfirmStart(false)}
        onConfirm={handleStart}
        title="بدء جلسة جرد جديدة"
        message="سيقوم النظام بتثبيت الكميات الدفترية الحالية لجميع الأصناف النشطة لتبدأ بإدخال الجرد الفعلي بالشرنكات. هل تريد المتابعة؟"
        confirmText="نعم، ابدأ الجرد"
        variant="primary"
      />
    </div>
  );
}