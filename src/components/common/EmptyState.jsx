// STOCKFLOW — EMPTY STATE
import { PackageSearch } from 'lucide-react';
export default function EmptyState({ title = 'لا توجد بيانات', description = '', icon: Icon = PackageSearch, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <h3 className="text-gray-700 font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-gray-400 text-sm mb-4 max-w-xs">{description}</p>}
      {action && action}
    </div>
  );
}
