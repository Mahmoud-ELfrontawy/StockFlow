// STOCKFLOW — WAREHOUSE PAGE
// Complete inventory view showing exact Pallets, Shrinks, and Pieces for:
// 1. Good / Sellable stock (المتاح للتحميل والبيع)
// 2. Company Returns + Pending Inspection (المرتجع للشركة / قيد الفرز)
// 3. Total Physical Stock in Warehouse (الإجمالي الفعلي بالمخزن)

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Warehouse,
  AlertTriangle,
  Layers,
  Package,
  Archive,
  RotateCcw,
  Clock,
} from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';

function QuantityCell({ breakdown, colorClass, subBadge }) {
  if (!breakdown) return <span className="text-gray-400">—</span>;

  const { totalPieces, totalShrinks, loosePieces, fullPallets, remainingShrinks } = breakdown;
  if (totalPieces === 0 && !subBadge) {
    return <span className="text-gray-400">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {/* Pallets (if >= 1 full pallet) */}
      {fullPallets !== 0 && (
        <div className="text-xs font-black text-blue-700 dark:text-sky-400">
          {fullPallets.toLocaleString('en-US')} بالتة
          {remainingShrinks !== 0 && (
            <span className="font-semibold text-gray-500 dark:text-gray-400 mr-1">
              ({remainingShrinks.toLocaleString('en-US')} ش فك)
            </span>
          )}
        </div>
      )}

      {/* Shrinks + Loose Pieces */}
      <div>
        <span className={`font-black text-base ${colorClass}`}>
          {totalShrinks.toLocaleString('en-US')} شرنك
        </span>
        {loosePieces !== 0 && (
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 mr-1">
            +{loosePieces.toLocaleString('en-US')} ق
          </span>
        )}
      </div>

      {/* Exact Total Pieces */}
      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
        ({totalPieces.toLocaleString('en-US')} قطعة)
      </div>

      {subBadge}
    </div>
  );
}

function HeroSummaryCard({
  title,
  icon: Icon,
  cardClass,
  titleClass,
  mainClass,
  pallets,
  remainingShrinks,
  totalShrinks,
  loosePieces,
  totalPieces,
  extraFooter,
  badgeText,
  isGrandTotal = false,
}) {
  return (
    <div className={`card p-6 border ${cardClass}`}>
      <div className={`flex items-center justify-between flex-wrap gap-2 mb-4 ${isGrandTotal ? 'pb-3 border-b border-blue-200/70 dark:border-sky-800/70' : 'justify-center'}`}>
        <div className={`flex items-center gap-2 ${titleClass}`}>
          <Icon size={22} />
          <span className="text-base sm:text-lg font-black">{title}</span>
        </div>
        {badgeText && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white shadow-xs">
            {badgeText}
          </span>
        )}
      </div>

      {/* 3 Breakdown Boxes inside the card: Pallets | Shrinks | Pieces */}
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div className="bg-white/85 dark:bg-slate-900/75 rounded-2xl py-3.5 px-2.5 border border-black/5 dark:border-white/10">
          <span className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 block mb-1">
            بالتات
          </span>
          <span className={`text-3xl sm:text-4xl font-black leading-tight block ${mainClass}`}>
            {pallets.toLocaleString('en-US')}
          </span>
          {remainingShrinks > 0 ? (
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mt-1">
              +{remainingShrinks.toLocaleString('en-US')} ش فك
            </span>
          ) : (
            <span className="text-xs text-gray-400 block mt-1">بالتة مقفولة</span>
          )}
        </div>

        <div className="bg-white/85 dark:bg-slate-900/75 rounded-2xl py-3.5 px-2.5 border border-black/5 dark:border-white/10">
          <span className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 block mb-1">
            شرنكات
          </span>
          <span className={`text-3xl sm:text-4xl font-black leading-tight block ${mainClass}`}>
            {totalShrinks.toLocaleString('en-US')}
          </span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mt-1">
            إجمالي الشرنك
          </span>
        </div>

        <div className="bg-white/85 dark:bg-slate-900/75 rounded-2xl py-3.5 px-2.5 border border-black/5 dark:border-white/10">
          <span className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 block mb-1">
            قطع فرط
          </span>
          <span className="text-3xl sm:text-4xl font-black leading-tight block text-purple-700 dark:text-purple-300">
            {loosePieces.toLocaleString('en-US')}
          </span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mt-1">
            الكل: {totalPieces.toLocaleString('en-US')} ق
          </span>
        </div>
      </div>

      {extraFooter}
    </div>
  );
}

