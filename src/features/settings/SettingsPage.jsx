// STOCKFLOW — SETTINGS PAGE (Dexie + Integrity + Storage Monitor)
import { useState, useEffect } from 'react';
import { Save, Download, Upload, RotateCcw, Database, Shield, HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useInventoryStore from '../../store/inventoryStore';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';

export default function SettingsPage() {
  const {
    settings, updateSettings,
    exportBackup, importBackup, resetToDemo, startEmpty,
    runIntegrityCheck, getStorageEstimate, getLastBackupAge,
  } = useInventoryStore();

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [lastBackup, setLastBackup] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { register, handleSubmit } = useForm({ defaultValues: settings });

  useEffect(() => {
    // Load storage info and backup age on mount
    getStorageEstimate().then(setStorageInfo);
    getLastBackupAge().then(setLastBackup);
  }, []);

  const handleSave = async (data) => {
    await updateSettings(data);
    toast.success('تم حفظ إعدادات المخزن بنجاح');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`تم تصدير النسخة الاحتياطية (${backup.recordCounts?.stockTransactions || 0} حركة)`);
      // Refresh backup age
      getLastBackupAge().then(setLastBackup);
    } catch (err) {
      toast.error(`فشل التصدير: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backup = JSON.parse(evt.target.result);
        const result = await importBackup(backup);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        toast.error(`ملف غير صالح: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleIntegrityCheck = async () => {
    setIntegrityLoading(true);
    try {
      const result = await runIntegrityCheck();
      setIntegrityResult(result);
      if (result.isClean) {
        toast.success('فحص سلامة البيانات: لا توجد مشاكل');
      } else {
        toast.error(`فحص سلامة البيانات: ${result.issueCount} مشكلة`);
      }
    } catch (err) {
      toast.error(`فشل الفحص: ${err.message}`);
    } finally {
      setIntegrityLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const backupOverdue = lastBackup?.daysSince > 3;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="الإعدادات والنسخ الاحتياطي" subtitle="إعدادات المخزن، تأمين البيانات، وسلامة قاعدة البيانات" />

      {/* Backup overdue alert */}
      {backupOverdue && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">تنبيه: النسخة الاحتياطية متأخرة!</p>
            <p className="text-amber-700 text-sm mt-1">
              مضت {lastBackup.daysSince === Infinity ? 'مدة طويلة' : `${lastBackup.daysSince} أيام`} منذ آخر نسخة احتياطية.
              يُنصح بتصدير نسخة كل 3 أيام على الأقل.
            </p>
          </div>
        </div>
      )}

      {/* Warehouse settings */}
      <form onSubmit={handleSubmit(handleSave)} className="card space-y-4">
        <h3 className="font-bold text-gray-800 pb-2 border-b">بيانات المخزن الافتراضية</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">اسم المخزن</label>
            <input {...register('warehouseName')} className="form-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">عنوان وموقع المخزن</label>
            <input {...register('warehouseAddress')} className="form-input" />
          </div>
          <div>
            <label className="form-label">عدد الشرنكات الافتراضي بالبالتة</label>
            <input type="number" min="1" {...register('defaultShrinksPerPallet')} className="form-input" />
          </div>
          <div>
            <label className="form-label">عدد القطع الافتراضي بالشرنك</label>
            <input type="number" min="1" {...register('defaultPiecesPerShrink')} className="form-input" />
          </div>
          <div>
            <label className="form-label">حد التنبيه للمخزون المنخفض (بالشرنك)</label>
            <input type="number" min="0" {...register('lowStockThreshold')} className="form-input" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit"><Save size={16} /> حفظ التغييرات</Button>
        </div>
      </form>

      {/* Storage Monitor */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-800 pb-2 border-b flex items-center gap-2">
          <HardDrive size={18} className="text-blue-600" />
          مراقبة تخزين قاعدة البيانات
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          <p>قاعدة البيانات: <strong>IndexedDB عبر Dexie.js</strong></p>
          <p className="text-blue-600 mt-1 text-xs">البيانات مخزنة محلياً في المتصفح — ليست مزامنة مع أي سيرفر</p>
        </div>
        {storageInfo?.supported ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">المستخدم:</span>
              <span className="font-semibold">{formatBytes(storageInfo.usage)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((storageInfo.usage / storageInfo.quota) * 100, 100).toFixed(1)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{((storageInfo.usage / storageInfo.quota) * 100).toFixed(2)}% مستخدم</span>
              <span>الحد الأقصى: {formatBytes(storageInfo.quota)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">تقدير حجم التخزين غير متاح في هذا المتصفح</p>
        )}
      </div>

      {/* Backup and Restore */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-800 pb-2 border-b flex items-center gap-2">
          <Database size={18} className="text-green-600" />
          النسخ الاحتياطي واستعادة البيانات
        </h3>

        {lastBackup && !backupOverdue && lastBackup.lastBackupAt && (
          <div className="text-xs text-gray-500">
            آخر نسخة احتياطية: قبل {lastBackup.daysSince} يوم
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
          <p className="font-semibold">تنبيه هام:</p>
          <p>البيانات مخزنة محلياً في المتصفح فقط. مسح بيانات المتصفح أو تغيير الجهاز سيؤدي إلى فقدان البيانات نهائياً إذا لم يكن لديك نسخة احتياطية.</p>
        </div>

        <div className="flex gap-4 flex-wrap pt-2">
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <Download size={16} /> تصدير نسخة احتياطية (JSON)
          </Button>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl cursor-pointer transition-colors">
            <Upload size={16} /> استعادة من ملف نسخة سابقة
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
          <p>ملف النسخة الاحتياطية يحتوي على: كل المنتجات، المندوبين، حركات المخزن، أوامر التحميل، المرتجعات، التوالف، جلسات الجرد، والإعدادات.</p>
          <p className="mt-1">عند الاستعادة: يتم التحقق من سلامة الملف أولاً، ثم تتم استعادة البيانات بشكل ذري (كل شيء أو لا شيء).</p>
        </div>
      </div>

      {/* Integrity Check */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-800 pb-2 border-b flex items-center gap-2">
          <Shield size={18} className="text-purple-600" />
          فحص سلامة البيانات
        </h3>
        <p className="text-sm text-gray-600">
          يُعيد حساب أرصدة المخزن من صفر من سجل الحركات للتحقق من عدم وجود تعارضات أو حركات منتهكة.
        </p>
        <Button variant="secondary" onClick={handleIntegrityCheck} loading={integrityLoading}>
          <Shield size={16} /> تشغيل فحص سلامة البيانات
        </Button>

        {integrityResult && (
          <div className={`rounded-xl p-4 border ${integrityResult.isClean ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {integrityResult.isClean ? (
                <CheckCircle size={18} className="text-green-600" />
              ) : (
                <AlertTriangle size={18} className="text-red-600" />
              )}
              <span className={`font-semibold ${integrityResult.isClean ? 'text-green-800' : 'text-red-800'}`}>
                {integrityResult.isClean ? 'البيانات سليمة — لا توجد مشاكل' : `تم اكتشاف ${integrityResult.issueCount} مشكلة`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-gray-600 mb-3">
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="font-bold text-gray-900">{integrityResult.totalProducts}</p>
                <p>منتج</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="font-bold text-gray-900">{integrityResult.totalTransactions}</p>
                <p>حركة</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className={`font-bold ${integrityResult.issueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {integrityResult.issueCount}
                </p>
                <p>مشكلة</p>
              </div>
            </div>
            {integrityResult.issues.length > 0 && (
              <div className="space-y-2 mt-3">
                {integrityResult.issues.map((issue, i) => (
                  <div key={i} className="bg-white rounded-lg p-2 text-xs flex gap-2 items-start">
                    <StatusBadge variant={issue.severity === 'error' ? 'danger' : 'warning'}>
                      {issue.severity === 'error' ? 'خطأ' : 'تحذير'}
                    </StatusBadge>
                    <span className="text-gray-700">{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone: Reset */}
      <div className="card space-y-4 border-red-200">
        <h3 className="font-bold text-red-700 pb-2 border-b border-red-100">منطقة الحذف الكامل</h3>

        {/* START EMPTY — الأهم */}
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <h4 className="font-semibold text-red-800 mb-1">ابدأ من الصفر — مخزن فارغ تماماً</h4>
          <p className="text-sm text-gray-600 mb-3">
            يمسح كل البيانات الموجودة (منتجات، مناديب، تحميلات، حركات...) ويبدأ قاعدة بيانات فارغة خالصة بدون أي بيانات تجريبية.
          </p>
          <Button variant="danger" onClick={() => setConfirmEmpty(true)}>
            <RotateCcw size={16} /> مسح كل شيء والبدء فارغاً
          </Button>
        </div>

        {/* RESET TO DEMO */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-700 mb-1">استعادة بيانات العرض التجريبية</h4>
          <p className="text-sm text-gray-500 mb-3">
            يمسح البيانات الحالية ويستعيد بيانات العرض الافتراضية (13 منتج، 8 مناديب، تحميلات وهمية).
          </p>
          <Button variant="secondary" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> استعادة البيانات التجريبية
          </Button>
        </div>
      </div>

      {/* Confirm Start Empty */}
      <ConfirmDialog
        isOpen={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        onConfirm={async () => { await startEmpty(); toast.success('تم مسح كل البيانات — المخزن الآن فارغ'); }}
        title="⚠️ مسح كامل — ابدأ من الصفر"
        message="سيتم حذف كل البيانات الموجودة: المنتجات، المناديب، التحميلات، الحركات، المرتجعات، والتوالف. لن تجد أي بيانات بعد هذا. هل أنت متأكد؟"
        confirmText="نعم، امسح كل شيء"
        cancelText="إلغاء"
      />

      <ConfirmDialog
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={async () => { await resetToDemo(); toast.success('تمت إعادة ضبط قاعدة البيانات'); }}
        title="تحذير: حذف كامل لقاعدة البيانات"
        message="سيتم حذف جميع البيانات من IndexedDB واستبدالها ببيانات العرض الافتراضية. تأكد من تصدير نسخة احتياطية أولاً إذا أردت الاحتفاظ ببياناتك."
        confirmText="نعم، احذف كل شيء"
        cancelText="إلغاء"
      />
    </div>
  );
}
