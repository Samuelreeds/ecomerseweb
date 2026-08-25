// @ts-nocheck
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, Heart, User, Menu, X, ChevronDown, Globe, Coins } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/AuthContext";
import { useLocalization } from "@/lib/localization-context";
import { supabase } from "@/lib/supabase";
import { useQuery } from '@tanstack/react-query';

const NAV = [
  { label: "Home", labelKh: "ទំព័រដើម", path: "/" },
  { label: "Shop", labelKh: "ទិញទំនិញ", path: "/shop" },
  { label: "Categories", labelKh: "ប្រភេទ", path: "/shop?view=categories" },
  { label: "About", labelKh: "អំពីយើង", path: "/about" },
  { label: "Contact", labelKh: "ទំនាក់ទំនង", path: "/contact" },
];

export default function Navbar({ onOpenSearch }) {
  const { totals, openDrawer, wishlist } = useCart();
  const { user } = useAuth();
  const { language, setLanguage, currency, setCurrency, t } = useLocalization();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false); 
  const navigate = useNavigate();

  const { data: categories = [] } = useQuery({
    queryKey: ['navbar-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('status', true)
        .order('ordering', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b hairline">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-16 md:h-20 px-4 md:px-8">
          
          {/* left — desktop nav / mobile menu */}
          <div className="flex items-center gap-6 h-full">
            <button
              className="md:hidden p-1 -ml-1 hover:opacity-60 transition-opacity"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <nav className="hidden md:flex items-center gap-7 h-full">
              {NAV.slice(0, 3).map((n) => {
                const displayName = t(n.label, n.labelKh);
                
                if (n.label === "Categories") {
                  return (
                    <div key={n.label} className="relative group h-full flex items-center">
                      <Link
                        to={n.path}
                        className="label-mono text-foreground/80 group-hover:text-foreground transition-colors flex items-center gap-1.5"
                      >
                        {displayName}
                        <ChevronDown size={14} className="opacity-60 group-hover:rotate-180 transition-transform duration-300" />
                      </Link>
                      
                      {/* Dropdown Menu */}
                      <div className="absolute top-[100%] left-0 w-56 pt-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="bg-background border hairline shadow-xl flex flex-col">
                          {categories.length > 0 ? (
                            categories.map((cat) => (
                              <Link
                                key={cat.id}
                                to={`/shop?category=${encodeURIComponent(cat.title || cat.name)}`}
                                className="px-5 py-3.5 label-mono text-[11px] text-foreground/70 hover:text-foreground hover:bg-muted transition-colors border-b hairline last:border-b-0 uppercase tracking-widest"
                              >
                                {t(cat.title || cat.name, cat.name_khmer || cat.name)}
                              </Link>
                            ))
                          ) : (
                            <div className="px-5 py-3.5 label-mono text-[11px] text-muted-foreground uppercase">No categories</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={n.label}
                    to={n.path}
                    className="label-mono text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {displayName}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* center — NOIR MTD Logo */}
          <Link 
            to="/" 
            className="flex items-center justify-center leading-none hover:opacity-80 transition-opacity"
          >
            <img 
              src="/logo.png" 
              alt="NOIR MTD Logo" 
              className="h-6 md:h-8 w-auto object-contain" 
            />
          </Link>

          {/* right — actions */}
          <div className="flex items-center justify-end gap-4 md:gap-5 h-full">
            <nav className="hidden md:flex items-center gap-7 h-full">
              {NAV.slice(3).map((n) => (
                <Link
                  key={n.label}
                  to={n.path}
                  className="label-mono text-foreground/80 hover:text-foreground transition-colors"
                >
                  {t(n.label, n.labelKh)}
                </Link>
              ))}
            </nav>

            {/* --- LOCALIZATION TOGGLES (DESKTOP) --- */}
            <div className="hidden md:flex items-center gap-3 ml-2 mr-2 pr-4 border-r hairline h-6">
              <button 
                onClick={() => setLanguage(l => l === 'EN' ? 'KH' : 'EN')} 
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-9"
                title="Switch Language"
              >
                {language}
              </button>
              <button 
                onClick={() => setCurrency(c => c === 'USD' ? 'KHR' : 'USD')} 
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 w-9"
                title="Switch Currency"
              >
                {currency}
              </button>
            </div>

            <button onClick={onOpenSearch} aria-label="Search" className="hover:opacity-60 transition-opacity">
              <Search size={18} strokeWidth={1.5} />
            </button>

            <Link to="/account" aria-label="Account" className="hover:opacity-60 transition-opacity hidden sm:block">
              <User size={18} strokeWidth={1.5} />
            </Link>
            <Link to="/wishlist" aria-label="Wishlist" className="relative hover:opacity-60 transition-opacity hidden sm:block">
              <Heart size={18} strokeWidth={1.5} />
              {wishlist.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[9px] font-mono w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <button onClick={openDrawer} aria-label="Cart" className="relative hover:opacity-60 transition-opacity">
              <ShoppingBag size={18} strokeWidth={1.5} />
              {totals.itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-foreground text-background text-[9px] font-mono w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {totals.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-xs bg-background p-6 flex flex-col inertia-up overflow-y-auto">
            <div className="flex items-center justify-between mb-10 shrink-0">
              <div className="flex items-center">
                <img src="/logo.png" alt="NOIR MTD Logo" className="h-6 w-auto object-contain" />
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="hover:opacity-60 transition-opacity"><X size={20} strokeWidth={1.5} /></button>
            </div>
            
            <nav className="flex flex-col gap-2 flex-1">
              {NAV.map((n, i) => {
                const displayName = t(n.label, n.labelKh);
                
                if (n.label === "Categories") {
                  return (
                    <div key={n.label} className="flex flex-col w-full">
                      <button
                        onClick={() => {
                          if (!mobileCatOpen) {
                            setMobileCatOpen(true);
                          } else {
                            setMobileOpen(false);
                            navigate(n.path);
                          }
                        }}
                        className={`text-left font-display text-3xl py-2 transition-all duration-500 flex items-center justify-between w-full ${language === 'KH' ? 'tracking-normal' : 'tracking-[-0.04em] hover:translate-x-2'}`}
                        style={{ transitionDelay: `${i * 40}ms` }}
                      >
                        {displayName}
                        <ChevronDown size={24} strokeWidth={1.5} className={`transition-transform duration-300 opacity-60 ${mobileCatOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {mobileCatOpen && categories.length > 0 && (
                        <div className="flex flex-col gap-2 pl-4 py-3 border-l-2 border-muted ml-2 mt-1 animate-in slide-in-from-top-2 duration-300">
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => { 
                                setMobileOpen(false); 
                                navigate(`/shop?category=${encodeURIComponent(cat.title || cat.name)}`); 
                              }}
                              className={`text-left font-display text-xl py-1 text-muted-foreground hover:text-foreground transition-colors w-full ${language === 'KH' ? 'tracking-normal' : 'tracking-[-0.02em]'}`}
                            >
                              {t(cat.title || cat.name, cat.name_khmer || cat.name)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={n.label}
                    onClick={() => { setMobileOpen(false); navigate(n.path); }}
                    className={`text-left font-display text-3xl py-2 transition-all duration-500 w-full ${language === 'KH' ? 'tracking-normal' : 'tracking-[-0.04em] hover:translate-x-2'}`}
                    style={{ transitionDelay: `${i * 40}ms` }}
                  >
                    {displayName}
                  </button>
                );
              })}
            </nav>
            
            <div className="mt-8 flex flex-col gap-5 pt-6 border-t hairline shrink-0">
              {/* --- LOCALIZATION TOGGLES (MOBILE) --- */}
              <div className="flex items-center gap-6 pb-4 border-b hairline">
                <button 
                  onClick={() => setLanguage(l => l === 'EN' ? 'KH' : 'EN')}
                  className="flex items-center gap-2 label-mono text-muted-foreground hover:text-foreground"
                >
                  <Globe size={16} /> {language === 'EN' ? 'English' : 'ភាសាខ្មែរ'}
                </button>
                <button 
                  onClick={() => setCurrency(c => c === 'USD' ? 'KHR' : 'USD')}
                  className="flex items-center gap-2 label-mono text-muted-foreground hover:text-foreground"
                >
                  <Coins size={16} /> {currency}
                </button>
              </div>

              <div className="flex items-center gap-6">
                <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 label-mono"><Heart size={16} /> Wishlist</Link>
                <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 label-mono"><User size={16} /> Account</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}