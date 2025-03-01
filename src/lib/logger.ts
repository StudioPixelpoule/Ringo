import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntry {
  id?: string;
  timestamp?: string;
  level: LogLevel;
  message: string;
  details?: any;
  source?: string;
  user_id?: string;
}

/**
 * Classe pour gérer les logs de l'application
 */
class Logger {
  private static instance: Logger;
  private queue: LogEntry[] = [];
  private isProcessing: boolean = false;
  private flushInterval: number = 5000; // 5 secondes
  private intervalId: NodeJS.Timeout | null = null;
  private maxQueueSize: number = 50;
  private enabled: boolean = true;
  private failedAttempts: number = 0;
  private maxFailedAttempts: number = 3;
  private backoffTime: number = 30000; // 30 secondes
  private backoffTimer: NodeJS.Timeout | null = null;
  private logLevel: LogLevel = 'info'; // Niveau de log par défaut

  private constructor() {
    // Démarrer le traitement périodique des logs
    this.startProcessing();
    
    // Définir le niveau de log en fonction de l'environnement
    this.logLevel = process.env.NODE_ENV === 'production' ? 'warning' : 'info';
  }

  /**
   * Obtenir l'instance unique du logger (Singleton)
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Activer ou désactiver le logger
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && !this.intervalId) {
      this.startProcessing();
    } else if (!enabled && this.intervalId) {
      this.stopProcessing();
    }
  }
  
  /**
   * Définir le niveau de log
   */
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Démarrer le traitement périodique des logs
   */
  private startProcessing(): void {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, this.flushInterval);
    
