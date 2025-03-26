import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { handleError } from './errorHandler';

class ConnectionManager {
  private static instance: ConnectionManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

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
  }

  private handleOnline = () => {
    this.reconnectChannels();
  };

  private handleOffline = () => {
    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
  };

  private handleFocus = () => {
    if (navigator.onLine) {
      this.reconnectChannels();
    }
  };

  private handleBlur = () => {
    // Optionally reduce connection activity when tab is not focused
  };

  private async reconnectChannels() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      await handleError(new Error('Max reconnection attempts reached'), {
        component: 'ConnectionManager',
        action: 'reconnectChannels'
      });
      return;
    }

    try {
      for (const [name, channel] of this.channels) {
        await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.reconnectAttempts = 0;
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
        action: 'reconnectChannels'
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
        .subscribe();

      this.channels.set(name, channel);
      return channel;
    } catch (error) {
      handleError(error, {
        component: 'ConnectionManager',
        action: 'subscribeToChannel',
        channel: name
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

  cleanup() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('blur', this.handleBlur);

    this.channels.forEach(channel => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }
}

export const connectionManager = ConnectionManager.getInstance();