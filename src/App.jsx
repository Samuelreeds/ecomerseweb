import React, { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { LocalizationProvider } from "./lib/localization-context";

// --- EAGER IMPORTS (Core Providers & Layouts only) ---
import StoreLayout from '@/components/store/StoreLayout';
import AccountLayout from '@/components/account/AccountLayout';

// --- LAZY IMPORTS (Route Code Splitting) ---
const Home = lazy(() => import('@/pages/Home'));
const Shop = lazy(() => import('@/pages/Shop'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Legal = lazy(() => import('@/pages/Legal'));

const AccountProfile = lazy(() => import('@/pages/account/Profile'));
const AccountOrders = lazy(() => import('@/pages/account/Orders'));
const AccountAddresses = lazy(() => import('@/pages/account/Addresses'));

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));

// Global loading skeleton for Suspense transitions
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <LocalizationProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Main Public Store */}
                <Route element={<StoreLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                </Route>

                {/* Secure Customer Account Area */}
                <Route path="/account" element={<AccountLayout />}>
                  <Route index element={<AccountProfile />} />
                  <Route path="orders" element={<AccountOrders />} />
                  <Route path="addresses" element={<AccountAddresses />} />
                </Route>

                <Route path="/legal" element={<Legal />} />

                {/* 404 Fallback */}
                <Route path="*" element={<PageNotFound />} />
              </Routes>
            </Suspense>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </LocalizationProvider>
  );
}