interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  openai: {
    apiKey: string;
  };
}

class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function validateConfig(): Config {
  const requiredVars = {
    'VITE_SUPABASE_URL': import.meta.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_ANON_KEY': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'VITE_SUPABASE_SERVICE_ROLE_KEY': import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    'VITE_OPENAI_API_KEY': import.meta.env.VITE_OPENAI_API_KEY
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new ConfigError(
      `Variables d'environnement manquantes : ${missingVars.join(', ')}`
    );
  }

  return {
    supabase: {
      url: requiredVars.VITE_SUPABASE_URL,
      anonKey: requiredVars.VITE_SUPABASE_ANON_KEY,
      serviceKey: requiredVars.VITE_SUPABASE_SERVICE_ROLE_KEY
    },
    openai: {
      apiKey: requiredVars.VITE_OPENAI_API_KEY
    }
  };
}

export const config = validateConfig();