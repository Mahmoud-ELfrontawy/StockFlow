// STOCKFLOW — CONFIRM DIALOG
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'تأكيد', cancelText = 'إلغاء', variant = 'danger' }) {
  const btnClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="text-center py-2">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-600" />
        </div>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="btn-secondary">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={btnClass}>{confirmText}</button>
        </div>
      </div>
    </Modal>
  );
}
