// @ts-nocheck
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";

const CartContext = createContext(/** @type {any} */ (null));

const load = (/** @type {string} */ key, /** @type {any} */ fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * @param {{ children: React.ReactNode }} props 
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => /** @type {any[]} */ (load("atelier_cart", [])));
  const [wishlist, setWishlist] = useState(() => /** @type {string[]} */ (load("atelier_wishlist", [])));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [cartExpiresAt, setCartExpiresAt] = useState(() => localStorage.getItem("atelier_cart_expires_at") || null);

  useEffect(() => { localStorage.setItem("atelier_cart", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("atelier_wishlist", JSON.stringify(wishlist)); }, [wishlist]);

  useEffect(() => {
    if (!cartExpiresAt || items.length === 0) return;

    const interval = setInterval(() => {
      if (Date.now() > parseInt(cartExpiresAt, 10)) {
        setItems([]);
        setCartExpiresAt(null);
        localStorage.removeItem("atelier_cart");
        localStorage.removeItem("atelier_cart_expires_at");
        alert("Your cart reservation has expired. The items have been released.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cartExpiresAt, items.length]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    trackEvent('view_cart');
  }, []);
  
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback((/** @type {any} */ product, /** @type {any} */ { variant_id, sku, size, color, quantity = 1, max_stock = product.inventory ?? product.stock ?? Infinity, price }) => {
    setItems((/** @type {any[]} */ prev) => {
      const key = `${product.id}|${size}|${color}`;
      const existing = prev.find((i) => i.key === key);
      
      const finalPrice = price ?? (product.discount_price != null ? product.discount_price : product.price);
      
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, existing.max_stock ?? max_stock);
        trackEvent('add_to_cart', { product_id: product.id, variant_id, value: finalPrice, metadata: { quantity, updated: true } });
        return prev.map((i) => i.key === key ? { ...i, quantity: newQty } : i);
      }
      
      trackEvent('add_to_cart', { product_id: product.id, variant_id, value: finalPrice, metadata: { quantity, sku, new_item: true } });
      
      return [...prev, {
        key,
        product_id: product.id,
        name: product.name,
        price: finalPrice,
        original_price: product.price,
        image: product.images?.[0],
        size,
        color,
        quantity: Math.min(quantity, max_stock), 
        max_stock, 
      }];
    });

    const expiryTime = Date.now() + 10 * 60 * 1000;
    setCartExpiresAt(expiryTime.toString());
    localStorage.setItem('atelier_cart_expires_at', expiryTime.toString());

    setDrawerOpen(true);
  }, []);

  const removeItem = useCallback((/** @type {string} */ key) => {
    setItems((/** @type {any[]} */ prev) => {
      const itemToRemove = prev.find(i => i.key === key);
      if (itemToRemove) {
        trackEvent('remove_from_cart', { product_id: itemToRemove.product_id, value: itemToRemove.price });
      }
      
      const newItems = prev.filter((i) => i.key !== key);
      if (newItems.length === 0) {
        setCartExpiresAt(null);
        localStorage.removeItem("atelier_cart_expires_at");
      }
      return newItems;
    });
  }, []);

  const updateQty = useCallback((/** @type {string} */ key, /** @type {number} */ quantity) => {
    setItems((/** @type {any[]} */ prev) => prev.map((i) => {
      if (i.key === key) {
        const max = i.max_stock ?? Infinity;
        return { ...i, quantity: Math.max(1, Math.min(quantity, max)) };
      }
      return i;
    }));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCartExpiresAt(null);
    localStorage.removeItem("atelier_cart_expires_at");
  }, []);

  const toggleWishlist = useCallback((/** @type {string} */ productId) => {
    setWishlist((/** @type {string[]} */ prev) => {
      if (prev.includes(productId)) {
        trackEvent('wishlist_remove', { product_id: productId });
        return prev.filter((id) => id !== productId);
      } else {
        trackEvent('wishlist_add', { product_id: productId });
        return [...prev, productId];
      }
    });
  }, []);

  const totals = useMemo(() => {
    const subtotal = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + i.price * i.quantity, 0);
    const originalSubtotal = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + (i.original_price ?? i.price) * i.quantity, 0);
    const itemCount = items.reduce((/** @type {number} */ s, /** @type {any} */ i) => s + i.quantity, 0);
    const shippingFee = subtotal > 250 || subtotal === 0 ? 0 : 18;
    const tax = +(subtotal * 0.08).toFixed(2);
    const total = +(subtotal + shippingFee + tax).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), originalSubtotal, itemCount, shippingFee, tax, total };
  }, [items]);

  const value = useMemo(() => ({
    items, wishlist, drawerOpen, openDrawer, closeDrawer,
    addItem, removeItem, updateQty, clearCart, toggleWishlist, totals, cartExpiresAt,
    isInWishlist: (/** @type {string} */ id) => wishlist.includes(id),
  }), [items, wishlist, drawerOpen, openDrawer, closeDrawer, addItem, removeItem, updateQty, clearCart, toggleWishlist, totals, cartExpiresAt]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}