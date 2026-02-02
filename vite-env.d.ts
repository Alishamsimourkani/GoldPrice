/// <reference types="vite/client" />

// FIX: Explicitly defined ImportMetaEnv and ImportMeta to handle environments where vite/client types might not be correctly indexed.
interface ImportMetaEnv {
  readonly VITE_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// FIX: Ensured NodeJS.ProcessEnv is properly typed for the Gemini API and other environment variable access.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_KEY: string;
  }
}
