export const catalogPageSizes = [10, 20, 50, 100] as const;
export function readPagination(params: URLSearchParams) {
  const value = Number(params.get("page"));
  const size = Number(params.get("pageSize"));
  return {
    page: Number.isSafeInteger(value) && value > 0 ? value : 1,
    pageSize: catalogPageSizes.some((allowed) => allowed === size) ? size : 20,
  };
}
export function paginateCatalog<T>(
  results: T[],
  page: number,
  pageSize: number,
) {
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const offset = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    start: results.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, results.length),
    rows: results.slice(offset, offset + pageSize),
  };
}
