import { AppError } from './AppError';
import { logError } from './errorLogger';

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
      type: 'CONFIG_ERROR',
      message,
      context: {
        component: 'config',
        action: 'validation'
      }
    });
  }
}

function getEnvVar(key: string, required: boolean = true): string {
  const value = import.meta.env[key];
  
  if (!value && required) {
    throw new ConfigError(`Required environment variable ${key} is missing`);
  }
  
  return value || '';
}

function validateConfig(): Config {
  try {
    // Determine environment
    const mode = import.meta.env.MODE || 'development';
    const isDev = mode === 'development';
    const isProd = mode === 'production';
    const isTest = mode === 'test';

    // Required variables in all environments
    const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
    const openaiApiKey = getEnvVar('VITE_OPENAI_API_KEY');

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
      'Application configuration error. Please check environment variables.'
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