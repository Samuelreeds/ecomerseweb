// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, Package, CreditCard, Truck, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/lib/notification-context';
import { useAuth } from '@/lib/AuthContext';

function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getNotificationIcon(type) {
  switch (type) {
    case 'order_payment':
      return <CreditCard size={14} className="text-emerald-600" />;
    case 'order_packed':
      return <Package size={14} className="text-indigo-600" />;
    case 'order_shipped':
      return <Truck size={14} className="text-blue-600" />;
    case 'order_delivered':
      return <CheckCircle size={14} className="text-emerald-600" />;
    case 'order_failed_delivery':
      return <AlertTriangle size={14} className="text-rose-600" />;
    case 'b2b_quote_approved':
      return <CheckCheck size={14} className="text-amber-600" />;
    default:
      return <Bell size={14} className="text-foreground" />;
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!user) return null;

  const handleNotificationClick = (notification) => {
    // 1. Close dropdown immediately
    setIsOpen(false);

    // 2. Fire database update in the background (fire-and-forget)
    if (!notification.is_read) {
      markAsRead(notification.id).catch(console.error);
    }

    // 3. Defer the router navigation slightly to prevent unmount conflicts
    setTimeout(() => {
      if (notification.type === 'b2b_quote_approved') {
        navigate('/account');
      } else {
        navigate('/account/orders');
      }
    }, 10);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative p-2 text-foreground hover:opacity-70 transition-opacity focus:outline-none"
      >
        <Bell size={18} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-mono font-bold text-background bg-foreground rounded-full leading-none shadow-sm animate-in fade-in zoom-in-75 duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-background border hairline shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="px-4 py-3 border-b hairline flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs uppercase tracking-wider font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-sm">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllAsRead().catch(console.error);
                }}
                className="label-mono text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y hairline custom-scrollbar">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono">
                Loading updates...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <p className="font-display text-sm">No updates right now.</p>
                <p className="label-mono text-[10px] text-muted-foreground">Order and quote milestones will appear here.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-4 cursor-pointer transition-colors flex items-start gap-3 hover:bg-muted/30 ${
                    !item.is_read ? 'bg-muted/10' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-full border hairline bg-background">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className={`text-xs truncate ${!item.is_read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
                        <Clock size={10} /> {formatTimestamp(item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                  </div>
                  {!item.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 border-t hairline bg-muted/10 text-center">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setTimeout(() => navigate('/account/orders'), 10);
              }}
              className="label-mono text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              View Order History <ExternalLink size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}