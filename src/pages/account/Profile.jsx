// @ts-nocheck
import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Check, Briefcase } from "lucide-react";

export default function AccountProfile() {
  const { user, reloadUser } = /** @type {any} */ (useOutletContext());
  const [displayName, setDisplayName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false);

  const save = async (/** @type {React.FormEvent} */ e) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true); setSaved(false);
    try {
      const { error } = await supabase.from('users').update({ full_name: displayName.trim(), phone: phone.trim() }).eq('id', user.id);
      if (error) throw error;
      await reloadUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      setSaving(false); 
    }
  };

  const applyB2B = async () => {
    const companyName = prompt("Enter your Business Name to apply for B2B wholesale pricing:");
    if (!companyName) return;
    setApplying(true);
    try {
      // 1. Create Company
      const { data: comp, error: cErr } = await supabase.from('b2b_companies').insert([{ company_name: companyName, contact_email: user.email, contact_phone: phone }]).select('id').single();
      if (cErr) throw cErr;
      
      // 2. Link Profile
      const { error: pErr } = await supabase.from('profiles').update({ b2b_company_id: comp.id, b2b_role: 'owner' }).eq('id', user.id);
      if (pErr) throw pErr;
      
      alert("B2B Application submitted successfully. An administrator will review your account.");
      await reloadUser();
    } catch (e) {
      alert("Application failed.");
    }
    setApplying(false);
  };

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "—";
  const b2b = user?.b2b_companies;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl tracking-[-0.04em] mb-6">Details</h2>
        <div className="border hairline divide-y hairline bg-white">
          {[
            ["Email", user?.email || "—"],
            ["Role", user?.role || "Customer"],
            ["Member since", joined],
          ].map(([k, v]) => (
            <div key={k} className="px-5 py-4 flex items-center justify-between">
              <span className="label-mono text-muted-foreground text-[9px] uppercase">{k}</span>
              <span className="text-sm font-mono">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* NEW: B2B STATUS PANEL */}
      <section>
        <h2 className="font-display text-2xl tracking-[-0.04em] mb-6">Business Account</h2>
        {b2b ? (
           <div className="border hairline bg-white px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-slate-100 flex items-center justify-center rounded-full"><Briefcase size={18} className="text-slate-600"/></div>
               <div>
                 <p className="font-medium text-sm">{b2b.company_name}</p>
                 <p className="label-mono text-[9px] text-muted-foreground uppercase mt-0.5">Role: {user.b2b_role}</p>
               </div>
             </div>
             <span className={`label-mono px-3 py-1 text-[9px] uppercase tracking-wider border ${b2b.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
               {b2b.status}
             </span>
           </div>
        ) : (
          <div className="border hairline bg-slate-50 p-6 flex flex-col items-start gap-4">
            <p className="text-sm text-slate-600">Are you a retailer or distributor? Apply for a B2B wholesale account to unlock exclusive pricing.</p>
            <button onClick={applyB2B} disabled={applying} className="bg-foreground text-background px-6 py-3 label-mono hover:opacity-85 disabled:opacity-40 transition-opacity">
              {applying ? "Submitting..." : "Apply for Wholesale Account"}
            </button>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl tracking-[-0.04em] mb-6">Preferences</h2>
        <form onSubmit={save} className="border hairline p-6 space-y-5 max-w-md bg-white">
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px] uppercase">Full Name</span>
            <input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="Your full name" 
              className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm focus:outline-none focus:border-foreground bg-background" 
            />
          </label>
          <label className="block">
            <span className="label-mono text-muted-foreground text-[9px] uppercase">Phone</span>
            <input 
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="+855 000 0000" 
              className="mt-1.5 w-full border hairline px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground bg-background" 
            />
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="bg-foreground text-background px-6 py-3 label-mono hover:opacity-85 disabled:opacity-40 transition-opacity">
              {saving ? "Saving…" : "Save Profile"}
            </button>
            {saved && <span className="label-mono text-[10px] text-emerald-600 flex items-center gap-1"><Check size={14} /> Saved</span>}
          </div>
        </form>
      </section>
    </div>
  );
}