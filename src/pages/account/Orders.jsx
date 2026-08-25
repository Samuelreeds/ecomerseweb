// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { ChevronDown, Check, XCircle, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import { useLocalization } from "@/lib/localization-context";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** @type {any} */
const Image = BaseImage;

const STATUSES = ["pending", "packed", "shipping", "delivered"];

// --- PDF GENERATOR FUNCTION ---
const generateInvoicePDF = (order, formatPrice) => {
  const doc = new jsPDF();
  
  // 1. Header (Brand)
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("NOIR MTD", 14, 22);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("OFFICIAL INVOICE", 195, 22, { align: "right" });
  
  // 2. Order Meta
  doc.setTextColor(0);
  doc.text(`Order Ref: MA-${order.id.slice(-8).toUpperCase()}`, 14, 34);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 14, 40);
  doc.text(`Payment: ${order.payment_method === 'qr' ? 'Bank Transfer (Paid)' : 'Cash on Delivery'}`, 14, 46);
  
  // 3. Customer Details
  doc.setFont("helvetica", "bold");
  doc.text("Billed To:", 120, 34);
  doc.setFont("helvetica", "normal");
  doc.text(order.shipping_address?.name || "N/A", 120, 40);
  doc.text(order.shipping_address?.phone || "N/A", 120, 46);
  doc.text(order.shipping_address?.address || "N/A", 120, 52);
  doc.text(`${order.shipping_address?.province || "N/A"}, Cambodia`, 120, 58);
  
  // 4. Line Items Table
  const tableData = order.items.map(item => [
    item.name,
    `${item.color} / ${item.size}`,
    item.quantity.toString(),
    formatPrice(item.price),
    formatPrice(item.price * item.quantity)
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['Product', 'Variant', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'plain',
    headStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6 },
    alternateRowStyles: { fillColor: [248, 248, 248] }
  });

  // 5. Totals Footer
  const finalY = doc.lastAutoTable.finalY + 12;
  
  doc.text(`Subtotal:`, 140, finalY);
  doc.text(formatPrice(order.subtotal || 0), 195, finalY, { align: "right" });
  
  doc.text(`Shipping:`, 140, finalY + 8);
  doc.text(formatPrice(order.shipping_fee || 0), 195, finalY + 8, { align: "right" });
  
  if (order.tax > 0) {
    doc.text(`Tax:`, 140, finalY + 16);
    doc.text(formatPrice(order.tax), 195, finalY + 16, { align: "right" });
  }
  
  const totalY = finalY + (order.tax > 0 ? 26 : 18);
  doc.setFont("helvetica", "bold");
  doc.text(`Grand Total:`, 140, totalY);
  doc.text(formatPrice(order.total), 195, totalY, { align: "right" });

  // 6. Footer Assurances
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Thank you for your purchase.", 105, 275, { align: "center" });
  doc.text("For support, contact us at noirmtd@gmail.com", 105, 280, { align: "center" });

  // Save the PDF!
  doc.save(`NOIR_Invoice_MA-${order.id.slice(-8).toUpperCase()}.pdf`);
};

