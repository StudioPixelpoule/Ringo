import { logError } from './errorLogger';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  useColors: boolean;
}

// Configuration par défaut selon l'environnement
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

const config: LoggerConfig = {
  enabled: isDevelopment, // Désactivé en production sauf pour les erreurs
  minLevel: isProduction ? 'error' : 'debug',
  useColors: isDevelopment
};

// Hiérarchie des niveaux de log
const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Couleurs pour la console (en dev seulement)
const colors: Record<LogLevel, string> = {
  debug: 'color: #6B7280',
  info: 'color: #3B82F6',
  warn: 'color: #F59E0B',
  error: 'color: #EF4444'
};

// Emojis pour les logs
const emojis: Record<LogLevel, string> = {
  debug: '🐛',
  info: '📝',
  warn: '⚠️',
  error: '❌'
};

class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    // Les erreurs sont toujours loggées
    if (level === 'error') return true;
    
    // En production, seules les erreurs sont loggées
    if (isProduction) return false;
    
    // En dev, vérifier le niveau minimum
    return config.enabled && logLevels[level] >= logLevels[config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}]` : '';
    const emoji = isDevelopment ? emojis[level] + ' ' : '';
    
    return `${emoji}${timestamp} ${level.toUpperCase()} ${contextStr} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, data);

    if (level === 'error') {
      // Pour les erreurs, utiliser aussi le système de logging en DB
      if (isProduction && data instanceof Error) {
        logError(data, { 
          message, 
          context: this.context,
          level 
        });
      }
      
      // Toujours afficher dans la console pour les erreurs
      console.error(formattedMessage, data || '');
    } else if (isDevelopment) {
      // En dev, utiliser les bonnes méthodes de console avec couleurs
      const style = config.useColors ? colors[level] : '';
      
      switch (level) {
        case 'debug':
          console.debug(`%c${formattedMessage}`, style, data || '');
          break;
        case 'info':
          console.info(`%c${formattedMessage}`, style, data || '');
          break;
        case 'warn':
          console.warn(`%c${formattedMessage}`, style, data || '');
          break;
      }
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | any) {
    this.log('error', message, error);
  }

  // Méthode pour créer un sous-logger avec contexte
  child(context: string): Logger {
    const childContext = this.context 
      ? `${this.context}:${context}` 
      : context;
    return new Logger(childContext);
  }

  // Méthodes utilitaires pour remplacer les console.log existants
  success(message: string, data?: any) {
    this.info(`✅ ${message}`, data);
  }

  loading(message: string, data?: any) {
    this.info(`⏳ ${message}`, data);
  }

  // Timer pour mesurer les performances
  time(label: string): () => void {
    const start = performance.now();
    this.debug(`Starting timer: ${label}`);
    
    return () => {
      const duration = performance.now() - start;
      this.debug(`Timer ${label}: ${duration.toFixed(2)}ms`);
    };
  }
}

// Export d'une instance par défaut
export const logger = new Logger();

// Export de la classe pour créer des loggers avec contexte
export { Logger };

// Helpers pour créer des loggers contextuels
export const createLogger = (context: string) => new Logger(context);

// Désactiver complètement les console.* en production
if (isProduction) {
  // Sauvegarder console.error original pour les erreurs critiques
  const originalError = console.error;
  
  // Override des méthodes console
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  
  // Garder console.error mais filtrer
  console.error = (...args: any[]) => {
    // Ne logger que les vraies erreurs, pas les logs de debug
    if (args[0] instanceof Error || (typeof args[0] === 'string' && args[0].includes('Error'))) {
      originalError.apply(console, args);
    }
  };
} 