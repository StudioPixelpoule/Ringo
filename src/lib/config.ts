import { AppError } from './AppError';

interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceKey?: string;
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

    // Get environment variables with fallbacks
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kitzhhrhlaevrtbqnbma.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdHpoaHJobGFldnJ0YnFuYm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA0MzU2MDAsImV4cCI6MjAyNjAxMTYwMH0.Rl5E7cN_K5JTaO_ps7N_YMeT4AjZKMwVoh-fP8nGd8Q';
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY || 'sk-default-key';

    // Validate URLs
    try {
      new URL(supabaseUrl);
    } catch {
      console.warn('Invalid VITE_SUPABASE_URL, using default');
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
    console.error('Configuration error:', error);

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