export default function AccountOrders() {
  const { user } = /** @type {any} */ (useOutletContext());
  const { formatPrice, t } = useLocalization(); // <-- Hooked into global localization
  const [orders, setOrders] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedOrders = (data || []).map((/** @type {any} */ o) => ({
          ...o,
          total: Number(o.grand_total) || 0,
          items: o.order_items?.map((/** @type {any} */ i) => ({
            name: i.product_name,
            image: i.product_image || '', 
            size: i.selected_size,
            color: i.selected_color,
            quantity: i.quantity,
            price: Number(i.unit_price)
          })) || []
        }));

        setOrders(mappedOrders);
      } catch (e) { 
        console.error("Failed to load orders:", e); 
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="py-16 flex justify-center"><div className="w-6 h-6 border border-foreground border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl tracking-[-0.04em]">{t("Order History", "ប្រវត្តិការបញ្ជាទិញ")}</h2>

      {orders.length === 0 ? (
        <div className="border hairline p-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">{t("You have no orders yet.", "អ្នកមិនទាន់មានការបញ្ជាទិញនៅឡើយទេ។")}</p>
          <Link to="/shop" className="label-mono border-b border-foreground pb-1">{t("Explore the Collection", "ស្វែងរកផលិតផល")}</Link>
        </div>
      ) : (
        <div className="border hairline divide-y hairline">
          {orders.map((/** @type {any} */ o) => {
            const open = expanded === o.id;
            const currentStepIndex = STATUSES.indexOf((o.status || "pending").toLowerCase());
            const isCancelled = o.status?.toLowerCase() === "cancelled";

            return (
              <div key={o.id}>
                <button onClick={() => setExpanded(open ? null : o.id)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/40 text-left">
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  <div className="min-w-0">
                    <p className="label-mono text-[10px]">MA-{String(o.id).slice(-8).toUpperCase()}</p>
                    <p className="label-mono text-muted-foreground text-[9px] mt-0.5">{new Date(o.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </div>
                  <span className={`label-mono text-[9px] px-2 py-1 uppercase ${
                    o.status === "delivered" || o.status === "paid" ? "bg-foreground text-background" : 
                    isCancelled ? "bg-red-100 text-red-700" : "bg-muted"
                  }`}>
                    {t(o.status, o.status === 'pending' ? 'រង់ចាំ' : o.status === 'packed' ? 'ខ្ចប់រួចរាល់' : o.status === 'shipping' ? 'កំពុងដឹកជញ្ជូន' : o.status === 'delivered' ? 'បានដឹកជញ្ជូន' : o.status)}
                  </span>
                  <p className="font-mono text-sm ml-auto">{formatPrice(o.total || 0)}</p>
                </button>
                
                {open && (
                  <div className="px-5 pb-8 pt-6 bg-muted/20">
                    
                    {isCancelled ? (
                      <div className="flex flex-col items-center justify-center py-6 mb-10 bg-red-50/50 border border-red-100 rounded text-red-600">
                        <XCircle size={28} className="mb-2 opacity-80" />
                        <p className="font-display font-bold uppercase tracking-wider text-sm">{t("Order Cancelled", "ការបញ្ជាទិញត្រូវបានលុបចោល")}</p>
                        <p className="text-xs text-red-500/80 mt-1">{t("This order will not be fulfilled.", "ការបញ្ជាទិញនេះនឹងមិនត្រូវបានបំពេញទេ។")}</p>
                      </div>
                    ) : (
                      <div className="flex w-full mb-10">
                        {STATUSES.map((step, idx) => {
                          const isCompleted = idx <= currentStepIndex;
                          return (
                            <div key={step} className="flex-1 flex flex-col items-center relative">
                              <div className="w-full flex items-center relative">
                                <div className={`h-[1px] flex-1 ${idx === 0 ? "bg-transparent" : (isCompleted ? "bg-foreground" : "bg-muted-foreground/30")}`} />
                                <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors relative z-10 ${isCompleted ? "border-foreground bg-foreground text-background" : "border-muted-foreground/30 bg-background"}`}>
                                  {isCompleted && <Check size={12} strokeWidth={3} />}
                                </div>
                                <div className={`h-[1px] flex-1 ${idx === STATUSES.length - 1 ? "bg-transparent" : (idx < currentStepIndex ? "bg-foreground" : "bg-muted-foreground/30")}`} />
                              </div>
                              <span className={`absolute top-8 label-mono text-[9px] uppercase text-center ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                                {t(step, step === 'pending' ? 'រង់ចាំ' : step === 'packed' ? 'ខ្ចប់រួចរាល់' : step === 'shipping' ? 'ដឹកជញ្ជូន' : 'បានដឹកជញ្ជូន')}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <p className="label-mono text-muted-foreground text-[9px] mb-3 uppercase">{t("Order Items", "មុខទំនិញ")}</p>
                        <div className="space-y-3">
                          {(o.items || []).map((/** @type {any} */ it, /** @type {number} */ i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-10 h-12 bg-background overflow-hidden shrink-0 border hairline flex items-center justify-center">
                                {it.image ? (
                                  <Image src={it.image} alt={it.name} className="w-full h-full" fittingType="fill" />
                                ) : (
                                  <span className="font-display text-muted-foreground text-xs">{it.name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm truncate">{it.name}</p>
                                <p className="label-mono text-muted-foreground text-[9px]">{t(it.size, it.size)} · {t(it.color, it.color)} · ×{it.quantity}</p>
                              </div>
                              <p className="font-mono text-sm">{formatPrice(it.price * it.quantity)}</p>
                            </div>
                          ))}
                        </div>
                        
                        {/* --- INVOICE DOWNLOAD BUTTON --- */}
                        <button 
                          onClick={() => generateInvoicePDF(o, formatPrice)}
                          className="mt-6 flex items-center gap-2 label-mono text-[10px] uppercase border hairline px-4 py-2 hover:bg-foreground hover:text-background transition-colors"
                        >
                          <Download size={14} /> {t("Download PDF Invoice", "ទាញយកវិក្កយបត្រ PDF")}
                        </button>
                      </div>

                      {o.shipping_address && (
                        <div className="md:border-l hairline md:pl-8">
                          <p className="label-mono text-muted-foreground text-[9px] mb-2 uppercase">{t("Shipped to", "ដឹកជញ្ជូនទៅកាន់")}</p>
                          <p className="text-sm font-mono text-foreground">
                            {o.shipping_address.name} 
                            <span className="text-muted-foreground ml-2">({o.shipping_address.phone})</span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{o.shipping_address.address}</p>
                          <p className="text-sm text-muted-foreground">{o.shipping_address.province}</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}