import { useEffect, useState } from "react";
import {
  catalogSorts,
  type CatalogSort,
  type Filters,
} from "../services/catalog";

import { readPagination } from "../services/catalog-pagination";

export const emptyFilters: Filters = {
  query: "",
  publisher: "",
  category: "",
  spatial: "",
};
const keys = {
  query: "q",
  publisher: "publisher",
  category: "category",
  spatial: "type",
  platform: "platform",
} as const;
function readBrowseState() {
  const params = new URLSearchParams(location.search);
  const filters = { ...emptyFilters };
  for (const [key, parameter] of Object.entries(keys))
    filters[key as keyof typeof keys] = params.get(parameter) ?? "";
  const candidate = params.get("sort") ?? "name-asc";
  const sort: CatalogSort = Object.hasOwn(catalogSorts, candidate)
    ? (candidate as CatalogSort)
    : "name-asc";
  return { filters, sort, ...readPagination(params) };
}
export function useCatalogBrowse() {
  const [state, setState] = useState(readBrowseState);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const restore = () => {
      const next = readBrowseState();
      if (next.page !== state.page || next.pageSize !== state.pageSize)
        setExpanded(new Set());
      setState(next);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [state.page, state.pageSize]);
  useEffect(() => {
    const url = new URL(location.href);
    for (const [key, parameter] of Object.entries(keys)) {
      const value = state.filters[key as keyof typeof keys];
      if (value) url.searchParams.set(parameter, value);
      else url.searchParams.delete(parameter);
    }
    if (state.sort !== "name-asc") url.searchParams.set("sort", state.sort);
    else url.searchParams.delete("sort");
    url.searchParams.delete("shown");
    if (state.page > 1) url.searchParams.set("page", String(state.page));
    else url.searchParams.delete("page");
    if (state.pageSize !== 20)
      url.searchParams.set("pageSize", String(state.pageSize));
    else url.searchParams.delete("pageSize");
    if (url.href !== location.href)
      history.replaceState(history.state, "", url);
  }, [state]);
  return {
    ...state,
    expanded,
    onChange: (filters: Filters) => {
      setExpanded(new Set());
      setState((previous) => ({ ...previous, filters, page: 1 }));
    },
    onSort: (sort: CatalogSort) => {
      setExpanded(new Set());
      setState((previous) => ({ ...previous, sort, page: 1 }));
    },
    onPage: (page: number) => {
      setExpanded(new Set());
      setState((previous) => ({ ...previous, page }));
    },
    onPageSize: (pageSize: number) => {
      setExpanded(new Set());
      setState((previous) => ({ ...previous, pageSize, page: 1 }));
    },
    onExpand: (id: string) =>
      setExpanded((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}
