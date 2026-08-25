// @ts-nocheck
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocalization } from "@/lib/localization-context";
import ProductCard from "@/components/store/ProductCard";
import Reveal from "@/components/store/Reveal";

// Added labelKh for automatic translation in the dropdown
const SORTS = [
  { value: "newest", label: "Newest", labelKh: "ថ្មីបំផុត" },
  { value: "popular", label: "Popular", labelKh: "ពេញនិយម" },
  { value: "price_asc", label: "Lowest Price", labelKh: "តម្លៃទាបបំផុត" },
  { value: "price_desc", label: "Highest Price", labelKh: "តម្លៃខ្ពស់បំផុត" },
  { value: "name_asc", label: "Name A-Z", labelKh: "ឈ្មោះ A-Z" },
  { value: "name_desc", label: "Name Z-A", labelKh: "ឈ្មោះ Z-A" },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { t } = useLocalization(); // <-- Hooked into global localization

  const [all, setAll] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const filters = {
    category: params.getAll("category"),
    color: params.getAll("color"),
    size: params.getAll("size"),
    minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : null,
    maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : null,
    discount: params.get("discount") === "1",
    filter: params.get("filter"),
  };
  const sort = params.get("sort") || "newest";

  const [categories, setCategories] = useState(/** @type {any[]} */ ([]));
  const [colors, setColors] = useState(/** @type {any[]} */ ([]));
  const [sizes, setSizes] = useState(/** @type {any[]} */ ([]));

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchSafe = async (/** @type {string} */ table) => {
          try {
            const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(50);
            if (error) return [];
            return data || [];
          } catch (err) {
            return [];
          }
        };

        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(200);

        if (prodData) setAll(prodData);

        const [catData, colorData, sizeData] = await Promise.all([
          fetchSafe("categories"),
          fetchSafe("colors"),
          fetchSafe("sizes")
        ]);

        setCategories(catData);
        setColors(colorData);
        setSizes(sizeData);
      } catch (e) {
        console.error("Error loading shop data:", e);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const toggleMulti = useCallback((/** @type {string} */ key, /** @type {string} */ value) => {
    const current = params.getAll(key);
    const next = current.includes(value) ? current.filter((/** @type {string} */ v) => v !== value) : [...current, value];
    const newParams = new URLSearchParams(params);
    newParams.delete(key);
    next.forEach((/** @type {string} */ v) => newParams.append(key, v));
    setPage(1);
    setParams(newParams);
  }, [params, setParams]);

  const setSingle = useCallback((/** @type {string} */ key, /** @type {string} */ value) => {
    const newParams = new URLSearchParams(params);
    if (value) newParams.set(key, value); else newParams.delete(key);
    setPage(1);
    setParams(newParams);
  }, [params, setParams]);

  const clearAll = () => { setParams(new URLSearchParams()); setPage(1); };

  const filtered = useMemo(() => {
    let r = [...all];
    
    if (filters.category.length) {
      r = r.filter((/** @type {any} */ p) => 
        filters.category.some((/** @type {string} */ c) => 
          (p.category || "").toLowerCase().includes(c.toLowerCase())
        )
      );
    }
    
    if (filters.color.length) r = r.filter((/** @type {any} */ p) => (p.colors || []).some((/** @type {string} */ c) => filters.color.some((/** @type {string} */ fc) => c.toLowerCase().includes(fc.toLowerCase()))));
    if (filters.size.length) r = r.filter((/** @type {any} */ p) => (p.sizes || []).some((/** @type {string} */ s) => filters.size.includes(s)));
    
    if (filters.minPrice != null) {
      const min = filters.minPrice;
      r = r.filter((/** @type {any} */ p) => (p.discount_price ?? p.price) >= min);
    }
    if (filters.maxPrice != null) {
      const max = filters.maxPrice;
      r = r.filter((/** @type {any} */ p) => (p.discount_price ?? p.price) <= max);
    }

    if (filters.discount) r = r.filter((/** @type {any} */ p) => p.discount_price != null && p.discount_price < p.price);
    if (filters.filter === "new") r = r.filter((/** @type {any} */ p) => p.is_new);
    if (filters.filter === "best") r = r.filter((/** @type {any} */ p) => p.is_best_seller);

    switch (sort) {
      case "price_asc": r.sort((/** @type {any} */ a, /** @type {any} */ b) => (a.discount_price ?? a.price) - (b.discount_price ?? b.price)); break;
      case "price_desc": r.sort((/** @type {any} */ a, /** @type {any} */ b) => (b.discount_price ?? b.price) - (a.discount_price ?? a.price)); break;
      case "name_asc": r.sort((/** @type {any} */ a, /** @type {any} */ b) => a.name.localeCompare(b.name)); break;
      case "name_desc": r.sort((/** @type {any} */ a, /** @type {any} */ b) => b.name.localeCompare(a.name)); break;
      case "popular": r.sort((/** @type {any} */ a, /** @type {any} */ b) => (b.is_best_seller ? 1 : 0) - (a.is_best_seller ? 1 : 0)); break;
      default: r.sort((/** @type {any} */ a, /** @type {any} */ b) => new Date(b.created_at || b.created_date).getTime() - new Date(a.created_at || a.created_date).getTime());
    }
    return r;
  }, [all, filters, sort]);

  const paged = filtered.slice(0, page * PAGE_SIZE);
  const activeCount = filters.category.length + filters.color.length + filters.size.length + (filters.minPrice != null ? 1 : 0) + (filters.maxPrice != null ? 1 : 0) + (filters.discount ? 1 : 0);

  /**
   * @param {{ title: string, children: React.ReactNode }} props
   */
  const FilterSection = ({ title, children }) => (
    <div className="border-b hairline py-5">
      <p className="label-mono text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );

  /**
   * @param {{ active: boolean, onClick: () => void, label: string }} props
   */
  const CheckRow = ({ active, onClick, label }) => (
    <button onClick={onClick} className="flex items-center gap-2.5 py-1.5 w-full text-left text-sm hover:opacity-70 transition-opacity">
      <span className={`w-4 h-4 border hairline flex items-center justify-center ${active ? "bg-foreground" : ""}`}>
        {active && <Check size={11} className="text-background" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );

  const FilterPanel = () => (
    <div>
      {categories.length > 0 && (
        <FilterSection title={t("Category", "ប្រភេទ")}>
          {categories.map((/** @type {any} */ c) => (
            <CheckRow 
              key={c.id} 
              active={filters.category.includes(c.id) || filters.category.includes(c.name)} 
              onClick={() => toggleMulti("category", c.name)} 
              label={t(c.name, c.name_khmer || c.name)} 
            />
          ))}
        </FilterSection>
      )}

      {colors.length > 0 && (
        <FilterSection title={t("Color", "ពណ៌")}>
          <div className="flex flex-wrap gap-2">
            {colors.map((/** @type {any} */ c) => (
              <button 
                key={c.id || c.name} 
                onClick={() => toggleMulti("color", c.name)} 
                className={`px-3 py-1.5 border hairline label-mono text-[10px] ${filters.color.includes(c.name) ? "bg-foreground text-background" : ""}`}
              >
                {t(c.name, c.name_khmer || c.name)}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      {sizes.length > 0 && (
        <FilterSection title={t("Size", "ទំហំ")}>
          <div className="flex flex-wrap gap-2">
            {sizes.map((/** @type {any} */ s) => (
              <button 
                key={s.id || s.name} 
                onClick={() => toggleMulti("size", s.name)} 
                className={`px-3 py-1.5 border hairline label-mono text-[10px] ${filters.size.includes(s.name) ? "bg-foreground text-background" : ""}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title={t("Price Range", "ជួរតម្លៃ")}>
        <div className="flex items-center gap-2">
          <input type="number" placeholder={t("Min", "អប្បបរមា")} defaultValue={filters.minPrice ?? ""} onBlur={(e) => setSingle("minPrice", e.target.value)} className="w-full border hairline px-3 py-2 font-mono text-xs outline-none" />
          <span className="text-muted-foreground">—</span>
          <input type="number" placeholder={t("Max", "អតិបរមា")} defaultValue={filters.maxPrice ?? ""} onBlur={(e) => setSingle("maxPrice", e.target.value)} className="w-full border hairline px-3 py-2 font-mono text-xs outline-none" />
        </div>
      </FilterSection>
      
      <FilterSection title={t("Offers", "ការផ្តល់ជូន")}>
        <CheckRow active={filters.discount} onClick={() => setSingle("discount", filters.discount ? "" : "1")} label={t("On Sale Only", "កំពុងបញ្ចុះតម្លៃប៉ុណ្ណោះ")} />
      </FilterSection>
      
      {activeCount > 0 && (
        <button onClick={clearAll} className="label-mono text-muted-foreground hover:text-foreground mt-4 underline underline-offset-4">
          {t("Clear all filters", "លុបចោលតម្រងទាំងអស់")}
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
          <p className="label-mono text-muted-foreground mb-3">— {t("The Collection", "បណ្តុំផលិតផល")}</p>
          <h1 className="font-display text-5xl md:text-7xl tracking-[-0.05em]">{t("Shop.", "ទិញទំនិញ.")}</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            {filtered.length} {t("objects", "វត្ថុ")}
            {activeCount > 0 ? ` · ${activeCount} ${t("filters active", "តម្រងសកម្ម")}` : ""}
          </p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 grid md:grid-cols-[230px_1fr] gap-10 py-10">
        {/* Desktop sidebar */}
        <aside className="hidden md:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar">
          <FilterPanel />
        </aside>

        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b hairline">
            <button onClick={() => setFilterOpen(true)} className="flex items-center gap-2 label-mono md:hidden">
              <SlidersHorizontal size={14} /> {t("Filters", "តម្រង")} {activeCount > 0 && `(${activeCount})`}
            </button>
            <span className="hidden md:block label-mono text-muted-foreground">
              {t("Showing", "បង្ហាញ")} {paged.length} {t("of", "នៃ")} {filtered.length}
            </span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => { setSingle("sort", e.target.value); }}
                className="appearance-none border hairline pl-3 pr-9 py-2 label-mono bg-background outline-none cursor-pointer"
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{t(s.label, s.labelKh)}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-[4/5] bg-muted animate-pulse" />)}
            </div>
          ) : paged.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display text-3xl tracking-[-0.04em]">{t("No objects found.", "រកមិនឃើញវត្ថុទេ។")}</p>
              <p className="text-muted-foreground mt-2 text-sm">{t("Adjust your filters to broaden the collection.", "កែសម្រួលតម្រងរបស់អ្នកដើម្បីពង្រីកការស្វែងរក។")}</p>
              {activeCount > 0 && <button onClick={clearAll} className="label-mono underline underline-offset-4 mt-4">{t("Clear filters", "លុបចោលតម្រង")}</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
              {paged.map((/** @type {any} */ p, /** @type {number} */ i) => (
                <Reveal key={p.id} delay={(i % 3) * 60}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          )}

          {!loading && paged.length < filtered.length && (
            <div className="flex justify-center mt-14">
              <button onClick={() => setPage((p) => p + 1)} className="border hairline px-8 py-4 label-mono hover:bg-foreground hover:text-background transition-colors">
                {t("Load More", "ផ្ទុកបន្ថែម")} ({filtered.length - paged.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-background p-6 overflow-y-auto inertia-up">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-lg tracking-[-0.04em]">{t("Filters", "តម្រង")}</span>
              <button onClick={() => setFilterOpen(false)}><X size={18} /></button>
            </div>
            <FilterPanel />
            <button onClick={() => setFilterOpen(false)} className="w-full bg-foreground text-background py-4 label-mono mt-6">
              {t("Show", "បង្ហាញ")} {filtered.length} {t("Results", "លទ្ធផល")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}