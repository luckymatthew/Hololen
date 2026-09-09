// Legacy Sites adapter bindings; Firebase client builds never import these.
interface Fetcher { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>; }
interface D1Database { prepare(query: string): any; batch(statements: any[]): Promise<any[]>; exec(query: string): Promise<any>; }
declare module 'cloudflare:workers' { export const env: Record<string, any>; }
