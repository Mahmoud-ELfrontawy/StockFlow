// ============================================================
// STOCKFLOW — HEADER
// Top application header with theme toggle, breadcrumb, and menu.
// ============================================================

import { Menu, Database, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import useInventoryStore from '../../store/inventoryStore';
import { useTheme } from '../../context/ThemeContext';

const ROUTE_LABELS = {
  '/':                   'لوحة التحكم',
  '/products':           'المنتجات',
  '/warehouse':          'المخزن',
  '/stock-in':           'استلام البضاعة',
  '/loading':            'عمليات التحميل',
  '/salesmen':           'المندوبون',
  '/salesman-balances':  'عهدة المندوبين',
  '/returns':            'المرتجعات',
  '/damaged-goods':      'البضاعة التالفة',
  '/stock-ledger':       'دفتر الحركة',
  '/stocktaking':        'الجرد',
  '/reports':            'التقارير',
  '/settings':           'الإعدادات',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const { settings } = useInventoryStore();
  const { isDark, toggleTheme } = useTheme();
  const pageTitle = ROUTE_LABELS[location.pathname] || 'ستوك فلو';

  const today = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="h-16 bg-white dark:bg-[#131B2E] border-b border-gray-100 dark:border-slate-800 flex items-center px-4 lg:px-6 gap-4 shrink-0 shadow-sm transition-colors duration-200">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{pageTitle}</h2>
        <p className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block">{today}</p>
      </div>

      {/* Warehouse name */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50">
        <Database size={14} className="text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          {settings?.warehouseName || 'مخزن الشركة'}
        </span>
      </div>

      {/* Dark / Light Mode Toggle Button */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-amber-400 dark:hover:bg-slate-800 transition-colors flex items-center justify-center border border-gray-200 dark:border-slate-700"
        title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        aria-label="تبديل المظهر"
      >
        {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
      </button>

      {/* Storage indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/50">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300 hidden sm:block">
          قاعدة بيانات محلية
        </span>
      </div>
    </header>
  );
}
