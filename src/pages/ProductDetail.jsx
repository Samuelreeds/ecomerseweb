// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, Minus, Plus, ShoppingBag, ChevronRight, Truck, RotateCcw, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import { useCart } from "@/lib/cart-context";
import { useLocalization } from "@/lib/localization-context";
import ProductCard from "@/components/store/ProductCard";
import Reveal from "@/components/store/Reveal";
import { trackEvent } from "@/lib/analytics";
import { useSEO } from "@/hooks/useSEO";
import { useAuth } from "@/lib/AuthContext";

/** @type {any} */
const Image = BaseImage;

function BarcodeSVG(/** @type {{ value: string }} */ { value }) {
  if (!value) return null;
  const bars = [];
  let x = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const width = (code % 3) + 1;
    bars.push(<rect key={i} x={x} y={0} width={width} height={50} fill="#050505" />);
    x += width + (code % 2);
  }
  return (
    <svg width={x} height="50" viewBox={`0 0 ${x} 50`} className="block">
      {bars}
    </svg>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, toggleWishlist, isInWishlist } = /** @type {any} */ (useCart());
  const { formatPrice, t = (k, d) => d, currency } = /** @type {any} */ (useLocalization() || {});
  const { user } = useAuth(); // B2B Authorization context

  const [product, setProduct] = useState(/** @type {any} */ (null));
  const [selectedVariant, setSelectedVariant] = useState(/** @type {any} */ (null));
  const [b2bPrices, setB2bPrices] = useState(/** @type {Record<string, number>} */ ({}));
  const [related, setRelated] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [showBarcode, setShowBarcode] = useState(false);
  const [descOpen, setDescOpen] = useState(false);

  // --- DYNAMIC PRICING LOGIC ---
  const activeB2B = user?.b2b_companies?.status === 'approved' ? user.b2b_companies : null;
  const b2bPriceOverride = selectedVariant ? b2bPrices[selectedVariant.id] : undefined;
  
  const currentPrice = b2bPriceOverride ?? selectedVariant?.discount_price ?? selectedVariant?.price ?? 0;
  const stockAvailable = selectedVariant?.balances?.available ?? 0;
  const hasDiscount = b2bPriceOverride === undefined && selectedVariant?.discount_price != null && selectedVariant.discount_price < selectedVariant.price;
  const discountPct = hasDiscount ? Math.round((1 - selectedVariant.discount_price / selectedVariant.price) * 100) : 0;
  
  const canonicalUrl = `${window.location.origin}/product/${product?.id}`;
  const localizedTitle = product ? t(product.name, product.name_khmer) : "Product";

  useSEO({
    title: localizedTitle,
    description: product?.overview || product?.description || "",
    canonicalUrl: product ? canonicalUrl : undefined,
    ogType: "product",
    ogImage: product?.images?.[0] || product?.image,
    schema: product && selectedVariant ? {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name,
      "image": product.images?.length ? product.images : (product.image ? [product.image] : []),
      "description": product.overview || product.description,
      "sku": selectedVariant.sku || undefined,
      "brand": {
        "@type": "Brand",
        "name": "NOIR MTD"
      },
      "offers": {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": currency || "USD",
        "price": currentPrice,
        "availability": stockAvailable > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      }
    } : null,
    breadcrumbSchema: product ? {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": window.location.origin },
        { "@type": "ListItem", "position": 2, "name": "Shop", "item": `${window.location.origin}/shop` },
        { "@type": "ListItem", "position": 3, "name": product.name, "item": canonicalUrl }
      ]
    } : null
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setActiveImg(0);
    setQty(1);
    setSelectedVariant(null);
    setB2bPrices({});
    
    (async () => {
      try {
        const { data: p, error } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq('id', id)
          .maybeSingle();
          
        if (error || !p) {
          setLoading(false);
          return;
        }

        const variantIds = p.product_variants?.map((/** @type {any} */ v) => v.id) || [];
        
        let balancesMap = /** @type {Record<string, any>} */ ({});
        if (variantIds.length > 0) {
          try {
            const { data: balances } = await supabase.from('variant_stock_balances').select('*').in('variant_id', variantIds);
            balances?.forEach(b => { balancesMap[b.variant_id] = b; });
          } catch (e) { console.warn("Could not fetch variant stock balances:", e); }
        }

        // B2B Pricing Resolution
        if (variantIds.length > 0 && activeB2B?.price_list_id) {
           try {
             const { data: b2bData } = await supabase.from('b2b_price_list_items').select('variant_id, b2b_price').eq('price_list_id', activeB2B.price_list_id).in('variant_id', variantIds);
             const map = /** @type {Record<string, number>} */ ({});
             b2bData?.forEach(d => { map[d.variant_id] = d.b2b_price; });
             setB2bPrices(map);
           } catch (e) { console.warn("Could not fetch B2B overrides:", e); }
        }

        let activeVariants = (p.product_variants || [])
          .filter((/** @type {any} */ v) => v.is_active)
          .map((/** @type {any} */ v) => ({ ...v, balances: balancesMap[v.id] || { available: 0, on_hand: 0 } }));

        if (activeVariants.length === 0) {
          activeVariants = [{
            id: null, sku: p.code || `SKU-${p.id.slice(0, 8).toUpperCase()}`, size: Array.isArray(p.sizes) ? p.sizes[0] : (p.sizes || "500ml"),
            scent: p.color || null, price: Number(p.price) || 0, discount_price: p.discount ? Number(p.discount) : (p.discount_price ? Number(p.discount_price) : null),
            balances: { available: 0, on_hand: 0 }, is_active: true
          }];
        }

        p.variants = activeVariants;
        setProduct(p);
        setSelectedVariant(activeVariants[0]);
        
        trackEvent('product_view', { 
          product_id: p.id, variant_id: activeVariants[0]?.id, value: currentPrice, metadata: { sku: activeVariants[0]?.sku }
        });

        const { data: all } = await supabase.from('products').select('*').neq('id', id).neq('status', 'archived').order('created_at', { ascending: false }).limit(20);

        if (all) {
          setRelated(all.filter((/** @type {any} */ x) => x.category === p.category || x.product_type === p.product_type).slice(0, 4));
        }
      } catch (e) { 
        console.error("Error loading product detail:", e); 
      }
      setLoading(false);
    })();
  }, [id, user]); 

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-background">
        <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!product || !selectedVariant) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-background">
        <p className="font-display text-3xl tracking-[-0.04em]">{t("Object not found.", "រកមិនឃើញវត្ថុទេ")}</p>
        <Link to="/shop" className="label-mono border-b border-foreground pb-1">{t("Return to Shop", "ត្រឡប់ទៅហាងវិញ")}</Link>
      </div>
    );
  }

  const liked = isInWishlist(product.id);
  const soldOut = stockAvailable <= 0;
  const lowStock = stockAvailable > 0 && stockAvailable <= 5;
  const images = product.images?.length ? product.images : (product.image ? [product.image] : []);

  const handleAdd = () => {
    addItem(product, { 
      variant_id: selectedVariant.id,
      sku: selectedVariant.sku,
      size: selectedVariant.size || "Default", 
      scent: selectedVariant.scent || "Default", 
      price: currentPrice,
      quantity: qty 
    });
  };
  
  const handleBuyNow = () => {
    handleAdd();
    navigate("/checkout");
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center gap-2 label-mono text-muted-foreground text-[10px]">
          <Link to="/" className="hover:text-foreground">{t("Home", "ទំព័រដើម")}</Link>
          <ChevronRight size={11} />
          <Link to="/shop" className="hover:text-foreground">{t("Shop", "ទិញទំនិញ")}</Link>
          <ChevronRight size={11} />
          <span className="text-foreground truncate">{localizedTitle}</span>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 grid md:grid-cols-[60%_40%] gap-0 md:gap-10 py-8 md:py-12">
        <div className="flex flex-col-reverse md:flex-row gap-4 md:sticky md:top-24 md:self-start md:max-h-[calc(100vh-7rem)] md:overflow-y-auto no-scrollbar">
          {images.length > 1 && (
            <div className="flex md:flex-col gap-3 md:max-h-[60vh] md:overflow-y-auto no-scrollbar">
              {images.map((/** @type {any} */ img, /** @type {number} */ i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-16 md:w-20 aspect-[4/5] shrink-0 overflow-hidden border ${activeImg === i ? "border-foreground" : "hairline"}`}>
                  <Image src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full" fittingType="fill" />
                </button>
              ))}
            </div>
          )}
          <div className="flex-1">
            <div className="aspect-[4/5] bg-muted overflow-hidden border hairline">
              {images[activeImg] && <Image src={images[activeImg]} alt={product.name} className="w-full h-full" fittingType="fill" />}
            </div>
          </div>
        </div>

        <div className="md:py-2">
          <div className="flex items-center gap-2 mb-3">
            {product.is_new && <span className="label-mono border hairline px-2 py-1 bg-background">{t("New", "ថ្មី")}</span>}
            {product.is_best_seller && <span className="label-mono border hairline px-2 py-1 bg-background">{t("Best Seller", "លក់ដាច់បំផុត")}</span>}
            {hasDiscount && <span className="label-mono bg-foreground text-background px-2 py-1">−{discountPct}%</span>}
            {b2bPriceOverride !== undefined && <span className="label-mono bg-emerald-700 text-white px-2 py-1 uppercase">{t("Wholesale Rate", "តម្លៃបោះដុំ")}</span>}
          </div>

          <h1 className="font-display text-3xl md:text-5xl tracking-[-0.04em] leading-[0.95]">
            {localizedTitle}
          </h1>

          <div
            className="mt-4 min-h-[28px] cursor-pointer"
            onMouseEnter={() => setShowBarcode(true)}
            onMouseLeave={() => setShowBarcode(false)}
            onClick={() => setShowBarcode((s) => !s)}
          >
            {!showBarcode ? (
              <p className="label-mono text-muted-foreground">SKU: {selectedVariant.sku || "—"}</p>
            ) : (
              <div className="transition-all duration-300">
                <BarcodeSVG value={selectedVariant.barcode || selectedVariant.sku || "000000000000"} />
                <p className="label-mono text-muted-foreground mt-1">{selectedVariant.barcode || t("No barcode", "គ្មានបាកូដ")}</p>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-3 mt-6">
            <span className="font-mono text-3xl tracking-tight text-foreground">{formatPrice(currentPrice)}</span>
            {(hasDiscount || b2bPriceOverride !== undefined) && <span className="font-mono text-lg text-muted-foreground line-through">{formatPrice(selectedVariant.price)}</span>}
          </div>
          {hasDiscount && (
            <p className="label-mono text-destructive mt-1">
              {t("You save", "អ្នកសន្សំបាន")} {formatPrice(selectedVariant.price - currentPrice)} ({discountPct}%)
            </p>
          )}

          <div className="mt-4 flex items-center gap-2 label-mono">
            <span className={`w-2 h-2 rounded-full ${soldOut ? "bg-destructive" : lowStock ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span className={soldOut ? "text-destructive" : "text-muted-foreground"}>
              {soldOut 
                ? t("Sold Out", "អស់ពីស្តុក") 
                : lowStock 
                  ? t(`Low Stock — ${stockAvailable} left`, `ស្តុកជិតអស់ — នៅសល់ ${stockAvailable}`) 
                  : t(`In Stock`, `មានក្នុងស្តុក`)}
            </span>
          </div>

          {product.variants?.length > 1 && (
            <div className="mt-8 border-t hairline pt-6">
              <p className="label-mono text-muted-foreground mb-3">{t("Variant Selection", "ការជ្រើសរើសប្រភេទ")}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((/** @type {any} */ v, /** @type {number} */ idx) => (
                  <button
                    key={v.id || idx}
                    onClick={() => { setSelectedVariant(v); setQty(1); }}
                    className={`min-w-[4rem] px-4 py-3 border label-mono text-xs transition-colors ${selectedVariant === v ? "bg-foreground text-background border-foreground" : "bg-background text-foreground hairline hover:border-foreground"}`}
                  >
                    {v.size || v.sku} {v.scent ? `· ${v.scent}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <p className="label-mono text-muted-foreground mb-3">{t("Quantity", "បរិមាណ")}</p>
            <div className="inline-flex items-center border hairline bg-background">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-3 hover:bg-muted" aria-label="Decrease"><Minus size={14} /></button>
              <span className="px-6 font-mono text-sm text-foreground">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, stockAvailable), q + 1))} className="px-4 py-3 hover:bg-muted" aria-label="Increase"><Plus size={14} /></button>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleAdd}
              disabled={soldOut}
              className="w-full bg-foreground text-background py-4 label-mono flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <ShoppingBag size={15} /> {t("Add to Bag", "បន្ថែមទៅកាបូប")}
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                onClick={handleBuyNow}
                disabled={soldOut}
                className="border border-foreground bg-background text-foreground py-4 label-mono hover:bg-foreground hover:text-background transition-colors disabled:opacity-40"
              >
                {t("Buy Now", "ទិញឥឡូវនេះ")}
              </button>
              <button
                onClick={() => toggleWishlist(product.id)}
                aria-label="Wishlist"
                className="border hairline bg-background px-5 flex items-center justify-center hover:border-foreground transition-colors"
              >
                <Heart size={16} fill={liked ? "currentColor" : "none"} className="text-foreground" />
              </button>
            </div>
          </div>

          <div className="mt-8 border-t hairline pt-6">
            <button onClick={() => setDescOpen((o) => !o)} className="flex items-center justify-between w-full label-mono text-foreground">
              <span>{t("Description", "ការពិពណ៌នា")}</span><Plus size={14} className={`transition-transform ${descOpen ? "rotate-45" : ""}`} />
            </button>
            {descOpen && (product.description || product.overview || product.overview_khmer) && (
              <p className="text-sm text-muted-foreground leading-relaxed mt-4 inertia-fade">
                {t(product.description || product.overview, product.overview_khmer || product.description)}
              </p>
            )}
          </div>

          <div className="mt-8 space-y-3 border-t hairline pt-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Truck size={16} /> {t("Complimentary global shipping over $250", "ដឹកជញ្ជូនឥតគិតថ្លៃសម្រាប់ការបញ្ជាទិញលើសពី 250 ដុល្លារ")}</div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><RotateCcw size={16} /> {t("30-day returns on unworn garments", "ត្រលប់មកវិញក្នុងរយៈពេល 30 ថ្ងៃ")}</div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><Shield size={16} /> {t("Authenticated & quality assured", "ធានាគុណភាពពិតប្រាកដ")}</div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t hairline py-16 md:py-24">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <Reveal className="mb-10">
              <p className="label-mono text-muted-foreground mb-3">— {t("Continue", "បន្ត")}</p>
              <h2 className="font-display text-4xl md:text-6xl tracking-[-0.04em]">{t("You May Also Covet.", "អ្នកប្រហែលជាចូលចិត្តផងដែរ។")}</h2>
            </Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-10">
              {related.map((/** @type {any} */ p, /** @type {number} */ i) => (
                <Reveal key={p.id} delay={(i % 4) * 70}>
                  <ProductCard product={p} index={i} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}