export {};
declare global {
  interface Window {
    HoloNative?: {
      startScanner(): void;
      importJson(): void;
      exportJson(name: string, json: string): void;
      openExternal(url: string): void;
      artUrl?(url: string): string;
    };
    __holoBack?: () => boolean;
  }
}
