import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { handleError } from './errorHandler';

class ConnectionManager {
  private static instance: ConnectionManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private networkType: string = 'unknown';
  private isOnline: boolean = navigator.onLine;

  private constructor() {
    this.initialize();
  }

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private initialize() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('blur', this.handleBlur);

    // Add network quality detection if available
    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', this.handleNetworkChange);
      this.networkType = (navigator as any).connection?.effectiveType || 'unknown';
    }

    // Initial connection check
    this.checkConnection();
  }

  private checkConnection = () => {
    const isGoodConnection = this.networkType !== 'slow-2g' && this.networkType !== '2g';
    if (this.isOnline && isGoodConnection) {
      this.reconnectChannels();
    }
  };

  private handleNetworkChange = () => {
    const connection = (navigator as any).connection;
    this.networkType = connection?.effectiveType || 'unknown';
    this.checkConnection();
  };

  private handleOnline = () => {
    this.isOnline = true;
    this.checkConnection();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
  };

  private handleFocus = () => {
    if (this.isOnline) {
      this.checkConnection();
    }
  };

  private handleBlur = () => {
    // Optionally reduce connection activity when tab is not focused
    this.channels.forEach(channel => {
      channel.presence.leave();
    });
  };

  private async reconnectChannels() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      await handleError(new Error('Max reconnection attempts reached'), {
        component: 'ConnectionManager',
        action: 'reconnectChannels',
        networkType: this.networkType,
        isOnline: this.isOnline
      });
      return;
    }

    try {
      for (const [name, channel] of this.channels) {
        await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
            console.debug(`Channel ${name} reconnected successfully`);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setTimeout(() => {
              this.reconnectAttempts++;
              this.reconnectChannels();
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
          }
        });
      }
    } catch (error) {
      await handleError(error, {
        component: 'ConnectionManager',
        action: 'reconnectChannels',
        attempts: this.reconnectAttempts,
        networkType: this.networkType
      });
    }
  }

  subscribeToChannel(name: string, table: string, filter?: string) {
    try {
      if (this.channels.has(name)) {
        return this.channels.get(name)!;
      }

      const channel = supabase.channel(name)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter
        }, (payload) => {
          // Handle changes
          console.debug(`Channel ${name} received:`, payload);
        })
        .subscribe((status) => {
          console.debug(`Channel ${name} status:`, status);
          
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
          }
        });

      this.channels.set(name, channel);
      return channel;
    } catch (error) {
      handleError(error, {
        component: 'ConnectionManager',
        action: 'subscribeToChannel',
        channel: name,
        networkType: this.networkType
      });
      return null;
    }
  }

  unsubscribeFromChannel(name: string) {
    try {
      const channel = this.channels.get(name);
      if (channel) {
        channel.unsubscribe();
        this.channels.delete(name);
      }
    } catch (error) {
      handleError(error, {
        component: 'ConnectionManager',
        action: 'unsubscribeFromChannel',
        channel: name
      });
    }
  }

  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      networkType: this.networkType,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);

    if ('connection' in navigator) {
      (navigator as any).connection?.removeEventListener('change', this.handleNetworkChange);
    }

    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }
}

export const connectionManager = ConnectionManager.getInstance();