// @ts-nocheck
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  refetch: async () => {}
});

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const currentUserId = user?.id || user?.user?.id || null;

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Failed to load customer notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime WebSocket Subscription
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`customer_notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_notifications',
          filter: `user_id=eq.${currentUserId}`
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_notifications',
          filter: `user_id=eq.${currentUserId}`
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const markAsRead = async (id) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );

      const { error } = await supabase
        .from('customer_notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;

    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      const { error } = await supabase
        .from('customer_notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refetch: fetchNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);