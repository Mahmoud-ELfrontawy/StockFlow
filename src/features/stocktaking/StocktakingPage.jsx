// STOCKFLOW — STOCKTAKING PAGE
import { useState, useMemo } from 'react';
import {
  Plus,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Package,
  Scale,
  TrendingUp,
  TrendingDown,
  Equal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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

function StocktakingSession({
  session,
  products,
  onSave,
  onApprove,
  onReject,
  onClose,
}) {
  const [manualShrinks, setManualShrinks] = useState(
    session.manualShrinks !== undefined && session.manualShrinks !== null ? String(session.manualShrinks) : ''
  );
  const [manualLoosePieces, setManualLoosePieces] = useState(
    session.manualLoosePieces !== undefined && session.manualLoosePieces !== null ? String(session.manualLoosePieces) : ''
  );
  const [showDetailsTable, setShowDetailsTable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [localItems, setLocalItems] = useState(
    session.items.map((i) => {
      const prod = products.find((p) => p.id === i.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const hasPhys = i.physicalQuantity !== null && i.physicalQuantity !== undefined;
      return {
        ...i,
        inputShrinks: hasPhys ? String(Math.floor(i.physicalQuantity / pShrink)) : '',
        inputPieces: hasPhys ? String(i.physicalQuantity % pShrink) : '',
      };
    })
  );

  // ── Part 1: Automatic System Totals (All Warehouse Stock) ──────
  const systemTotals = useMemo(() => {
    let totalPieces = 0;
    let totalShrinks = 0;
    let totalLoosePieces = 0;

    session.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const qty = item.systemQuantity || 0;
      totalPieces += qty;
      totalShrinks += Math.floor(qty / pShrink);
      totalLoosePieces += qty % pShrink;
    });

    // Normalize extra loose pieces into shrinks if they exceed 24
    const extraShrinksFromLoose = Math.floor(totalLoosePieces / 24);
    const displayShrinks = totalShrinks + extraShrinksFromLoose;
    const displayLoosePieces = totalLoosePieces % 24;

    const fullPallets = Math.floor(displayShrinks / 169);
    const remShrinks = displayShrinks % 169;

    return {
      totalPieces,
      totalShrinks: displayShrinks,
      totalLoosePieces: displayLoosePieces,
      fullPallets,
      remShrinks,
    };
  }, [session.items, products]);

  // ── Part 2: User Actual Count & Live Comparison ────────────────
  const hasManualEntry = manualShrinks !== '' || manualLoosePieces !== '';
  const actualShrinksNum = parseInt(manualShrinks || '0', 10) || 0;
  const actualLooseNum = parseInt(manualLoosePieces || '0', 10) || 0;
  const actualTotalPieces = actualShrinksNum * 24 + actualLooseNum;

  const diffPieces = hasManualEntry ? actualTotalPieces - systemTotals.totalPieces : null;
  const diffShrinksAbs = diffPieces !== null ? Math.floor(Math.abs(diffPieces) / 24) : 0;
  const diffLooseAbs = diffPieces !== null ? Math.abs(diffPieces) % 24 : 0;

  const handleItemChange = (productId, field, val) => {
    setLocalItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, [field]: val } : i))
    );
  };

  // Helper: fill manual totals from detailed item inputs
  const syncTotalsFromItems = () => {
    let sumShrinks = 0;
    let sumLoose = 0;
    let anyEntered = false;
    localItems.forEach((item) => {
      if (item.inputShrinks !== '' || item.inputPieces !== '') {
        anyEntered = true;
        sumShrinks += parseInt(item.inputShrinks || '0', 10) || 0;
        sumLoose += parseInt(item.inputPieces || '0', 10) || 0;
      }
    });
    if (!anyEntered) {
      toast.error('يرجى إدخال كميات في جدول الأصناف أولاً');
      return;
    }
    const normalizedShrinks = sumShrinks + Math.floor(sumLoose / 24);
    const normalizedLoose = sumLoose % 24;
    setManualShrinks(String(normalizedShrinks));
    setManualLoosePieces(String(normalizedLoose));
    toast.success('تم تجميع الكميات من جدول الأصناف إلى الجرد الإجمالي');
  };

  const handleSave = async (submit = false) => {
    setIsSaving(true);
    const updates = localItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      const hasInput = item.inputShrinks !== '' || item.inputPieces !== '';
      const shrinks = parseInt(item.inputShrinks || '0', 10) || 0;
      const pieces = parseInt(item.inputPieces || '0', 10) || 0;
      return {
        productId: item.productId,
        physicalQuantity: hasInput ? shrinks * pShrink + pieces : null,
        notes: item.notes || '',
      };
    });
    const result = await onSave(session.id, {
      manualShrinks: manualShrinks === '' ? null : actualShrinksNum,
      manualLoosePieces: manualLoosePieces === '' ? null : actualLooseNum,
      items: updates,
      submit,
    });
    setIsSaving(false);

    if (!result?.success) {
      toast.error(result?.message || 'تعذر حفظ بيانات الجرد');
      return false;
    }

    toast.success(submit ? 'تم حفظ الجرد ورفعه للمراجعة' : 'تم حفظ بيانات الجرد والمقارنة');
    if (submit) onClose();
    return true;
  };

  const isDraft = session.status === STOCKTAKING_STATUS.DRAFT;
  const isEditable = isDraft || session.status === STOCKTAKING_STATUS.PENDING || session.status === STOCKTAKING_STATUS.APPROVED;

  return (
    <div className="space-y-5 font-cairo">
      {/* Header Meta */}
      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3 text-sm border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-500">تاريخ الجرد:</span>{' '}
            <strong className="font-mono">{formatDate(session.date)}</strong>
          </div>
          <div>
            <span className="text-gray-500">عدد الأصناف:</span>{' '}
            <strong>{session.items.length.toLocaleString('en-US')} صنف</strong>
          </div>
        </div>
        <div>
          <span className="text-gray-500 ml-2">الحالة:</span>
          <StatusBadge variant={statusVariant[session.status]}>
            {STOCKTAKING_STATUS_LABELS[session.status]}
          </StatusBadge>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PART 1 & PART 2: TWO MAIN SECTIONS SIDE BY SIDE
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PART 1: Automatic System Totals */}
        <div className="bg-blue-50/70 dark:bg-sky-950/30 border border-blue-200 dark:border-sky-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-blue-900 dark:text-sky-300 font-bold text-sm">
            <Package size={18} className="text-blue-600 dark:text-sky-400" />
            <span>الجزء الأول: رصيد الموقع التلقائي (المخزن كامل)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900/90 rounded-xl p-3 border border-blue-100 dark:border-sky-900 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                إجمالي الشرنكات بالموقع
              </span>
              <span className="text-2xl font-black text-blue-800 dark:text-sky-300">
                {systemTotals.totalShrinks.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-bold text-blue-600 dark:text-sky-400 mr-1">شرنك</span>
            </div>

            <div className="bg-white dark:bg-slate-900/90 rounded-xl p-3 border border-blue-100 dark:border-sky-900 text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                القطع الفرط بالموقع
              </span>
              <span className="text-2xl font-black text-purple-700 dark:text-purple-300">
                {systemTotals.totalLoosePieces.toLocaleString('en-US')}
              </span>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 mr-1">قطعة</span>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between flex-wrap gap-2 border border-blue-100/80 dark:border-sky-900/60">
            <span>
              {systemTotals.fullPallets > 0 ? (
                <>
                  يشمل{' '}
                  <strong className="text-blue-700 dark:text-sky-400">
                    {systemTotals.fullPallets.toLocaleString('en-US')} بالتة × 169
                  </strong>
                  {systemTotals.remShrinks > 0 && ` + ${systemTotals.remShrinks.toLocaleString('en-US')} شرنك فك`}
                </>
              ) : (
                'أقل من بالتة كاملة (169 شرنك)'
              )}
            </span>
            <span className="font-bold text-gray-800 dark:text-slate-200">
              الإجمالي: {systemTotals.totalPieces.toLocaleString('en-US')} قطعة
            </span>
          </div>
        </div>

        {/* PART 2: Manual Physical Count by User */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-bold text-sm">
              <ClipboardCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
              <span>الجزء الثاني: جردك الفعلي في المخزن</span>
            </div>
            {isEditable && session.items.length > 0 && (
              <button
                type="button"
                onClick={syncTotalsFromItems}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                title="تجميع الأرقام من جدول الأصناف بالأسفل"
              >
                استيراد من جدول الأصناف ↓
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                عدد الشرنكات الفعلي
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  disabled={!isEditable}
                  value={manualShrinks}
                  onChange={(e) => setManualShrinks(e.target.value)}
                  className="form-input text-center font-black text-xl py-2 bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700"
                  placeholder="0"
                />
                <span className="text-[11px] text-gray-400 block text-center mt-0.5">شرنك</span>
              </div>
            </div>

            <div>
              <label className="form-label text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">
                عدد القطع الفرط الفعلي
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  disabled={!isEditable}
                  value={manualLoosePieces}
                  onChange={(e) => setManualLoosePieces(e.target.value)}
                  className="form-input text-center font-black text-xl py-2 bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700"
                  placeholder="0"
                />
                <span className="text-[11px] text-gray-400 block text-center mt-0.5">قطعة فرط</span>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between border border-emerald-100 dark:border-emerald-900">
            <span>إجمالي جردك المحسوب:</span>
            <span className="font-bold text-emerald-800 dark:text-emerald-300">
              {hasManualEntry
                ? `${actualShrinksNum.toLocaleString('en-US')} شرنك + ${actualLooseNum.toLocaleString('en-US')} قطعة (${actualTotalPieces.toLocaleString('en-US')} ق)`
                : 'لم يتم إدخال جرد فعلي بعد'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          LIVE COMPARISON CARD (SYSTEM vs USER)
      ═══════════════════════════════════════════════════════════ */}
      {hasManualEntry && (
        <div
          className={`rounded-2xl p-4 border-2 transition-all ${
            diffPieces === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
              : diffPieces > 0
              ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-400 dark:border-sky-700'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-400 dark:border-rose-700'
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Scale size={18} />
              <span>نتيجة المقارنة (بيانات الموقع مقابل جردك الفعلي)</span>
            </div>

            {diffPieces === 0 ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                <Equal size={14} /> مطابق تماماً (لا يوجد عجز أو زيادة)
              </span>
            ) : diffPieces > 0 ? (
              <span className="inline-flex items-center gap-1.5 bg-sky-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                <TrendingUp size={14} /> زيادة فعلية في المخزن
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                <TrendingDown size={14} /> عجز في المخزن الفعلي
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800">
              <span className="text-xs text-gray-500 block">بيانات الموقع (النظام)</span>
              <strong className="text-base text-blue-800 dark:text-sky-300 block mt-0.5">
                {systemTotals.totalShrinks.toLocaleString('en-US')} شرنك +{' '}
                {systemTotals.totalLoosePieces.toLocaleString('en-US')} ق
              </strong>
              <span className="text-[11px] text-gray-400">
                ({systemTotals.totalPieces.toLocaleString('en-US')} قطعة)
              </span>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800">
              <span className="text-xs text-gray-500 block">بياناتك (الجرد الفعلي)</span>
              <strong className="text-base text-emerald-800 dark:text-emerald-300 block mt-0.5">
                {actualShrinksNum.toLocaleString('en-US')} شرنك +{' '}
                {actualLooseNum.toLocaleString('en-US')} ق
              </strong>
              <span className="text-[11px] text-gray-400">
                ({actualTotalPieces.toLocaleString('en-US')} قطعة)
              </span>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-3 border border-gray-200 dark:border-slate-800">
              <span className="text-xs text-gray-500 block">الفرق</span>
              <strong
                className={`text-base block mt-0.5 ${
                  diffPieces === 0
                    ? 'text-emerald-600'
                    : diffPieces > 0
                    ? 'text-sky-600'
                    : 'text-rose-600'
                }`}
              >
                {diffPieces === 0
                  ? '0 شرنك (مطابق)'
                  : `${diffPieces > 0 ? '+' : '-'}${diffShrinksAbs.toLocaleString('en-US')} شرنك${
                      diffLooseAbs > 0 ? ` و ${diffLooseAbs.toLocaleString('en-US')} ق` : ''
                    }`}
              </strong>
              <span className="text-[11px] text-gray-400">
                ({diffPieces > 0 ? '+' : ''}
                {diffPieces.toLocaleString('en-US')} قطعة)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          DETAILED PER-PRODUCT TABLE (Collapsible)
      ═══════════════════════════════════════════════════════════ */}
      <div className="border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDetailsTable((v) => !v)}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300 cursor-pointer"
        >
          <span>تفاصيل الجرد حسب كل صنف ({localItems.length.toLocaleString('en-US')} صنف)</span>
          {showDetailsTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetailsTable && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th className="text-center">رصيد الموقع</th>
                  <th className="text-center bg-blue-50/40 dark:bg-sky-950/20 font-bold">
                    الجرد الفعلي (شرنك + فرط)
                  </th>
                  <th className="text-center">الفرق</th>
                </tr>
              </thead>
              <tbody>
                {localItems.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  const pShrink = product?.piecesPerShrink || 24;
                  const systemShrinks = Math.floor(item.systemQuantity / pShrink);
                  const systemLoose = item.systemQuantity % pShrink;

                  const hasPhysInput = item.inputShrinks !== '' || item.inputPieces !== '';
                  const physShrinks = parseInt(item.inputShrinks || '0', 10) || 0;
                  const physLoose = parseInt(item.inputPieces || '0', 10) || 0;
                  const physicalPieces = hasPhysInput ? physShrinks * pShrink + physLoose : null;
                  const variancePieces = physicalPieces !== null ? physicalPieces - item.systemQuantity : null;
                  const varianceShrinks =
                    variancePieces !== null ? Math.trunc(variancePieces / pShrink) : null;

                  return (
                    <tr key={item.productId}>
                      <td className="font-medium">
                        <p className="font-bold text-gray-900 dark:text-slate-100">
                          {product?.name || item.productId}
                        </p>
                        <p className="text-xs text-gray-400">
                          {product?.sku} · {pShrink} ق/ش
                        </p>
                      </td>
                      <td className="text-center">
                        <span className="font-bold text-gray-800 dark:text-slate-200">
                          {systemShrinks.toLocaleString('en-US')} شرنك
                          {systemLoose > 0 && ` + ${systemLoose.toLocaleString('en-US')} ق`}
                        </span>
                        <span className="block text-[11px] text-gray-400">
                          ({item.systemQuantity.toLocaleString('en-US')} قطعة)
                        </span>
                      </td>
                      <td className="text-center bg-blue-50/30 dark:bg-sky-950/10">
                        {isEditable ? (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <input
                              type="number"
                              min="0"
                              value={item.inputShrinks}
                              onChange={(e) => handleItemChange(item.productId, 'inputShrinks', e.target.value)}
                              className="form-input text-center w-20 text-sm py-1 font-bold"
                              placeholder="شرنك"
                            />
                            <span className="text-xs text-gray-400">+</span>
                            <input
                              type="number"
                              min="0"
                              value={item.inputPieces}
                              onChange={(e) => handleItemChange(item.productId, 'inputPieces', e.target.value)}
                              className="form-input text-center w-20 text-sm py-1 font-bold"
                              placeholder="فرط"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-blue-700 dark:text-sky-300">
                              {item.physicalQuantity !== null && item.physicalQuantity !== undefined
                                ? `${Math.floor(item.physicalQuantity / pShrink).toLocaleString('en-US')} شرنك${
                                    item.physicalQuantity % pShrink > 0
                                      ? ` + ${(item.physicalQuantity % pShrink).toLocaleString('en-US')} ق`
                                      : ''
                                  }`
                                : '—'}
                            </span>
                            {item.physicalQuantity !== null && item.physicalQuantity !== undefined && (
                              <span className="block text-[11px] text-gray-400">
                                ({item.physicalQuantity.toLocaleString('en-US')} قطعة)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        {variancePieces !== null && (
                          <div>
                            <span
                              className={`font-bold ${
                                variancePieces > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : variancePieces < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              {varianceShrinks > 0 ? '+' : ''}
                              {varianceShrinks.toLocaleString('en-US')} شرنك
                            </span>
                            <span className="block text-[11px] text-gray-400">
                              ({variancePieces > 0 ? '+' : ''}
                              {variancePieces.toLocaleString('en-US')} ق)
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
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-3 flex-wrap pt-2">
        {isDraft && (
          <>
            <Button variant="secondary" loading={isSaving} onClick={() => handleSave(false)}>
              حفظ الجرد والمقارنة
            </Button>
            <Button
              loading={isSaving}
              onClick={() => handleSave(true)}
            >
              رفع للمراجعة
            </Button>
          </>
        )}
        {session.status === STOCKTAKING_STATUS.PENDING && (
          <Button variant="secondary" loading={isSaving} onClick={() => handleSave(false)}>
            حفظ التعديلات
          </Button>
        )}
        {session.status === STOCKTAKING_STATUS.APPROVED && (
          <Button variant="secondary" loading={isSaving} onClick={() => handleSave(false)}>
            حفظ تصحيح الجرد
          </Button>
        )}
        {session.status === STOCKTAKING_STATUS.PENDING && (
          <>
            <Button
              variant="danger"
              onClick={async () => {
                const result = await onReject(session.id);
                if (result?.success) {
                  toast.success('تم رفض الجرد');
                  onClose();
                } else toast.error(result?.message || 'تعذر رفض الجرد');
              }}
            >
              <XCircle size={16} /> رفض
            </Button>
            <Button
              variant="success"
              onClick={async () => {
                const saved = await handleSave(false);
                if (!saved) return;
                const result = await onApprove(session.id);
                if (result?.success) {
                  toast.success('تم اعتماد الجرد وتسوية المخزون آلياً');
                  onClose();
                } else toast.error(result?.message || 'تعذر اعتماد الجرد');
              }}
            >
              <CheckCircle size={16} /> اعتماد وتسوية الفروقات
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </div>
  );
}

export default function StocktakingPage() {
  const {
    products,
    stocktakingSessions,
    startStocktaking,
    saveStocktakingData,
    approveStocktaking,
    rejectStocktaking,
  } = useInventoryStore();
  const [viewSession, setViewSession] = useState(null);
  const [confirmStart, setConfirmStart] = useState(false);

  const sorted = useMemo(
    () => [...stocktakingSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [stocktakingSessions]
  );

  const handleStart = async () => {
    const session = await startStocktaking();
    toast.success(`تم بدء جلسة جرد جديدة #${session.referenceNumber}`);
    setViewSession(session);
  };

  const currentViewSession = viewSession
    ? stocktakingSessions.find((s) => s.id === viewSession.id) || viewSession
    : null;

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="الجرد المخزني"
        subtitle="حصر المخزون الفعلي بالشرنك والقطع الفرط ومطابقته تلقائياً مع رصيد الموقع"
        actions={
          <Button onClick={() => setConfirmStart(true)}>
            <Plus size={16} /> بدء جلسة جرد
          </Button>
        }
      />

      <div className="card p-0 overflow-hidden">
        {sorted.length === 0 ? (
          <EmptyState
            title="لا توجد جلسات جرد سابقة"
            icon={ClipboardCheck}
            description="ابدأ جلسة جرد ليجمع لك النظام رصيد المخزن تلقائياً وتقارنه بجردك الفعلي"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم الجرد</th>
                  <th>التاريخ</th>
                  <th>إجمالي الموقع</th>
                  <th>جردك الفعلي</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const sysPieces = s.items.reduce((sum, i) => sum + (i.systemQuantity || 0), 0);
                  const sysShrinks = s.items.reduce((sum, i) => {
                    const p = products.find((pr) => pr.id === i.productId);
                    return sum + Math.floor((i.systemQuantity || 0) / (p?.piecesPerShrink || 24));
                  }, 0);
                  const hasManual = s.manualShrinks !== null && s.manualShrinks !== undefined;

                  return (
                    <tr key={s.id}>
                      <td>
                        <span className="font-mono font-bold text-blue-600 dark:text-sky-400">
                          #{s.referenceNumber}
                        </span>
                      </td>
                      <td>{formatDate(s.date)}</td>
                      <td className="text-xs font-bold text-gray-700 dark:text-slate-300">
                        {sysShrinks.toLocaleString('en-US')} شرنك ({sysPieces.toLocaleString('en-US')} ق)
                      </td>
                      <td className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {hasManual
                          ? `${s.manualShrinks.toLocaleString('en-US')} شرنك${
                              s.manualLoosePieces > 0 ? ` + ${s.manualLoosePieces} ق` : ''
                            }`
                          : '—'}
                      </td>
                      <td>
                        <StatusBadge variant={statusVariant[s.status]}>
                          {STOCKTAKING_STATUS_LABELS[s.status]}
                        </StatusBadge>
                      </td>
                      <td>
                        <button
                          onClick={() => setViewSession(s)}
                          className="text-sm font-bold text-blue-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          عرض ومقارنة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!viewSession}
        onClose={() => setViewSession(null)}
        title={`جلسة جرد #${currentViewSession?.referenceNumber}`}
        size="xl"
      >
        {currentViewSession && (
          <StocktakingSession
            session={currentViewSession}
            products={products}
            onSave={saveStocktakingData}
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
        message="سيقوم النظام بتجميع إجمالي الشرنكات والقطع الفرط الموجودة في المخزن تلقائياً، لتتمكن من إدخال جردك الفعلي ومقارنته مباشرة. هل تريد المتابعة؟"
        confirmText="نعم، ابدأ الجرد"
        variant="primary"
      />
    </div>
  );
}
