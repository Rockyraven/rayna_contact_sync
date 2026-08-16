function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="numeric">{total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}</span>
      <div className="pagination-controls">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          ‹ Prev
        </button>
        <span className="numeric">
          Page {page} of {totalPages}
        </span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next ›
        </button>
      </div>
    </div>
  );
}

export default Pagination;
