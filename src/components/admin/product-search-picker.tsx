"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, formatCurrency } from "@/lib/utils";

export interface SearchProduct {
  id: string;
  name: string;
  salePrice: number;
  centralStock?: number;
  article?: string | null;
  sku?: string | null;
  barcode?: string | null;
}

interface ProductSearchPickerProps {
  onSelect: (product: SearchProduct) => void;
  excludeIds?: string[];
  autoFocus?: boolean;
}

const ITEM_HEIGHT = 52;
const VISIBLE_COUNT = 8;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function productMeta(product: SearchProduct): string {
  const parts: string[] = [];
  if (product.sku) parts.push(`SKU: ${product.sku}`);
  if (product.article) parts.push(`Арт: ${product.article}`);
  if (product.barcode) parts.push(`ШК: ${product.barcode}`);
  parts.push(`ID: ${product.id.slice(0, 8)}…`);
  return parts.join(" · ");
}

export function ProductSearchPicker({
  onSelect,
  excludeIds = [],
  autoFocus = true,
}: ProductSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, 200);
  const fetchSeq = useRef(0);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (autoFocus) focusSearch();
  }, [autoFocus, focusSearch]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setProducts([]);
      setLoading(false);
      setHighlightIdx(0);
      setScrollTop(0);
      return;
    }

    const seq = ++fetchSeq.current;
    let cancelled = false;

    async function search() {
      setLoading(true);
      const params = new URLSearchParams({ status: "ACTIVE", limit: "100", search: q });

      try {
        const res = await fetch(`/api/products?${params}`);
        const json = await res.json();
        if (cancelled || seq !== fetchSeq.current) return;

        const data = Array.isArray(json) ? json : [];
        setProducts(data.filter((p) => !excludeIds.includes(p.id)));
        setHighlightIdx(0);
        setScrollTop(0);
      } finally {
        if (!cancelled && seq === fetchSeq.current) setLoading(false);
      }
    }
    search();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, excludeIds]);

  function handleSelect(product: SearchProduct) {
    onSelect(product);
    setHighlightIdx(0);
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
    focusSearch();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (products.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, products.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const product = products[highlightIdx];
      if (product) handleSelect(product);
    }
  }

  const containerHeight = Math.min(products.length, VISIBLE_COUNT) * ITEM_HEIGHT;
  const startIdx = Math.floor(scrollTop / ITEM_HEIGHT);
  const endIdx = Math.min(startIdx + VISIBLE_COUNT + 2, products.length);
  const visibleProducts = products.slice(startIdx, endIdx);
  const totalHeight = products.length * ITEM_HEIGHT;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-9"
          placeholder="Поиск: минимум 2 символа (название, артикул, штрихкод)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>

      <div
        ref={listRef}
        className="rounded-lg border bg-background overflow-y-auto"
        style={{ height: Math.max(containerHeight, 52) }}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center h-[52px] text-sm text-muted-foreground">
            Поиск...
          </div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center h-[52px] text-sm text-muted-foreground">
            {query.trim().length >= 2 ? "Товары не найдены" : "Введите минимум 2 символа для поиска"}
          </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleProducts.map((product, i) => {
              const idx = startIdx + i;
              return (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    "absolute left-0 right-0 flex items-center gap-3 px-3 text-left transition-colors hover:bg-accent",
                    idx === highlightIdx && "bg-accent"
                  )}
                  style={{ top: idx * ITEM_HEIGHT, height: ITEM_HEIGHT }}
                  onClick={() => handleSelect(product)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{product.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {productMeta(product)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div>{formatCurrency(product.salePrice)}</div>
                    {product.centralStock !== undefined && (
                      <div className="text-xs text-muted-foreground">Склад: {product.centralStock}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!loading && products.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Найдено: {products.length} · Enter — добавить · ↑↓ — навигация
        </p>
      )}
    </div>
  );
}
