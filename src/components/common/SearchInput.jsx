// STOCKFLOW — SEARCH INPUT
import { Search, X } from 'lucide-react';
export default function SearchInput({ value, onChange, placeholder = 'بحث...' }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-input pr-9 pl-9"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
