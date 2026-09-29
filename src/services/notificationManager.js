/**
 * notificationManager.js
 * 
 * Central Event Bus & State Orchestrator for FoxTrade Notifications.
 * Handles top-banner drops, audio trigger, genie absorption sequencing,
 * persistent storage, and reactive unread badge updates.
 */

import { notificationSound } from './notificationSoundService';

const STORAGE_KEY = 'tradeontip_notifications';

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Profit Target Achieved',
    message: 'ASIANPAINT closed at +10.20% gain. Realized P/L ₹21,940.',
    time: '10 mins ago',
    month: 'September 2026',
    type: 'success',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 10
  },
  {
    id: 'notif-2',
    title: 'Sequential Renumbering',
    message: 'All journal trades have been sequenced properly from 1 to 10.',
    time: '2 hours ago',
    month: 'September 2026',
    type: 'info',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 120
  },
  {
    id: 'notif-3',
    title: 'Market Pre-Open Session',
    message: 'NSE Equity market opens tomorrow at 09:15 AM IST.',
    time: 'Yesterday',
    month: 'September 2026',
    type: 'alert',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24
  },
  {
    id: 'notif-4',
    title: 'Discipline Milestone Reached',
    message: 'You maintained a 100% Plan Followed score on your last 5 trades!',
    time: '3 days ago',
    month: 'September 2026',
    type: 'milestone',
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 72
  }
];

class NotificationManager {
  constructor() {
    this.bannerListeners = new Set();
    this.dataListeners = new Set();
    this.activeBannerQueue = [];
    this.isProcessingBanner = false;
  }

  getNotifications() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return DEFAULT_NOTIFICATIONS;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : DEFAULT_NOTIFICATIONS;
    } catch (_) {
      return DEFAULT_NOTIFICATIONS;
    }
  }

  saveNotifications(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      this.notifyDataListeners(list);
      window.dispatchEvent(new CustomEvent('tradeontip_notifications_changed', { detail: list }));
    } catch (e) {
      console.error('[NotificationManager] Save error:', e);
    }
  }

  getUnreadCount() {
    const list = this.getNotifications();
    return list.filter(n => !n.read).length;
  }

  /**
   * Subscribe to list data updates
   */
  subscribe(callback) {
    this.dataListeners.add(callback);
    return () => this.dataListeners.delete(callback);
  }

  notifyDataListeners(list) {
    this.dataListeners.forEach(cb => {
      try { cb(list); } catch (e) { console.error(e); }
    });
  }

  /**
   * Subscribe to active top-drop banner requests
   */
  onBannerRequest(callback) {
    this.bannerListeners.add(callback);
    return () => this.bannerListeners.delete(callback);
  }

  /**
   * Dispatch a new notification:
   * 1. Queues and triggers the visual Top Drop Banner
   * 2. Plays the respective mobile push sound
   * 3. Upon absorption into the bell, commits to persistent storage
   */
  dispatch(notif) {
    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const fullNotif = {
      id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: notif.title || 'FoxTrade Notification',
      message: notif.message || '',
      type: notif.type || 'info', // 'success' | 'alert' | 'sl' | 'admin' | 'milestone' | 'info'
      time: notif.time || 'Just now',
      month: notif.month || monthYear,
      read: false,
      createdAt: Date.now(),
      meta: notif.meta || null
    };

    // Queue for banner animation
    this.activeBannerQueue.push(fullNotif);
    this.processQueue();
  }

  processQueue() {
    if (this.isProcessingBanner || this.activeBannerQueue.length === 0) return;

    this.isProcessingBanner = true;
    const nextNotif = this.activeBannerQueue.shift();

    // Play permanent Target sound across all notifications
    notificationSound.playPushChime();

    // Trigger visual drop banner
    this.bannerListeners.forEach(cb => {
      try { cb(nextNotif); } catch (e) { console.error(e); }
    });
  }

  /**
   * Called by NotificationDropBanner once the Genie absorption into the TopBar Bell completes
   */
  finalizeAbsorption(notif) {
    // 1. Play subtle bell absorb ping
    notificationSound.playBellAbsorbPing();

    // 2. Commit notification to persistent storage
    const current = this.getNotifications();
    const updated = [notif, ...current.filter(n => n.id !== notif.id)];
    this.saveNotifications(updated);

    // 3. Dispatch bell wobble and badge pop animation event
    window.dispatchEvent(new CustomEvent('tradeontip_bell_wobble', {
      detail: {
        notifId: notif.id,
        unreadCount: updated.filter(n => !n.read).length
      }
    }));

    // 4. Ready to process next banner if any
    this.isProcessingBanner = false;
    if (this.activeBannerQueue.length > 0) {
      setTimeout(() => this.processQueue(), 300);
    }
  }

  markAllAsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    this.saveNotifications(list);
  }

  markAsRead(id) {
    const list = this.getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
    this.saveNotifications(list);
  }

  deleteNotification(id) {
    const list = this.getNotifications().filter(n => n.id !== id);
    this.saveNotifications(list);
  }

  clearAll() {
    this.saveNotifications([]);
  }
}

export const notificationManager = new NotificationManager();
