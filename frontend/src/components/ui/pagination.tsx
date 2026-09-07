import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const pages: (number | "...")[] = [];

  if (current <= 3) {
    pages.push(0, 1, 2, 3, 4, "...", total - 1);
  } else if (current >= total - 4) {
    pages.push(0, "...", total - 5, total - 4, total - 3, total - 2, total - 1);
  } else {
    pages.push(0, "...", current - 1, current, current + 1, "...", total - 1);
  }

  return pages;
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageNumbers = getPageNumbers(page, totalPages);
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
          className="h-8 rounded-md border border-border bg-muted px-2 text-xs text-foreground outline-none"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="text-xs">
          {from}–{to} of {total}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
          className="text-xs px-2"
        >
          «
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          className="text-xs px-2"
        >
          ‹
        </Button>

        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="px-2 text-muted-foreground text-sm"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(p as number)}
              className={`text-xs px-3 ${page === p ? "bg-primary/10 text-primary border border-primary/20" : ""}`}
            >
              {(p as number) + 1}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="text-xs px-2"
        >
          ›
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="text-xs px-2"
        >
          »
        </Button>
      </div>
    </div>
  );
}
