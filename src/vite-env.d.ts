/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_APP_VERSION?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS modules
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Module declarations for CI/CD compatibility
declare module 'react-dom/client' {
  import * as React from 'react';
  
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  
  export function createRoot(container: Element | DocumentFragment): Root;
  export function hydrateRoot(container: Element | Document, initialChildren: React.ReactNode): Root;
}
