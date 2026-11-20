// ============================================================
// STOCKFLOW — SIDEBAR
// Navigation sidebar with all 13 modules.
// ============================================================

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Warehouse,
  PackagePlus,
  Truck,
  Users,
  ClipboardList,
  RotateCcw,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Settings,
  X,
  Zap,
} from 'lucide-react';
import useInventoryStore from '../../store/inventoryStore';
import { buildWarehouseStockSummary } from '../../utils/stockCalculations';

const NAV_ITEMS = [
  { to: '/',                    icon: LayoutDashboard, label: 'لوحة التحكم',       end: true },
  { to: '/products',            icon: Package,          label: 'المنتجات' },
  { to: '/warehouse',           icon: Warehouse,        label: 'المخزن' },
  { to: '/stock-in',            icon: PackagePlus,      label: 'استلام بضاعة' },
  { to: '/loading',             icon: Truck,            label: 'التحميل' },
  { to: '/salesmen',            icon: Users,            label: 'المندوبون' },
  { to: '/salesman-balances',   icon: ClipboardList,    label: 'عهدة المندوبين' },
  { to: '/returns',             icon: RotateCcw,        label: 'المرتجعات' },
  { to: '/damaged-goods',       icon: AlertTriangle,    label: 'البضاعة التالفة' },
  { to: '/stock-ledger',        icon: BookOpen,         label: 'دفتر الحركة' },
  { to: '/stocktaking',         icon: ClipboardCheck,   label: 'الجرد' },
  { to: '/reports',             icon: BarChart3,        label: 'التقارير' },
  { to: '/settings',            icon: Settings,         label: 'الإعدادات' },
];

export default function Sidebar({ isOpen, onClose }) {
  const { products, stockTransactions } = useInventoryStore();

  const lowStockCount = products.filter((p) => {
    if (!p.isActive) return false;
    const { buildWarehouseStockSummary: _ } = { buildWarehouseStockSummary };
    return true;
  }).length;

  // Calculate low stock items
  const stockSummary = buildWarehouseStockSummary(products, stockTransactions);
  const lowCount = stockSummary.filter((p) => p.isLowStock).length;

  return (
    <aside
      className={`
        fixed top-0 right-0 h-full w-64 bg-[#1E3A5F] z-30
        transform transition-transform duration-300 ease-in-out flex flex-col
        lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">ستوك فلو</h1>
            <p className="text-blue-300 text-xs mt-0.5">إدارة المخازن</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-white/60 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Low stock alert */}
      {lowCount > 0 && (
        <div className="mx-3 mt-3 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl">
          <p className="text-amber-300 text-xs font-medium flex items-center gap-2">
            <AlertTriangle size={13} />
            {lowCount} منتج على وشك النفاد
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 mt-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
            }
          >
            <item.icon size={18} className="shrink-0" />
            <span>{item.label}</span>
            {item.to === '/warehouse' && lowCount > 0 && (
              <span className="mr-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {lowCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <p className="text-white/40 text-xs text-center">
          ستوك فلو v1.0 — بيانات محلية فقط
        </p>
      </div>
    </aside>
  );
}
