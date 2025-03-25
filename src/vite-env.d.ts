/// <reference types="vite/client" />

// Global type definitions
declare global {
  // Add proper type for WebkitAudioContext
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }

  // Add proper type for EdgeRuntime
  interface EdgeRuntime {
    waitUntil(promise: Promise<any>): void;
  }

  // Add proper type for process.env
  namespace NodeJS {
    interface ProcessEnv {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
      VITE_SUPABASE_SERVICE_ROLE_KEY: string;
      VITE_OPENAI_API_KEY: string;
      [key: string]: string | undefined;
    }
  }
}

// Export empty object to make this a module
export {};