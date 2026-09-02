declare module 'expo-file-system/legacy' {
  export const cacheDirectory: string | null;

  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: 'utf8' | 'base64' | 'base64url' },
  ): Promise<string>;

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: 'utf8' | 'base64' | 'base64url' },
  ): Promise<void>;
}