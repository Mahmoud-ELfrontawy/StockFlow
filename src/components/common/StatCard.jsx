// STOCKFLOW — STAT CARD
export default function StatCard({ title, value, subtitle, icon: Icon, iconColor = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-sky-400', trend }) {
  return (
    <div className="stat-card">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
        {Icon && <Icon size={22} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mb-1 truncate">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 truncate font-medium">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 font-semibold ${trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trend.positive ? '▲' : '▼'} {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}
