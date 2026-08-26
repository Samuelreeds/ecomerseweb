// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { ChevronDown, Check, XCircle, Download, Camera, UploadCloud, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Image as BaseImage } from "@/components/ui/image";
import { useLocalization } from "@/lib/localization-context";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/** @type {any} */
const Image = BaseImage;

const FULFILMENT_STEPS = ["Unconfirmed", "Picking", "Packed", "Shipped / Out for Delivery", "Delivered"];

const generateInvoicePDF = (/** @type {any} */ order, /** @type {any} */ formatPrice) => {
  const doc = new jsPDF();
  
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("NOIR MTD", 14, 22);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("OFFICIAL INVOICE", 195, 22, { align: "right" });
  
  doc.setTextColor(0);
  doc.text(`Order Ref: MA-${order.id.slice(-8).toUpperCase()}`, 14, 34);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 14, 40);
  doc.text(`Payment: ${order.payment_method === 'qr' ? 'Bank Transfer' : 'Cash on Delivery'}`, 14, 46);
  
  doc.setFont("helvetica", "bold");
  doc.text("Billed To:", 120, 34);
  doc.setFont("helvetica", "normal");
  doc.text(order.shipping_address?.name || "N/A", 120, 40);
  doc.text(order.shipping_address?.phone || "N/A", 120, 46);
  doc.text(order.shipping_address?.address || "N/A", 120, 52);
  doc.text(`${order.shipping_address?.province || "N/A"}, Cambodia`, 120, 58);
  
  const tableData = order.items.map((/** @type {any} */ item) => [
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

  const finalY = (/** @type {any} */ (doc)).lastAutoTable.finalY + 12;
  
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

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Thank you for your purchase.", 105, 275, { align: "center" });
  doc.text("For support, contact us at noirmtd@gmail.com", 105, 280, { align: "center" });

  doc.save(`NOIR_Invoice_MA-${order.id.slice(-8).toUpperCase()}.pdf`);
};

export default function AccountOrders() {
  const { user } = /** @type {any} */ (useOutletContext());
  const { formatPrice, t = (k,d) => d } = /** @type {any} */ (useLocalization() || {}); 
  
  const [orders, setOrders] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(/** @type {string | null} */ (null));
  const [uploadingReceipt, setUploadingReceipt] = useState(/** @type {string | null} */ (null));

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

  const handleUploadReceipt = async (/** @type {React.ChangeEvent<HTMLInputElement>} */ e, /** @type {string} */ orderId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingReceipt(orderId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `receipt_${orderId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('order-proofs').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('order-proofs').getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('orders').update({
        transaction_receipt_url: publicData.publicUrl,
        payment_status: 'Pending Verification'
      }).eq('id', orderId);

      if (updateError) throw updateError;

      setOrders(prev => prev.map(o => o.id === orderId ? { 
        ...o, 
        transaction_receipt_url: publicData.publicUrl, 
        payment_status: 'Pending Verification' 
      } : o));
      
      alert(t("Receipt uploaded successfully. We will verify your payment shortly.", "វិក័យប័ត្រត្រូវបានបញ្ចូលដោយជោគជ័យ។"));
    } catch (err) {
      console.error(err);
      alert(t("Upload failed.", "ការបញ្ចូលបរាជ័យ។"));
    } finally {
      setUploadingReceipt(null);
    }
  };

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
            const currentStepIndex = FULFILMENT_STEPS.indexOf(o.fulfilment_status || "Unconfirmed");
            const isCancelled = o.fulfilment_status === "Cancelled" || o.commercial_status === "Cancelled";
            const needsReceipt = o.payment_method === 'qr' && (o.payment_status === 'Unpaid' || o.payment_status === 'Failed');

            return (
              <div key={o.id}>
                {/* Accordion Header */}
                <button onClick={() => setExpanded(open ? null : o.id)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/40 text-left transition-colors">
                  <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  <div className="min-w-0">
                    <p className="label-mono text-[10px]">MA-{String(o.id).slice(-8).toUpperCase()}</p>
                    <p className="label-mono text-muted-foreground text-[9px] mt-0.5">{new Date(o.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </div>
                  
                  {/* Status Badges */}
                  <div className="flex flex-col items-start gap-1">
                    <span className={`label-mono text-[9px] px-2 py-1 uppercase ${
                      o.fulfilment_status === "Delivered" ? "bg-foreground text-background" : 
                      isCancelled ? "bg-red-100 text-red-700" : "bg-muted"
                    }`}>
                      {t(o.fulfilment_status || "Unconfirmed", o.fulfilment_status)}
                    </span>
                    <span className={`label-mono text-[8px] uppercase ${
                      o.payment_status === 'Paid' ? 'text-emerald-600' : 
                      o.payment_status === 'Failed' ? 'text-rose-600' : 'text-amber-600'
                    }`}>
                      {t(`Pay: ${o.payment_status || "Unpaid"}`, `Pay: ${o.payment_status || "Unpaid"}`)}
                    </span>
                  </div>
                  
                  <p className="font-mono text-sm ml-auto">{formatPrice(o.total || 0)}</p>
                </button>
                
                {/* Expanded Details */}
                {open && (
                  <div className="px-5 pb-8 pt-6 bg-muted/20">
                    
                    {isCancelled ? (
                      <div className="flex flex-col items-center justify-center py-6 mb-10 bg-red-50/50 border border-red-100 rounded text-red-600">
                        <XCircle size={28} className="mb-2 opacity-80" />
                        <p className="font-display font-bold uppercase tracking-wider text-sm">{t("Order Cancelled", "ការបញ្ជាទិញត្រូវបានលុបចោល")}</p>
                        <p className="text-xs text-red-500/80 mt-1">{t("This order will not be fulfilled.", "ការបញ្ជាទិញនេះនឹងមិនត្រូវបានបំពេញទេ។")}</p>
                      </div>
                    ) : (
                      <div className="flex w-full mb-10 overflow-x-auto pb-4 custom-scrollbar">
                        <div className="flex w-full min-w-[500px]">
                          {FULFILMENT_STEPS.map((step, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            const isActive = idx === currentStepIndex;
                            return (
                              <div key={step} className="flex-1 flex flex-col items-center relative">
                                <div className="w-full flex items-center relative">
                                  <div className={`h-[2px] flex-1 ${idx === 0 ? "bg-transparent" : (isCompleted ? "bg-foreground" : "bg-muted-foreground/20")}`} />
                                  <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors relative z-10 ${
                                    isCompleted 
                                      ? "border-foreground bg-foreground text-background" 
                                      : "border-muted-foreground/30 bg-background text-transparent"
                                  } ${isActive ? "ring-4 ring-foreground/10" : ""}`}>
                                    {isCompleted && <Check size={12} strokeWidth={4} />}
                                  </div>
                                  <div className={`h-[2px] flex-1 ${idx === FULFILMENT_STEPS.length - 1 ? "bg-transparent" : (idx < currentStepIndex ? "bg-foreground" : "bg-muted-foreground/20")}`} />
                                </div>
                                <span className={`absolute top-8 label-mono text-[9px] uppercase text-center max-w-[80px] leading-tight ${isCompleted ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                                  {t(step, step)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Items Column */}
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
                                <p className="text-sm truncate font-medium">{it.name}</p>
                                <p className="label-mono text-muted-foreground text-[9px]">{t(it.size, it.size)} · {t(it.color, it.color)} · ×{it.quantity}</p>
                              </div>
                              <p className="font-mono text-sm font-bold">{formatPrice(it.price * it.quantity)}</p>
                            </div>
                          ))}
                        </div>
                        
                        {/* Download Invoice */}
                        <button 
                          onClick={() => generateInvoicePDF(o, formatPrice)}
                          className="mt-6 flex items-center gap-2 label-mono text-[10px] uppercase border hairline px-4 py-2 bg-background hover:bg-foreground hover:text-background transition-colors"
                        >
                          <Download size={14} /> {t("Download PDF Invoice", "ទាញយកវិក្កយបត្រ PDF")}
                        </button>
                      </div>

                      {/* Info Column */}
                      <div className="space-y-6 md:border-l hairline md:pl-8">
                        
                        {/* Status Output & Missing Receipt Upload (Phase 0 Rescue Logic) */}
                        {o.payment_method === 'qr' && (
                          <div className={`border p-4 rounded-md ${
                            o.payment_status === 'Paid' ? 'bg-emerald-50 border-emerald-200' : 
                            o.payment_status === 'Failed' ? 'bg-rose-50 border-rose-200' :
                            'bg-amber-50 border-amber-200'
                          }`}>
                            <p className={`text-xs font-bold uppercase flex items-center gap-2 mb-1 ${
                              o.payment_status === 'Paid' ? 'text-emerald-800' : 
                              o.payment_status === 'Failed' ? 'text-rose-800' :
                              'text-amber-800'
                            }`}>
                              <AlertCircle size={14} /> 
                              {o.payment_status === 'Paid' ? 'Payment Verified' : 
                               o.payment_status === 'Failed' ? 'Verification Failed' : 
                               'Action Required'}
                            </p>
                            
                            {needsReceipt ? (
                              <>
                                <p className={`text-[10px] mb-3 ${o.payment_status === 'Failed' ? 'text-rose-700' : 'text-amber-700'}`}>
                                  {o.payment_status === 'Failed' 
                                    ? "Your previous receipt was rejected. Please upload a valid KHQR payment receipt to proceed."
                                    : "Your order is on hold. Please upload your KHQR bank transfer receipt to proceed."}
                                </p>
                                <div className="relative">
                                  <input type="file" accept="image/*" onChange={(e) => handleUploadReceipt(e, o.id)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={uploadingReceipt === o.id} />
                                  <button disabled={uploadingReceipt === o.id} className={`w-full flex items-center justify-center gap-2 text-white text-[10px] uppercase font-bold py-2 rounded transition-colors disabled:opacity-50 ${o.payment_status === 'Failed' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                                    <UploadCloud size={14} /> {uploadingReceipt === o.id ? 'Uploading...' : 'Upload Receipt Now'}
                                  </button>
                                </div>
                              </>
                            ) : o.payment_status === 'Pending Verification' ? (
                              <p className="text-[10px] text-amber-700">Your receipt has been uploaded and is currently under review by our team.</p>
                            ) : (
                              <p className="text-[10px] text-emerald-700">Thank you. Your payment has been successfully verified.</p>
                            )}
                          </div>
                        )}

                        {/* Delivery Proof Viewer */}
                        {o.delivery_proof_url && (
                          <div>
                            <p className="label-mono text-foreground text-[9px] mb-2 uppercase flex items-center gap-1.5"><Camera size={12}/> {t("Delivery Proof", "ភស្តុតាងនៃការដឹកជញ្ជូន")}</p>
                            <a href={o.delivery_proof_url} target="_blank" rel="noreferrer" className="block border hairline p-1 bg-background hover:opacity-80 transition-opacity max-w-[200px]">
                              <img src={o.delivery_proof_url} alt="Delivery Proof" className="w-full h-auto" />
                            </a>
                          </div>
                        )}

                        <div>
                          <p className="label-mono text-muted-foreground text-[9px] mb-2 uppercase">{t("Shipped to", "ដឹកជញ្ជូនទៅកាន់")}</p>
                          <p className="text-sm font-mono text-foreground font-bold">
                            {o.shipping_address?.name} 
                            <span className="text-muted-foreground ml-2 font-normal">({o.shipping_address?.phone})</span>
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{o.shipping_address?.address}</p>
                          <p className="text-sm text-muted-foreground">{o.shipping_address?.province}</p>
                        </div>
                      </div>
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