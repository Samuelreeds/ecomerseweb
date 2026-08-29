// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Lock, ArrowRight, Smartphone, Clock, UploadCloud } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/AuthContext";
import { useLocalization } from "@/lib/localization-context";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import { trackEvent, getSalesChannel } from "@/lib/analytics";

/** @type {any} */
const Image = BaseImage;

const CAMBODIA_PROVINCES = [
  "Banteay Meanchey", "Battambang", "Kampong Cham", "Kampong Chhnang",
  "Kampong Speu", "Kampong Thom", "Kampot", "Kandal", "Kep",
  "Koh Kong", "Kratie", "Mondulkiri", "Oddar Meanchey", "Pailin",
  "Phnom Penh", "Preah Sihanouk", "Preah Vihear", "Prey Veng",
  "Pursat", "Ratanakiri", "Siem Reap", "Stung Treng", "Svay Rieng",
  "Takeo", "Tboung Khmum"
];

export default function Checkout() {
  const { items, totals, clearCart, cartExpiresAt } = /** @type {any} */ (useCart());
  const { user } = /** @type {any} */ (useAuth());
  const { formatPrice, t } = useLocalization(); 
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    name: "", phone: "",
    address: "", province: "",
    transactionImage: /** @type {File | null} */ (null),
  });
  
  const [placing, setPlacing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(/** @type {string | null} */ (null));
  const [createdOrder, setCreatedOrder] = useState(/** @type {any} */ (null));
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCartExpiredModal, setShowCartExpiredModal] = useState(false);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showQRPopup, setShowQRPopup] = useState(false);

  const [storeSettings, setStoreSettings] = useState({
    shipping_pp_price: 1.50,
    shipping_province_price: 2.50,
    enable_tax: false,
    tax_rate: 0,
    require_telegram_checkout: false
  });

  useEffect(() => {
    supabase.from('store_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        setStoreSettings({
          shipping_pp_price: data.shipping_pp_price ?? 1.50,
          shipping_province_price: data.shipping_province_price ?? 2.50,
          enable_tax: !!data.enable_tax,
          tax_rate: data.tax_rate ?? 0,
          require_telegram_checkout: !!data.require_telegram_checkout
        });
      }
    });
    
    // --- ANALYTICS: BEGIN CHECKOUT ---
    if (items.length > 0 && !done) {
      trackEvent('begin_checkout', { value: totals.total });
    }
  }, []);

  useEffect(() => {
    if (user) {
      setForm(f => ({
        ...f,
        name: user.full_name || f.name,
        phone: user.phone || f.phone
      }));
    }
  }, [user]);

  const set = (/** @type {string} */ k, /** @type {any} */ v) => setForm((f) => ({ ...f, [k]: v }));

  const validDelivery = !!(form.name && form.phone && form.address && form.province);
  const validPayment = !!form.transactionImage;

  const activeShippingFee = form.province 
    ? (form.province.trim().toLowerCase() === "phnom penh" 
        ? storeSettings.shipping_pp_price 
        : storeSettings.shipping_province_price) 
    : 0; 
  
  const activeTaxAmount = storeSettings.enable_tax 
    ? (totals.subtotal * (storeSettings.tax_rate / 100))
    : 0;

  const activeTotal = totals.subtotal + activeShippingFee + activeTaxAmount;

  const handleCartExpiredAcknowledge = () => {
    setShowCartExpiredModal(false); 
    clearCart(); 
    navigate("/shop"); 
  };

  const handlePlaceOrderClick = async () => {
    if (cartExpiresAt && Date.now() > parseInt(cartExpiresAt, 10)) {
      setShowCartExpiredModal(true); return; 
    }
    
    const isTelegramConnected = user?.app_metadata?.providers?.includes('telegram') || 
                                user?.user_metadata?.telegram_id || 
                                user?.email?.includes('telegram');

    if (storeSettings.require_telegram_checkout && (!user || !isTelegramConnected)) {
      setShowAuthModal(true); 
      return;
    }

    setPlacing(true);
    try {
      const finalUserId = (user && user.id) ? user.id : null;
      
      const mappedItems = items.map((/** @type {any} */ i) => {
        const cleanProductId = i.product_id || (typeof i.id === 'string' && i.id.includes('-') && i.id.length > 36 ? i.id.substring(0, 36) : i.id);
        return {
          product_id: cleanProductId,
          quantity: i.quantity,
          selected_size: i.size || null,
          selected_color: i.color || null
        };
      });

      const { data: orderId, error: rpcError } = await supabase.rpc('create_checkout_order', {
        p_user_id: finalUserId,
        p_name: form.name,
        p_phone: form.phone,
        p_address: form.address,
        p_province: form.province,
        p_items: mappedItems,
        p_sales_channel: getSalesChannel() // Pass dynamically captured attribution channel
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setCreatedOrder({ id: orderId });
      setShowQRPopup(true);
    } catch (/** @type {any} */ e) {
      console.error("Order Creation Error:", e);
      if (e.message?.includes('orders_user_id_fkey')) {
        await supabase.auth.signOut();
        alert(t("Your session is invalid. You have been signed out.", "វគ្គរបស់អ្នកមិនត្រឹមត្រូវ។"));
        window.location.reload();
        return;
      }
      alert(e.message || t("Order could not be initialized.", "មិនអាចចាប់ផ្តើមការបញ្ជាទិញទេ។"));
    }
    setPlacing(false);
  };

  const submitPaymentReceipt = async () => {
    if (!createdOrder || !form.transactionImage) return;
    setUploading(true);
    
    try {
      const finalUserId = (user && user.id) ? user.id : 'guest';
      const fileExt = form.transactionImage.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${finalUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, form.transactionImage);
      if (uploadError) throw new Error("Failed to upload receipt image.");

      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase.from('orders').update({
        transaction_receipt_url: publicUrlData.publicUrl
      }).eq('id', createdOrder.id);

      if (updateError) throw updateError;
      
      // --- ANALYTICS: PURCHASE CONVERSION ---
      trackEvent('purchase', {
        order_id: createdOrder.id,
        value: activeTotal,
        metadata: { items: items.length }
      });

      setShowQRPopup(false);
      clearCart();
      setDone(`MA-${createdOrder.id.slice(-8).toUpperCase()}`);
    } catch (/** @type {any} */ e) {
      console.error("Payment Submission Error:", e);
      alert(e.message || t("Payment could not be submitted.", "មិនអាចបញ្ជូនការបង់ប្រាក់បានទេ។"));
    }
    setUploading(false);
  };

  if (done) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 bg-background">
        <div className="max-w-md w-full border hairline p-8 md:p-12 text-center relative overflow-hidden bg-white shadow-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-foreground"></div>
          
          <div className="w-16 h-16 border hairline bg-background rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Check size={24} strokeWidth={1.5} className="text-foreground" />
          </div>
          
          <h1 className="font-display text-4xl tracking-tight mb-2">{t("Thank You.", "សូមអរគុណ។")}</h1>
          <p className="label-mono text-[10px] text-muted-foreground mb-8 tracking-widest uppercase">{t("Order Confirmed", "ការបញ្ជាទិញត្រូវបានបញ្ជាក់")}</p>
          
          <div className="py-6 border-y hairline mb-8 space-y-4">
            <p className="text-sm text-muted-foreground">{t("Your order reference is", "លេខកូដបញ្ជាទិញរបស់អ្នកគឺ")}</p>
            <p className="font-mono text-xl md:text-2xl text-foreground font-medium tracking-tight bg-muted/30 py-3 rounded-sm">{done}</p>
          </div>
          
          <div className="bg-muted/10 border hairline p-5 mb-8 text-left relative overflow-hidden flex items-start gap-4">
            <div className="absolute left-0 top-0 h-full w-1 bg-amber-500/80"></div>
            <Clock className="text-amber-600 mt-0.5 shrink-0" size={18} />
            <div>
              <p className="font-mono text-xs text-foreground uppercase font-semibold tracking-wider mb-1.5">{t("Payment Verification Pending", "រង់ចាំការផ្ទៀងផ្ទាត់ការបង់ប្រាក់")}</p>
              <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">{t("Our team will verify your KHQR transfer shortly before processing your delivery. You will receive an update once confirmed.", "ក្រុមការងាររបស់យើងនឹងផ្ទៀងផ្ទាត់ការផ្ទេរប្រាក់ KHQR របស់អ្នកក្នុងពេលឆាប់ៗ មុនពេលដំណើរការការដឹកជញ្ជូនរបស់អ្នក។")}</p>
            </div>
          </div>

          <Link to="/shop" className="inline-flex items-center justify-center gap-2 w-full bg-foreground text-background py-4 label-mono transition-opacity hover:opacity-90">
            {t("Continue Shopping", "បន្តការទិញទំនិញ")} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !showQRPopup) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="font-display text-3xl tracking-[-0.04em]">{t("Your bag is empty.", "កាបូបរបស់អ្នកទទេរ។")}</p>
        <Link to="/shop" className="label-mono border-b border-foreground pb-1">{t("Explore the Collection", "ស្វែងរកផលិតផល")}</Link>
      </div>
    );
  }

  const inputCls = "w-full border hairline px-4 py-3 outline-none focus:border-foreground font-mono text-sm bg-background";

  return (
    <div className="bg-background relative">
      <div className="border-b hairline">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
          <Link to="/" className="font-display text-sm tracking-[-0.04em]">NOIR MTD</Link>
          <h1 className="font-display text-4xl md:text-5xl tracking-[-0.04em] mt-4">{t("Checkout.", "ការទូទាត់ប្រាក់.")}</h1>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-10 grid lg:grid-cols-[1fr_400px] gap-12">
        
        {/* Delivery Details Form */}
        <div>
          <div className="border hairline">
            <div className="w-full flex items-center gap-4 px-6 py-5 border-b hairline bg-muted/10">
              <span className="font-display text-lg tracking-[-0.04em] uppercase">{t("Delivery Details", "ព័ត៌មានលម្អិតអំពីការដឹកជញ្ជូន")}</span>
            </div>
            
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <input className={inputCls} placeholder={t("Full Name", "ឈ្មោះពេញ")} value={form.name} onChange={(e) => set("name", e.target.value)} />
                <input className={inputCls} type="tel" placeholder={t("Phone Number", "លេខទូរស័ព្ទ")} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                <input className={`${inputCls} sm:col-span-2`} placeholder={t("Full Address (Street, House No.)", "អាសយដ្ឋានពេញលេញ (ផ្លូវ, លេខផ្ទះ)")} value={form.address} onChange={(e) => set("address", e.target.value)} />
                
                <div className="relative sm:col-span-2">
                  <div className="relative flex items-center">
                    <input 
                      className={inputCls} 
                      placeholder={t("Search or Select Province", "ស្វែងរក ឬជ្រើសរើសខេត្ត")} 
                      value={form.province} 
                      onChange={(e) => {
                        set("province", e.target.value);
                        setShowProvinceDropdown(true);
                      }}
                      onFocus={() => setShowProvinceDropdown(true)}
                      onBlur={() => setTimeout(() => setShowProvinceDropdown(false), 200)}
                    />
                    <ChevronDown size={16} className="absolute right-4 text-muted-foreground pointer-events-none" />
                  </div>
                  
                  {showProvinceDropdown && (
                    <div 
                      className="absolute top-full left-0 w-full bg-background border hairline max-h-48 overflow-y-auto z-20 shadow-xl mt-1 inertia-fade"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {CAMBODIA_PROVINCES.filter(p => p.toLowerCase().includes(form.province.toLowerCase())).map(p => (
                        <div
                          key={p}
                          className="px-4 py-3 font-mono text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            set("province", p);
                            setShowProvinceDropdown(false);
                          }}
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button onClick={handlePlaceOrderClick} disabled={!validDelivery || placing} className="w-full bg-foreground text-background py-5 mt-6 label-mono flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90">
            {placing ? t("Processing...", "កំពុងដំណើរការ...") : <>{t("Confirm Details & Pay", "បញ្ជាក់ព័ត៌មាន និងបង់ប្រាក់")} — {formatPrice(activeTotal)}</>}
          </button>
          <p className="flex items-center justify-center gap-2 mt-4 label-mono text-muted-foreground text-[10px]"><Lock size={11} /> {t("Secure encrypted checkout", "ការទូទាត់ត្រូវបានអ៊ិនគ្រីបដោយសុវត្ថិភាព")}</p>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="border hairline p-6">
            <p className="label-mono text-muted-foreground mb-5">{t("— Order Summary", "— សេចក្តីសង្ខេបនៃការបញ្ជាទិញ")}</p>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto no-scrollbar pt-2 pr-2">
              {items.map((/** @type {any} */ i) => (
                <div key={i.key} className="flex gap-4">
                  <div className="relative shrink-0 mt-1">
                    <div className="w-14 h-16 bg-muted overflow-hidden border hairline">
                      {i.image && <Image src={i.image} alt={i.name} className="w-full h-full object-cover" fittingType="fill" />}
                    </div>
                    <span className="absolute -top-2.5 -right-2.5 bg-foreground text-background w-[18px] h-[18px] rounded-full flex items-center justify-center font-mono text-[9px] z-10 border border-background shadow-sm">
                      {i.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t(i.name, i.name)}</p>
                    <p className="label-mono text-muted-foreground text-[10px] mt-0.5">{t(i.color, i.color)} · {t(i.size, i.size)}</p>
                  </div>
                  <span className="font-mono text-sm">{formatPrice(i.price * i.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t hairline mt-5 pt-5 space-y-2.5">
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>{t("Subtotal", "សរុបរង")}</span>
                <span className="font-mono text-foreground">{formatPrice(totals.subtotal)}</span>
              </div>
              
              <div className="flex justify-between label-mono text-muted-foreground">
                <span>{t("Shipping", "ការដឹកជញ្ជូន")}</span>
                <span className="font-mono text-foreground">{formatPrice(activeShippingFee)}</span>
              </div>
              
              {storeSettings.enable_tax && (
                <div className="flex justify-between label-mono text-muted-foreground">
                  <span>{t("Tax", "ពន្ធ")} ({storeSettings.tax_rate}%)</span>
                  <span className="font-mono text-foreground">{formatPrice(activeTaxAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between pt-3 border-t hairline">
                <span className="font-display uppercase">{t("Total", "សរុប")}</span>
                <span className="font-mono text-xl">{formatPrice(activeTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- TELEGRAM AUTH MODAL --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-background border hairline max-w-md w-full p-8 shadow-2xl inertia-fade text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone size={32} />
            </div>
            <h3 className="font-display text-2xl tracking-[-0.04em] mb-2">
              {!user ? "Sign In Required" : "Telegram Required"}
            </h3>
            <p className="text-muted-foreground mb-8 font-mono text-sm px-4">
              {!user 
                ? "Please sign in to securely track and complete your order." 
                : "This order requires a connected Telegram account for security and tracking."}
            </p>
            <div className="space-y-3">
              <button onClick={() => alert("Telegram Login Integration Coming Soon!")} className="w-full py-3.5 bg-[#229ED9] text-white label-mono transition-opacity hover:opacity-90 flex justify-center items-center gap-2">
                Continue with Telegram
              </button>
              <button onClick={() => setShowAuthModal(false)} className="w-full py-3.5 border hairline label-mono hover:bg-muted/50 transition-colors text-muted-foreground">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- QR PAYMENT POPUP WITH FILE UPLOAD --- */}
      {showQRPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm overflow-y-auto">
          <div className="bg-background border hairline max-w-sm w-full p-6 shadow-2xl inertia-fade relative my-8">
            <div className="text-center mb-6">
              <h3 className="font-display text-2xl tracking-[-0.04em] uppercase">{t("Complete Payment", "បញ្ចប់ការបង់ប្រាក់")}</h3>
              <p className="text-muted-foreground font-mono text-xs mt-2">{t("Order", "ការបញ្ជាទិញ")} <span className="text-foreground">MA-{createdOrder?.id?.slice(-8).toUpperCase()}</span> {t("saved successfully.", "បានរក្សាទុកដោយជោគជ័យ។")}</p>
            </div>

            <div className="border hairline bg-muted/10 p-6 flex flex-col items-center mb-6">
              <p className="font-mono text-sm text-foreground mb-4 uppercase tracking-wider font-semibold">{t("Total", "សរុប")}: {formatPrice(activeTotal)}</p>
              <div className="w-48 h-48 bg-white p-2 border hairline mb-4">
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MONOLITHIC_ATELIER_KHQR_PLACEHOLDER" 
                  alt="Company KHQR" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <p className="label-mono text-muted-foreground text-[10px] text-center">{t("Scan with any Cambodia banking app (KHQR) to transfer.", "ស្កេនជាមួយកម្មវិធីធនាគារកម្ពុជាណាមួយ (KHQR) ដើម្បីផ្ទេរប្រាក់។")}</p>
            </div>

            <div className="space-y-2 mb-6">
              <label className="label-mono text-muted-foreground text-[10px] uppercase">{t("Upload Payment Screenshot", "បញ្ចូលរូបថតអេក្រង់នៃការបង់ប្រាក់")}</label>
              <div className="relative">
                <input 
                  type="file"
                  accept="image/*"
                  onChange={(e) => set("transactionImage", e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`w-full border hairline px-4 py-3 font-mono text-sm flex items-center justify-between transition-colors ${form.transactionImage ? 'bg-muted/30 text-foreground' : 'bg-background text-muted-foreground'}`}>
                  <span className="truncate">{form.transactionImage ? form.transactionImage.name : t("Select image file...", "ជ្រើសរើសឯកសាររូបភាព...")}</span>
                  <UploadCloud size={16} className="shrink-0 ml-2" />
                </div>
              </div>
            </div>

            <button 
              onClick={submitPaymentReceipt} 
              disabled={!validPayment || uploading} 
              className="w-full bg-foreground text-background py-4 mt-2 label-mono flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
            >
              {uploading ? t("Submitting...", "កំពុងបញ្ជូន...") : t("I Have Paid — Complete Order", "ខ្ញុំបានបង់ប្រាក់រួចហើយ — បញ្ចប់ការបញ្ជាទិញ")}
            </button>
          </div>
        </div>
      )}

      {showCartExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-background border hairline max-w-md w-full p-6 shadow-2xl inertia-fade relative z-[60]">
            <h3 className="font-display text-2xl tracking-[-0.04em] mb-2">Cart Reservation Expired</h3>
            <p className="text-muted-foreground mb-6 font-mono text-sm">
              Your cart reservation has expired after 10 minutes. Please add the items again.
            </p>
            <div className="flex gap-4">
              <button onClick={handleCartExpiredAcknowledge} className="w-full py-3 bg-foreground text-background label-mono transition-opacity hover:opacity-90">Return to Shop</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}