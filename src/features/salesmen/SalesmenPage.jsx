// STOCKFLOW — SALESMEN PAGE
import { useState, useMemo } from 'react';
import { Plus, Edit2, Power, Users } from 'lucide-react';
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
import { formatDate } from '../../utils/formatters';

const schema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().optional(),
  employeeCode: z.string().min(1, 'كود الموظف مطلوب'),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

function SalesmanForm({ defaultValues, onSubmit, onClose }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="form-label">اسم المندوب *</label>
          <input {...register('name')} className="form-input" placeholder="أحمد محمد" />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="form-label">كود الموظف *</label>
          <input {...register('employeeCode')} className="form-input" placeholder="S-009" />
          {errors.employeeCode && <p className="form-error">{errors.employeeCode.message}</p>}
        </div>
        <div>
          <label className="form-label">رقم الهاتف</label>
          <input {...register('phone')} className="form-input" placeholder="0100-000-0000" />
        </div>
        <div>
          <label className="form-label">تاريخ التعيين</label>
          <input type="date" {...register('startDate')} className="form-input" />
        </div>
      </div>
      <div>
        <label className="form-label">ملاحظات (اختياري)</label>
        <textarea {...register('notes')} className="form-input" rows={2} placeholder="منطقة العمل أو أي معلومات أخرى" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
        <Button type="submit" loading={isSubmitting}>حفظ المندوب</Button>
      </div>
    </form>
  );
}

export default function SalesmenPage() {
  const { salesmen, products, addSalesman, updateSalesman, toggleSalesmanStatus, loadingTransactions } = useInventoryStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editSalesman, setEditSalesman] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const filtered = useMemo(() => {
    return salesmen.filter((s) => {
      const matchSearch = !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [salesmen, search, filterStatus]);

  const getSalesmanLoadingStats = (salesmanId) => {
    const items = loadingTransactions
      .filter((l) => l.salesmanId === salesmanId)
      .flatMap((l) => l.items);

    const totalShrinks = items.reduce((s, i) => {
      if (i.quantityShrinks !== undefined) return s + Number(i.quantityShrinks);
      const prod = products.find((p) => p.id === i.productId);
      const pShrink = prod?.piecesPerShrink || 24;
      return s + Math.floor(i.quantityPieces / pShrink);
    }, 0);

    const totalPieces = items.reduce((s, i) => s + i.quantityPieces, 0);

    return { totalShrinks, totalPieces };
  };

  const handleSubmit = (data) => {
    if (editSalesman) {
      updateSalesman(editSalesman.id, data);
      toast.success('تم تحديث بيانات المندوب');
    } else {
      addSalesman(data);
      toast.success('تم إضافة المندوب بنجاح');
    }
    setModalOpen(false);
    setEditSalesman(null);
  };

  const columns = [
    { key: 'name', title: 'اسم المندوب', render: (val, row) => (
      <div>
        <p className="font-semibold text-gray-800 dark:text-slate-100">{val}</p>
        <p className="text-xs text-gray-400">{row.employeeCode}</p>
      </div>
    )},
    { key: 'phone', title: 'رقم الهاتف', render: (val) => val || '—' },
    { key: 'startDate', title: 'تاريخ التعيين', render: (val) => val ? formatDate(val) : '—' },
    { key: 'id', title: 'إجمالي المحمّل', render: (val) => {
      const { totalShrinks, totalPieces } = getSalesmanLoadingStats(val);
      return (
        <div>
          <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">
            {totalShrinks.toLocaleString('ar-EG')} شرنك
          </span>
          {totalPieces > 0 && (
            <span className="block text-[11px] text-gray-400 font-normal">
              ({totalPieces.toLocaleString('ar-EG')} ق)
            </span>
          )}
        </div>
      );
    }},
    { key: 'status', title: 'الحالة', render: (val) => (
      <StatusBadge variant={val === 'active' ? 'success' : 'muted'}>
        {val === 'active' ? 'نشط' : 'موقوف'}
      </StatusBadge>
    )},
    { key: 'id', title: 'إجراءات', render: (_, row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => { setEditSalesman(row); setModalOpen(true); }} className="btn-icon text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800" title="تعديل">
          <Edit2 size={15} />
        </button>
        <button onClick={() => setConfirmToggle(row)} className="btn-icon text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800" title="تغيير الحالة">
          <Power size={15} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المندوبون"
        subtitle={`${salesmen.filter((s) => s.status === 'active').length} مندوب نشط · ${salesmen.length} إجمالي`}
        actions={
          <Button onClick={() => { setEditSalesman(null); setModalOpen(true); }}>
            <Plus size={16} /> إضافة مندوب
          </Button>
        }
      />
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود..." /></div>
          <div className="flex gap-2">
            {[['all','الكل'],['active','نشط'],['inactive','موقوف']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilterStatus(val)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${filterStatus === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable columns={columns} data={filtered} emptyTitle="لا يوجد مندوبون" emptyIcon={Users} />
      </div>
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditSalesman(null); }} title={editSalesman ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد'}>
        <SalesmanForm defaultValues={editSalesman} onSubmit={handleSubmit} onClose={() => { setModalOpen(false); setEditSalesman(null); }} />
      </Modal>
      <ConfirmDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={() => { toggleSalesmanStatus(confirmToggle.id); toast.success('تم تغيير حالة المندوب'); }}
        title="تغيير حالة المندوب"
        message={`هل تريد ${confirmToggle?.status === 'active' ? 'إيقاف' : 'تفعيل'} المندوب "${confirmToggle?.name}"؟`}
        variant={confirmToggle?.status === 'active' ? 'danger' : 'primary'}
      />
    </div>
  );
}