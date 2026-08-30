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

// Archiver module declaration (CI/CD fallback)
declare module 'archiver' {
  import { Readable } from 'stream';
  
  interface ArchiverOptions {
    zlib?: { level?: number };
  }
  
  interface Archiver extends Readable {
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    file(filepath: string, data?: any): this;
    directory(dirpath: string, destpath?: string): this;
    finalize(): Promise<void>;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }
  
  export class ZipArchive {
    constructor(options?: ArchiverOptions);
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    file(filepath: string, data?: any): this;
    directory(dirpath: string, destpath?: string): this;
    append(source: string | Buffer | Readable, data?: any): this;
    finalize(): Promise<void>;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'warning', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
  }
}