    // S'assurer que les logs sont traités avant la fermeture de l'application
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.processQueue(true);
      });
    }
  }

  /**
   * Arrêter le traitement périodique des logs
   */
  private stopProcessing(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Traiter la file d'attente des logs
   */
  private async processQueue(immediate: boolean = false): Promise<void> {
    if (!this.enabled || this.isProcessing || this.queue.length === 0) return;
    
    // Si nous sommes en backoff, ne pas traiter la file d'attente
    if (this.backoffTimer) return;
    
    this.isProcessing = true;
    
    try {
      // Copier la file d'attente actuelle et la vider
      const logsToProcess = [...this.queue];
      this.queue = [];
      
      // Traiter les logs par lots pour éviter de surcharger l'API
      const batchSize = 10;
      for (let i = 0; i < logsToProcess.length; i += batchSize) {
        const batch = logsToProcess.slice(i, i + batchSize);
        
        try {
          // Envoyer le lot à Supabase
          const { error } = await supabase
            .from('logs')
            .insert(batch);
          
          if (error) {
            console.error('Erreur lors de l\'enregistrement des logs:', error);
            // Remettre les logs non traités dans la file d'attente
            this.queue = [...this.queue, ...logsToProcess.slice(i)];
            
            // Incrémenter le compteur d'échecs
            this.failedAttempts++;
            
            // Si nous avons atteint le nombre maximum d'échecs, passer en mode backoff
            if (this.failedAttempts >= this.maxFailedAttempts) {
              this.enterBackoffMode();
            }
            
            break;
          } else {
            // Réinitialiser le compteur d'échecs en cas de succès
            this.failedAttempts = 0;
          }
        } catch (error) {
          console.error('Erreur lors de l\'envoi des logs à Supabase:', error);
          // Remettre les logs non traités dans la file d'attente
          this.queue = [...this.queue, ...logsToProcess.slice(i)];
          
          // Incrémenter le compteur d'échecs
          this.failedAttempts++;
          
          // Si nous avons atteint le nombre maximum d'échecs, passer en mode backoff
          if (this.failedAttempts >= this.maxFailedAttempts) {
            this.enterBackoffMode();
          }
          
          break;
        }
        
        // Si ce n'est pas un traitement immédiat, attendre un peu entre les lots
        if (!immediate && i + batchSize < logsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement des logs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Passer en mode backoff pour éviter de surcharger l'API
   */
  private enterBackoffMode(): void {
    console.warn(`Logger: Trop d'échecs consécutifs, passage en mode backoff pour ${this.backoffTime / 1000} secondes`);
    
    // Arrêter le traitement périodique
    this.stopProcessing();
    
    // Démarrer le timer de backoff
    this.backoffTimer = setTimeout(() => {
      console.log('Logger: Fin du mode backoff, reprise du traitement');
      
      // Réinitialiser le compteur d'échecs
      this.failedAttempts = 0;
      
      // Réinitialiser le timer de backoff
      this.backoffTimer = null;
      
      // Redémarrer le traitement périodique
      this.startProcessing();
    }, this.backoffTime);
  }

  /**
   * Ajouter un log à la file d'attente
   */
  private addToQueue(entry: LogEntry): void {
    if (!this.enabled) return;
    
    // Vérifier le niveau de log
    if (this.shouldLog(entry.level)) {
      // Ajouter un ID unique et un timestamp
      const logEntry: LogEntry = {
        ...entry,
        id: entry.id || uuidv4(),
        timestamp: entry.timestamp || new Date().toISOString()
      };
      
      // Ajouter à la file d'attente
      this.queue.push(logEntry);
      
      // Si la file d'attente est trop grande, traiter immédiatement
      if (this.queue.length >= this.maxQueueSize) {
        this.processQueue();
      }
      
      // Également afficher dans la console pour le débogage
      this.logToConsole(logEntry);
    }
  }

  /**
   * Vérifier si un niveau de log doit être enregistré
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      'info': 0,
      'warning': 1,
      'error': 2
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  /**
   * Afficher le log dans la console
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp || new Date()).toLocaleTimeString();
    const source = entry.source ? `[${entry.source}]` : '';
    const message = `${timestamp} ${source} ${entry.message}`;
    
    switch (entry.level) {
      case 'info':
        console.info(message, entry.details || '');
        break;
      case 'warning':
        console.warn(message, entry.details || '');
        break;
      case 'error':
        console.error(message, entry.details || '');
        break;
    }
  }

  /**
   * Enregistrer un log de niveau info
   */
  public info(message: string, details?: any, source?: string, userId?: string): void {
    this.addToQueue({
      level: 'info',
      message,
      details,
      source,
      user_id: userId
    });
  }

  /**
   * Enregistrer un log de niveau warning
   */
  public warning(message: string, details?: any, source?: string, userId?: string): void {
    this.addToQueue({
      level: 'warning',
      message,
      details,
      source,
      user_id: userId
    });
  }

  /**
   * Enregistrer un log de niveau error
   */
  public error(message: string, details?: any, source?: string, userId?: string): void {
    this.addToQueue({
      level: 'error',
      message,
      details,
      source,
      user_id: userId
    });
  }

  /**
   * Récupérer les logs depuis Supabase
   */
  public async getLogs(options: {
    limit?: number;
    offset?: number;
    level?: LogLevel;
    startDate?: Date;
    endDate?: Date;
    source?: string;
    userId?: string;
  } = {}): Promise<{ logs: LogEntry[]; count: number }> {
    try {
      const {
        limit = 50,
        offset = 0,
        level,
        startDate,
        endDate,
        source,
        userId
      } = options;
      
      // Construire la requête
      let query = supabase
        .from('logs')
        .select('*', { count: 'exact' });
      
      // Appliquer les filtres
      if (level) {
        query = query.eq('level', level);
      }
      
      if (startDate) {
        query = query.gte('timestamp', startDate.toISOString());
      }
      
      if (endDate) {
        query = query.lte('timestamp', endDate.toISOString());
      }
      
      if (source) {
        query = query.eq('source', source);
      }
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      // Appliquer la pagination et le tri
      query = query
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Exécuter la requête
      const { data, error, count } = await query;
      
      if (error) {
        throw error;
      }
      
      return {
        logs: data || [],
        count: count || 0
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des logs:', error);
      return { logs: [], count: 0 };
    }
  }

  /**
   * Exporter les logs au format CSV
   */
  public async exportLogsAsCsv(options: {
    level?: LogLevel;
    startDate?: Date;
    endDate?: Date;
    source?: string;
    userId?: string;
  } = {}): Promise<string> {
    try {
      // Récupérer tous les logs correspondant aux critères
      const { logs } = await this.getLogs({
        ...options,
        limit: 10000 // Limiter à 10000 logs pour éviter les problèmes de mémoire
      });
      
      if (logs.length === 0) {
        return 'Timestamp,Level,Source,Message,Details,User ID\n';
      }
      
      // Convertir en CSV
      const headers = 'Timestamp,Level,Source,Message,Details,User ID\n';
      const rows = logs.map(log => {
        // Échapper les virgules et les guillemets dans les champs
        const message = log.message ? `"${log.message.replace(/"/g, '""')}"` : '';
        const source = log.source ? `"${log.source.replace(/"/g, '""')}"` : '';
        const details = log.details ? `"${JSON.stringify(log.details).replace(/"/g, '""')}"` : '';
        
        return [
          log.timestamp,
          log.level,
          source,
          message,
          details,
          log.user_id || ''
        ].join(',');
      });
      
      return headers + rows.join('\n');
    } catch (error) {
      console.error('Erreur lors de l\'exportation des logs:', error);
      return 'Erreur lors de l\'exportation des logs';
    }
  }

  /**
   * Nettoyer les logs anciens (plus de 30 jours)
   */
  public async cleanupOldLogs(): Promise<void> {
    try {
      const { error } = await supabase.rpc('cleanup_old_logs');
      
      if (error) {
        throw error;
      }
      
      this.info('Nettoyage des logs anciens effectué avec succès', null, 'Logger');
    } catch (error) {
      console.error('Erreur lors du nettoyage des logs anciens:', error);
      this.error('Erreur lors du nettoyage des logs anciens', error, 'Logger');
    }
  }
}

// Exporter l'instance unique du logger
export const logger = Logger.getInstance();

// Fonction utilitaire pour enregistrer les erreurs avec la stack trace
export function logError(error: Error, source?: string, userId?: string): void {
  logger.error(
    error.message,
    {
      stack: error.stack,
      name: error.name
    },
    source,
    userId
  );
}

// Fonction pour capturer les erreurs non gérées
export function setupGlobalErrorHandling(): void {
  if (typeof window !== 'undefined') {
    // Capturer les erreurs non gérées
    window.addEventListener('error', (event) => {
      logError(
        event.error || new Error(event.message),
        'GlobalErrorHandler',
        undefined
      );
    });
    
    // Capturer les rejets de promesses non gérés
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      logError(
        error,
        'UnhandledRejection',
        undefined
      );
    });
    
    console.log('Global error handling configured');
  }
}