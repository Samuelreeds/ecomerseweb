import { supabase } from "@/lib/supabase";

/**
 * Initializes and retrieves a persistent anonymous session ID for tracking.
 */
const getSessionId = () => {
  let sessionId = sessionStorage.getItem("noir_analytics_session");
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    sessionStorage.setItem("noir_analytics_session", sessionId);
  }
  return sessionId;
};

/**
 * Captures UTM parameters from the URL if they exist and stores them in session.
 */
export const captureAttribution = () => {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source') || params.get('ref');
  if (source && !sessionStorage.getItem('noir_sales_channel')) {
    let channel = 'Website';
    if (source.toLowerCase().includes('fb') || source.toLowerCase().includes('facebook')) channel = 'Facebook';
    else if (source.toLowerCase().includes('ig') || source.toLowerCase().includes('instagram')) channel = 'Instagram';
    else if (source.toLowerCase().includes('tiktok')) channel = 'TikTok';
    else channel = source;
    
    sessionStorage.setItem('noir_sales_channel', channel);
  }
};

/**
 * Retrieves the active attribution channel.
 */
export const getSalesChannel = () => {
  return sessionStorage.getItem('noir_sales_channel') || 'Website';
};

/**
 * Fires an analytics event to the Supabase first-party tracking table.
 * Does not block the main execution thread.
 */
export const trackEvent = async (/** @type {string} */ eventName, /** @type {any} */ payload = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const event = {
      session_id: getSessionId(),
      user_id: session?.user?.id || null,
      event_name: eventName,
      page_url: window.location.pathname + window.location.search,
      product_id: payload.product_id || null,
      variant_id: payload.variant_id || null,
      order_id: payload.order_id || null,
      value: payload.value || null,
      currency: payload.currency || 'USD',
      metadata: payload.metadata || {}
    };

    // Fire and forget - we do not await this to prevent UI blocking
    supabase.from('analytics_events').insert([event]).then(({ error }) => {
      if (error) console.warn("Analytics tracking error (non-fatal):", error);
    });
  } catch (err) {
    console.warn("Failed to construct analytics payload:", err);
  }
};