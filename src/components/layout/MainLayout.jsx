// ============================================================
// STOCKFLOW — MAIN LAYOUT
// Persistent sidebar + header + content area with ThemeProvider.
// ============================================================

import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import Header from './Header';
import useInventoryStore from '../../store/inventoryStore';
import { ThemeProvider, useTheme } from '../../context/ThemeContext';

function LayoutContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { initialize, isLoaded } = useInventoryStore();
  const { isDark } = useTheme();

  useEffect(() => {
    initialize();
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFC] dark:bg-[#0B0F19]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">جاري تحميل بيانات المخزن...</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">تهيئة قاعدة البيانات (IndexedDB)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F1F5F9] transition-colors duration-200" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[#F8FAFC] dark:bg-[#0B0F19] transition-colors duration-200">
          <Outlet />
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: 'Cairo, sans-serif',
            fontSize: '14px',
            direction: 'rtl',
            background: isDark ? '#1E293B' : '#FFFFFF',
            color: isDark ? '#F1F5F9' : '#1F2937',
            border: isDark ? '1px solid #334155' : '1px solid #E2E8F0',
          },
          success: {
            iconTheme: { primary: '#16A34A', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#DC2626', secondary: '#fff' },
          },
        }}
      />
    </div>
  );
}

export default function MainLayout() {
  return (
    <ThemeProvider>
      <LayoutContent />
    </ThemeProvider>
  );
}
