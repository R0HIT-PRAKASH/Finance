import {
  ListBox,
  Pagination as HeroPagination,
  Select,
} from "@heroui/react";

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250];

export function getPageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
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

// HeroUI's Pagination renders parts only, it does not derive page numbers, so
// getPageNumbers above stays the source of that logic. Pages are zero-indexed
// internally and rendered as +1.
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
    <HeroPagination
      className="w-full px-4 py-3 border-t border-border"
      size="sm"
    >
      <HeroPagination.Summary>
        <span className="flex items-center gap-2">
          <span>Rows</span>
          <Select
            aria-label="Rows per page"
            className="w-24"
            value={String(pageSize)}
            onChange={(value) =>
              value !== null && onPageSizeChange(Number(value))
            }
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <ListBox.Item key={s} id={String(s)} textValue={String(s)}>
                    {s}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <span>
            {from}-{to} of {total}
          </span>
        </span>
      </HeroPagination.Summary>

      <HeroPagination.Content>
        <HeroPagination.Item>
          <HeroPagination.Previous
            isDisabled={page === 0}
            onPress={() => onPageChange(page - 1)}
          >
            <HeroPagination.PreviousIcon />
          </HeroPagination.Previous>
        </HeroPagination.Item>

        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <HeroPagination.Item key={`ellipsis-${i}`}>
              <HeroPagination.Ellipsis />
            </HeroPagination.Item>
          ) : (
            <HeroPagination.Item key={p}>
              <HeroPagination.Link
                isActive={page === p}
                onPress={() => onPageChange(p)}
              >
                {p + 1}
              </HeroPagination.Link>
            </HeroPagination.Item>
          ),
        )}

        <HeroPagination.Item>
          <HeroPagination.Next
            isDisabled={page >= totalPages - 1}
            onPress={() => onPageChange(page + 1)}
          >
            <HeroPagination.NextIcon />
          </HeroPagination.Next>
        </HeroPagination.Item>
      </HeroPagination.Content>
    </HeroPagination>
  );
}
