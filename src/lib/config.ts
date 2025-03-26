import { AppError } from './AppError';
import { logError } from './errorLogger';
import { AuthErrorType } from './errorTypes';

interface Config {
  supabase: {
    url: string;
    anonKey: string;
  };
  openai: {
    apiKey: string;
  };
  env: {
    mode: 'development' | 'production' | 'test';
    isDev: boolean;
    isProd: boolean;
    isTest: boolean;
  };
  app: {
    name: string;
    version: string;
    buildDate: string;
    copyright: string;
  };
}

class ConfigError extends AppError {
  constructor(message: string) {
    super({
      type: AuthErrorType.INITIALIZATION_FAILED,
      message,
      context: {
        component: 'config',
        action: 'validation'
      }
    });
  }
}

function validateConfig(): Config {
  try {
    // Required variables in all environments
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!supabaseUrl) {
      throw new ConfigError('VITE_SUPABASE_URL is required');
    }

    if (!supabaseAnonKey) {
      throw new ConfigError('VITE_SUPABASE_ANON_KEY is required');
    }

    if (!openaiApiKey) {
      throw new ConfigError('VITE_OPENAI_API_KEY is required');
    }

    // Validate URLs
    try {
      new URL(supabaseUrl);
    } catch {
      throw new ConfigError('VITE_SUPABASE_URL must be a valid URL');
    }

    // Validate key formats
    if (!/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(supabaseAnonKey)) {
      throw new ConfigError('VITE_SUPABASE_ANON_KEY has invalid format');
    }

    if (!openaiApiKey.startsWith('sk-')) {
      throw new ConfigError('VITE_OPENAI_API_KEY must start with sk-');
    }

    // Determine environment
    const mode = import.meta.env.MODE || 'development';
    const isDev = mode === 'development';
    const isProd = mode === 'production';
    const isTest = mode === 'test';

    // App version info
    const appVersion = '1.1.0';
    const buildDate = '2025-03-25';
    const copyright = '© 2025 En Mode Solutions. Tous droits réservés.';

    // Build config object
    return {
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseAnonKey
      },
      openai: {
        apiKey: openaiApiKey
      },
      env: {
        mode,
        isDev,
        isProd,
        isTest
      },
      app: {
        name: 'RINGO',
        version: appVersion,
        buildDate,
        copyright
      }
    };
  } catch (error) {
    // Log error but don't expose sensitive details
    logError(error, {
      component: 'config',
      action: 'validation'
    });

    // Re-throw with safe message
    throw new ConfigError(
      'Erreur de configuration. Veuillez vérifier les variables d\'environnement.'
    );
  }
}

// Export validated config
export const config = validateConfig();

// Export environment helpers
export const isDev = config.env.isDev;
export const isProd = config.env.isProd;
export const isTest = config.env.isTest;

// Export type for use in other files
export type { Config };