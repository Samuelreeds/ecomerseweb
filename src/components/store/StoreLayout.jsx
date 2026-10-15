// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CartProvider } from "@/lib/cart-context";
import ScrollProgress from "./ScrollProgress";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";
import SearchOverlay from "./SearchOverlay";
import { captureAttribution, trackEvent } from "@/lib/analytics";

export default function StoreLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check URL for UTMs on first global mount/navigation
    captureAttribution();
    
    // Log Page View automatically on route change
    trackEvent('page_view', {
      metadata: { path: location.pathname }
    });
  }, [location.pathname]);

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <ScrollProgress />
        <Navbar onOpenSearch={() => setSearchOpen(true)} />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <CartDrawer />
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </CartProvider>
  );
}