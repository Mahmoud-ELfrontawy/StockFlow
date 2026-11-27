// STOCKFLOW — DATA TABLE
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
export default function DataTable({ columns, data, loading, emptyTitle, emptyDescription, emptyIcon }) {
  if (loading) return <LoadingState />;
  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>{columns.map((col, idx) => (
            <th key={col.id || `${col.key}-${idx}`} style={{ width: col.width }} className={col.headerClass}>{col.title}</th>
          ))}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((col, idx) => (
                <td key={col.id || `${col.key}-${idx}`} className={col.cellClass}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
