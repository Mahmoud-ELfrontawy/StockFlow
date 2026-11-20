// STOCKFLOW — STATUS BADGE
const VARIANTS = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger:  'badge-danger',
  info:    'badge-info',
  muted:   'badge-muted',
};
export default function StatusBadge({ children, variant = 'muted' }) {
  return (
    <span className={`badge ${VARIANTS[variant] || VARIANTS.muted}`}>
      {children}
    </span>
  );
}
