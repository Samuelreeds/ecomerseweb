// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { useLocalization } from "@/lib/localization-context";

const TABS = [
  { id: "terms", label: "Terms & Conditions", labelKh: "លក្ខខណ្ឌ" },
  { id: "privacy", label: "Privacy Policy", labelKh: "គោលការណ៍ឯកជនភាព" },
  { id: "shipping", label: "Shipping Policy", labelKh: "គោលការណ៍ដឹកជញ្ជូន" },
  { id: "returns", label: "Returns & Refunds", labelKh: "ការបង្វិលទំនិញ និងសងប្រាក់" },
];

export default function Legal() {
  const { t } = /** @type {any} */ (useLocalization());
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("terms");

  // Allow linking directly to a specific tab via URL hash (e.g., /legal#shipping)
  useEffect(() => {
    if (location.hash) {
      const hash = location.hash.replace("#", "");
      if (TABS.some((t) => t.id === hash)) {
        setActiveTab(hash);
      }
    }
  }, [location]);

  const updateTab = (id) => {
    setActiveTab(id);
    window.location.hash = id;
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 md:py-14">
          <p className="label-mono text-muted-foreground mb-3">— {t("Corporate", "សាជីវកម្ម")}</p>
          <h1 className="font-display text-4xl md:text-6xl tracking-[-0.04em] uppercase">
            {t("Legal & Policies", "ច្បាប់ និងគោលការណ៍")}
          </h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid md:grid-cols-[250px_1fr] gap-12 lg:gap-24">
        {/* Sidebar Navigation */}
        <aside className="md:sticky md:top-24 md:self-start space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateTab(tab.id)}
              className={`block w-full text-left px-4 py-3 font-mono text-sm uppercase tracking-wider transition-colors border-l-2 ${
                activeTab === tab.id
                  ? "border-foreground bg-muted/20 text-foreground font-bold"
                  : "border-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground"
              }`}
            >
              {t(tab.label, tab.labelKh)}
            </button>
          ))}
          
          <div className="mt-12 pt-8 border-t hairline px-4">
            <p className="label-mono text-muted-foreground text-[10px] uppercase mb-4">{t("Need Help?", "ត្រូវការជំនួយ?")}</p>
            <p className="text-sm font-mono text-foreground mb-1">noirmtd@gmail.com</p>
            <p className="text-sm font-mono text-foreground">+855 12 345 678</p>
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">Phnom Penh, Cambodia</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="max-w-3xl prose prose-neutral prose-sm md:prose-base prose-headings:font-display prose-headings:font-normal prose-headings:tracking-tight prose-a:text-foreground prose-a:underline-offset-4 pb-24">
          
          {activeTab === "terms" && (
            <div className="animate-in fade-in duration-300">
              <p className="label-mono text-muted-foreground text-xs uppercase mb-8">Last Updated: August 2026</p>
              <h2>1. Introduction</h2>
              <p>Welcome to NOIR MTD. These Terms & Conditions govern your use of our website and the purchase of products from us. By accessing our website, you agree to be bound by these terms.</p>
              <h2>2. Intellectual Property</h2>
              <p>All content published and made available on our site, including images, text, logos, and documents, is the property of NOIR MTD and the site's creators.</p>
              <h2>3. Sales and Goods</h2>
              <p>These terms govern the sale of cleaning and fragrance products available on our site. We are under a legal duty to supply goods that match the description provided, meet quality standards, and are fit for purpose.</p>
              <h2>4. Payments</h2>
              <p>We accept local bank transfers (KHQR) and Cash on Delivery (where applicable). All payments must be verified by our team before orders are confirmed and fulfilled. NOIR MTD reserves the right to cancel any order if fraudulent activity is suspected.</p>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="animate-in fade-in duration-300">
              <p className="label-mono text-muted-foreground text-xs uppercase mb-8">Last Updated: August 2026</p>
              <h2>1. Data Collection</h2>
              <p>We collect personal information necessary to fulfill your orders and provide a personalized shopping experience. This includes your name, email address, phone number, and shipping address.</p>
              <h2>2. Use of Information</h2>
              <p>Your data is strictly used for order processing, delivery, and internal operational analytics. We do not sell your personal data to third-party marketing agencies.</p>
              <h2>3. Security</h2>
              <p>We utilize industry-standard encryption and secure database infrastructure (Supabase) to protect your personal information. Payment processing via KHQR occurs outside our servers, ensuring your banking credentials remain private.</p>
              <h2>4. Cookies & Analytics</h2>
              <p>We use essential cookies to maintain your shopping cart and session. We may utilize privacy-friendly analytics to understand storefront performance and improve our services.</p>
            </div>
          )}

          {activeTab === "shipping" && (
            <div className="animate-in fade-in duration-300">
              <p className="label-mono text-muted-foreground text-xs uppercase mb-8">Last Updated: August 2026</p>
              <h2>1. Delivery Zones & Fees</h2>
              <p>We proudly deliver across Cambodia. Standard shipping rates apply based on your location:</p>
              <ul>
                <li><strong>Phnom Penh:</strong> $1.50 USD</li>
                <li><strong>Provinces:</strong> $2.50 USD</li>
              </ul>
              <h2>2. Processing Times</h2>
              <p>Orders are processed within 1-2 business days after payment verification. You will receive tracking updates in your Account Dashboard as your order moves from Packed to Shipped.</p>
              <h2>3. Failed Deliveries</h2>
              <p>If our courier cannot reach you after multiple attempts, the package will be returned to our facility. A re-delivery fee may apply for subsequent attempts.</p>
            </div>
          )}

          {activeTab === "returns" && (
            <div className="animate-in fade-in duration-300">
              <p className="label-mono text-muted-foreground text-xs uppercase mb-8">Last Updated: August 2026</p>
              <h2>1. Return Eligibility</h2>
              <p>Due to the nature of our cleaning and fragrance products, we only accept returns for items that are defective, damaged upon arrival, or incorrect. Returns must be requested within 7 days of delivery.</p>
              <h2>2. Process</h2>
              <p>To initiate a return, please contact our support team via Telegram or email with your Order Reference Number (e.g., MA-1A2B3C4D) and photographic proof of the issue.</p>
              <h2>3. Refunds</h2>
              <p>Approved refunds will be processed back to your original payment method (bank transfer) within 3-5 business days. Delivery fees are non-refundable unless the error was on our part.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}