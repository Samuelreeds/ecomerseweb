import React from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Safely transmits an error payload to the ingestion Edge Function.
 */
export const captureError = (error, context = {}) => {
  // Prevent recursive error loops if the reporter itself encounters a crash
  if (context?._isReporting) return;

  try {
    const payload = {
      error_type: context.type || 'handled_exception',
      error_name: error?.name || 'Error',
      message: error?.message || String(error),
      stack_trace: error?.stack || '',
      severity: context.severity || 'error',
      environment: import.meta.env.MODE || 'production',
      route: window.location.pathname,
      user_id: context.user_id || null, // Ensure this is only a UUID
      metadata: { ...context }
    };

    // Strip obvious PII from metadata before transit
    delete payload.metadata.name;
    delete payload.metadata.phone;
    delete payload.metadata.address;
    delete payload.metadata.transactionImage;

    // Fire and forget via Supabase Edge Functions
    supabase.functions.invoke('log-client-error', {
      body: payload
    }).catch(err => {
      // Fail silently to the user, log to console to avoid infinite loops
      console.warn('Error monitor failed to ingest:', err);
    });

  } catch (err) {
    console.warn('Error monitor critically failed:', err);
  }
};

/**
 * Attaches passive listeners to catch global unhandled window errors.
 */
export const initGlobalErrorMonitor = () => {
  window.addEventListener('error', (event) => {
    captureError(event.error || event.message, { type: 'unhandled_exception', severity: 'error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, { type: 'unhandled_rejection', severity: 'error' });
  });
};

/**
 * React Error Boundary to prevent application white-screens upon render failure.
 */
export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    captureError(error, { 
      type: 'react_boundary', 
      severity: 'critical',
      reactComponentStack: errorInfo?.componentStack 
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-6">
          <div className="max-w-md w-full border border-slate-200 p-8 text-center bg-slate-50">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong.</h1>
            <p className="text-slate-600 text-sm mb-6">
              A critical application error occurred and has been securely reported to our engineering team.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}