import { useEffect, useState } from "react";
import {
  catalogSorts,
  type CatalogSort,
  type Filters,
} from "../services/catalog";

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
  const shown = Number(params.get("shown"));
  const visible =
    Number.isInteger(shown) && shown >= 100 && shown <= 10000 ? shown : 100;
  return { filters, sort, visible };
}
export function useCatalogBrowse() {
  const [state, setState] = useState(readBrowseState);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const restore = () => setState(readBrowseState());
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    const url = new URL(location.href);
    for (const [key, parameter] of Object.entries(keys)) {
      const value = state.filters[key as keyof typeof keys];
      if (value) url.searchParams.set(parameter, value);
      else url.searchParams.delete(parameter);
    }
    if (state.sort !== "name-asc") url.searchParams.set("sort", state.sort);
    else url.searchParams.delete("sort");
    if (state.visible > 100)
      url.searchParams.set("shown", String(state.visible));
    else url.searchParams.delete("shown");
    if (url.href !== location.href)
      history.replaceState(history.state, "", url);
  }, [state]);
  return {
    ...state,
    expanded,
    onChange: (filters: Filters) =>
      setState((previous) => ({ ...previous, filters, visible: 100 })),
    onSort: (sort: CatalogSort) =>
      setState((previous) => ({ ...previous, sort, visible: 100 })),
    onMore: () =>
      setState((previous) => ({
        ...previous,
        visible: previous.visible + 100,
      })),
    onExpand: (id: string) =>
      setExpanded((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}
