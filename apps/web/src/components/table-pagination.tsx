"use client";

const PAGE_SIZE = 10;

export function usePageSlice<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { slice, total, totalPages, page: safePage, pageSize, start };
}

type Props = {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({ page, total, pageSize = PAGE_SIZE, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="vo-pagination">
      <span className="vo-pagination-meta">
        Showing {start}–{end} of {total}
      </span>
      <div className="vo-pagination-btns">
        <button
          type="button"
          className="vo-btn vo-btn-secondary vo-btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="vo-pagination-page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="vo-btn vo-btn-secondary vo-btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