export default function WarehousePage() {
  const { products, stockTransactions, returnTransactions } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const summary = useMemo(
    () => buildWarehouseStockSummary(products, stockTransactions, returnTransactions),
    [products, stockTransactions, returnTransactions]
  );

  const filtered = useMemo(() => {
    return summary.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'low' && p.isLowStock) ||
        (filter === 'ok' && !p.isLowStock) ||
        (filter === 'returns' && (p.companyReturnsStock > 0 || p.pendingReturnsStock > 0));
      return matchSearch && matchFilter;
    });
  }, [summary, search, filter]);

  // Aggregate exact totals across all products
  const totals = useMemo(() => {
    const acc = {
      goodPallets: 0,
      goodRemShrinks: 0,
      goodShrinks: 0,
      goodLoose: 0,
      goodPieces: 0,

      companyPallets: 0,
      companyRemShrinks: 0,
      companyShrinks: 0,
      companyLoose: 0,
      companyPieces: 0,

      pendingShrinks: 0,
      pendingLoose: 0,
      pendingPieces: 0,

      physicalPallets: 0,
      physicalRemShrinks: 0,
      physicalShrinks: 0,
      physicalLoose: 0,
      physicalPieces: 0,
    };

    summary.forEach((p) => {
      acc.goodPallets += p.goodBreakdown.fullPallets;
      acc.goodRemShrinks += p.goodBreakdown.remainingShrinks;
      acc.goodShrinks += p.goodBreakdown.totalShrinks;
      acc.goodLoose += p.goodBreakdown.loosePieces;
      acc.goodPieces += p.currentStock;

      acc.companyPallets += p.companyBreakdown.fullPallets;
      acc.companyRemShrinks += p.companyBreakdown.remainingShrinks;
      acc.companyShrinks += p.companyBreakdown.totalShrinks;
      acc.companyLoose += p.companyBreakdown.loosePieces;
      acc.companyPieces += p.companyReturnsStock;

      acc.pendingShrinks += p.pendingBreakdown.totalShrinks;
      acc.pendingLoose += p.pendingBreakdown.loosePieces;
      acc.pendingPieces += p.pendingReturnsStock;

      acc.physicalPallets += p.physicalBreakdown.fullPallets;
      acc.physicalRemShrinks += p.physicalBreakdown.remainingShrinks;
      acc.physicalShrinks += p.physicalBreakdown.totalShrinks;
      acc.physicalLoose += p.physicalBreakdown.loosePieces;
      acc.physicalPieces += p.totalPhysicalStock;
    });

    return acc;
  }, [summary]);

  const lowCount = summary.filter((p) => p.isLowStock).length;

  return (
    <div className="space-y-5 font-cairo">
      <PageHeader
        title="حالة ورصيد المخزن"
        subtitle={`صالح للبيع: ${totals.goodShrinks.toLocaleString('en-US')} شرنك${totals.goodLoose > 0 ? ` + ${totals.goodLoose} ق` : ''} · مرتجع للشركة: ${totals.companyShrinks.toLocaleString('en-US')} شرنك${totals.companyLoose > 0 ? ` + ${totals.companyLoose} ق` : ''} · الإجمالي الفعلي: ${totals.physicalShrinks.toLocaleString('en-US')} شرنك${totals.physicalLoose > 0 ? ` + ${totals.physicalLoose} ق` : ''}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/returns" className="btn btn-secondary flex items-center gap-2">
              <RotateCcw size={16} />
              <span>إدارة وفرز المرتجعات</span>
            </Link>
            <Link to="/old-stock" className="btn btn-primary flex items-center gap-2">
              <Archive size={16} />
              <span>تسجيل رصيد قديم</span>
            </Link>
          </div>
        }
      />

      {/* Alert Banner when there are unsorted pending returns */}
      {totals.pendingPieces > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-amber-900 dark:text-amber-300">
                ⏳ يوجد {totals.pendingShrinks.toLocaleString('en-US')} شرنك
                {totals.pendingLoose > 0 ? ` + ${totals.pendingLoose.toLocaleString('en-US')} قطعة` : ''} ({totals.pendingPieces.toLocaleString('en-US')} قطعة) مرتجعات "قيد الفحص / الفرز"
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                مخصومة مؤقتاً من الصالح للبيع وموجودة فعلياً بالمخزن. عند فرزها: القطع السليمة تعود لرصيد البيع، والباقي ينتقل إلى "مرتجع للشركة".
              </p>
            </div>
          </div>
          <Link
            to="/returns"
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            فرز واعتماد المرتجعات
          </Link>
        </div>
      )}

      {/* Row 1: Card 1 (Good for Sale) & Card 2 (Company Returns) Side by Side */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Sellable / Good Stock */}
          <HeroSummaryCard
            title="1. الصالح للبيع (المتاح للتحميل)"
            icon={Package}
            cardClass="bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
            titleClass="text-emerald-800 dark:text-emerald-300"
            mainClass="text-emerald-900 dark:text-emerald-300"
            pallets={totals.goodPallets}
            remainingShrinks={totals.goodRemShrinks}
            totalShrinks={totals.goodShrinks}
            loosePieces={totals.goodLoose}
            totalPieces={totals.goodPieces}
            extraFooter={
              <p className={`text-xs text-center font-bold ${lowCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {lowCount > 0 ? `⚠️ ${lowCount} أصناف أقل من حد الأمان` : '✓ كل الأصناف في مستوى جيد'}
              </p>
            }
          />

          {/* 2. Company Returns */}
          <HeroSummaryCard
            title="2. مرتجع هيرجع للشركة"
            icon={RotateCcw}
            cardClass="bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
            titleClass="text-rose-800 dark:text-rose-300"
            mainClass="text-rose-900 dark:text-rose-300"
            pallets={totals.companyPallets}
            remainingShrinks={totals.companyRemShrinks}
            totalShrinks={totals.companyShrinks}
            loosePieces={totals.companyLoose}
            totalPieces={totals.companyPieces}
            extraFooter={
              <div className="flex items-center justify-center gap-2 text-xs">
                {totals.pendingPieces > 0 && (
                  <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-lg font-bold">
                    + {totals.pendingShrinks} ش {totals.pendingLoose > 0 ? `+ ${totals.pendingLoose} ق` : ''} قيد الفحص
                  </span>
                )}
                {totals.companyPieces === 0 && totals.pendingPieces === 0 && (
                  <span className="text-gray-500 font-semibold">لا توجد مرتجعات للشركة حالياً</span>
                )}
                {totals.companyPieces > 0 && (
                  <Link to="/returns" className="text-rose-700 dark:text-rose-400 font-bold hover:underline">
                    تسليم أو متابعة من صفحة المرتجعات ←
                  </Link>
                )}
              </div>
            }
          />
        </div>

        {/* Visual Divider + Standalone Card 3: Total Physical Warehouse */}
        <div className="pt-2 border-t-2 border-dashed border-gray-200 dark:border-slate-800">
          <HeroSummaryCard
            isGrandTotal
            badgeText="المرجع النهائي للمخزن"
            title="3. إجمالي المخزن الفعلي (كله على بعضه)"
            icon={Layers}
            cardClass="bg-gradient-to-l from-blue-50 via-sky-50/70 to-blue-50 dark:from-sky-950/40 dark:via-slate-900 dark:to-sky-950/40 border-2 border-blue-400 dark:border-sky-700 shadow-md"
            titleClass="text-blue-900 dark:text-sky-200"
            mainClass="text-blue-900 dark:text-sky-300"
            pallets={totals.physicalPallets}
            remainingShrinks={totals.physicalRemShrinks}
            totalShrinks={totals.physicalShrinks}
            loosePieces={totals.physicalLoose}
            totalPieces={totals.physicalPieces}
            extraFooter={
              <p className="text-xs text-center text-blue-800 dark:text-sky-300 font-bold">
                مجموع البضاعة الصالحة للبيع + المرتجع للشركة{totals.pendingPieces > 0 ? ' + قيد الفحص' : ''} (كل البضاعة الموجودة على أرض المخزن)
              </p>
            }
          />
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو SKU..." />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ['all', 'الكل'],
              ['ok', 'مستوى جيد'],
              ['low', 'منخفض'],
              ['returns', 'عليه مرتجعات'],
            ].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  filter === val
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

      {/* Detailed Table per Product */}
      <div className="card p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="لا توجد أصناف مطابقة في المخزن" icon={Warehouse} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th className="text-center">معدل البالتة</th>
                  <th className="text-center">المستلم</th>
                  <th className="text-center">المحمّل</th>
                  <th className="text-center">تالف مشطوب</th>
                  <th className="text-center bg-emerald-50/60 dark:bg-emerald-950/20 font-bold text-emerald-900 dark:text-emerald-300">
                    الصالح للبيع (بالتة / شرنك / قطعة)
                  </th>
                  <th className="text-center bg-rose-50/60 dark:bg-rose-950/20 font-bold text-rose-900 dark:text-rose-300">
                    مرتجع للشركة (بالتة / شرنك / قطعة)
                  </th>
                  <th className="text-center bg-blue-50/60 dark:bg-sky-950/20 font-bold text-blue-900 dark:text-sky-300">
                    الإجمالي الفعلي بالمخزن
                  </th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const pPerShrink = p.piecesPerShrink || 24;
                  const sPerPallet = p.shrinksPerPallet || 169;

                  const receivedShrinks = Math.floor(p.totalReceived / pPerShrink);
                  const dispatchedShrinks = Math.floor(p.totalDispatched / pPerShrink);
                  const damagedShrinks = Math.floor(p.totalDamaged / pPerShrink);

                  const pendingBadge =
                    p.pendingReturnsStock > 0 ? (
                      <span className="inline-block mt-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                        ⏳ +{p.pendingBreakdown.totalShrinks} ش
                        {p.pendingBreakdown.loosePieces > 0
                          ? ` + ${p.pendingBreakdown.loosePieces} ق`
                          : ''}{' '}
                        قيد الفحص
                      </span>
                    ) : null;

                  return (
                    <tr key={p.id}>
                      {/* Product Name & SKU */}
                      <td>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-slate-100">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.sku} {p.packageSize ? `· ${p.packageSize}` : ''}
                          </p>
                        </div>
                      </td>

                      {/* Packaging specs */}
                      <td className="text-center text-xs text-gray-500 font-semibold">
                        <span>{sPerPallet} ش/بالتة</span>
                        <span className="block text-[11px] text-gray-400">({pPerShrink} ق/شرنك)</span>
                      </td>

                      {/* Received */}
                      <td className="text-center font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                        {receivedShrinks > 0 ? (
                          <div>
                            <span>{receivedShrinks.toLocaleString('en-US')} شرنك</span>
                            {receivedShrinks >= sPerPallet && (
                              <span className="block text-[10px] text-blue-600 dark:text-sky-400">
                                ({Math.floor(receivedShrinks / sPerPallet)} بالتة)
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Dispatched */}
                      <td className="text-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {dispatchedShrinks > 0 ? (
                          <div>
                            <span>{dispatchedShrinks.toLocaleString('en-US')} شرنك</span>
                            <span className="block text-[10px] text-gray-400 font-normal">
                              ({p.totalDispatched.toLocaleString('en-US')} ق)
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Written-off Warehouse Damage */}
                      <td className="text-center font-semibold text-rose-600 dark:text-rose-400 text-xs">
                        {damagedShrinks > 0 ? `${damagedShrinks.toLocaleString('en-US')} ش` : '—'}
                      </td>

                      {/* 1. Available Good Stock */}
                      <td className="text-center bg-emerald-50/40 dark:bg-emerald-950/15">
                        <QuantityCell
                          breakdown={p.goodBreakdown}
                          colorClass="text-emerald-800 dark:text-emerald-300"
                        />
                      </td>

                      {/* 2. Company Returns (+ pending badge if any) */}
                      <td className="text-center bg-rose-50/40 dark:bg-rose-950/15">
                        <QuantityCell
                          breakdown={p.companyBreakdown}
                          colorClass="text-rose-800 dark:text-rose-300"
                          subBadge={pendingBadge}
                        />
                      </td>

                      {/* 3. Total Physical Stock */}
                      <td className="text-center bg-blue-50/40 dark:bg-sky-950/20">
                        <QuantityCell
                          breakdown={p.physicalBreakdown}
                          colorClass="text-blue-900 dark:text-sky-300"
                        />
                      </td>

                      {/* Status badge */}
                      <td>
                        <StatusBadge variant={p.isLowStock ? 'warning' : 'success'}>
                          {p.isLowStock ? (
                            <>
                              <AlertTriangle size={11} /> منخفض
                            </>
                          ) : (
                            'جيد'
                          )}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
