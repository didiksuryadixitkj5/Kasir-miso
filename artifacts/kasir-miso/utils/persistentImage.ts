import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

type ImageAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string;
};

const mimeTypeFromUri = (uri: string) => {
  if (/\.png(?:\?|$)/i.test(uri)) return 'image/png';
  if (/\.webp(?:\?|$)/i.test(uri)) return 'image/webp';
  return 'image/jpeg';
};

export async function persistImageAsset(asset: ImageAsset): Promise<string> {
  if (asset.base64) {
    return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  }
  return (await persistImageUri(asset.uri)) || asset.uri;
}

export async function persistImageUri(uri: string | undefined) {
  if (!uri || uri.startsWith('data:') || /^https?:\/\//i.test(uri) || Platform.OS === 'web') {
    return uri;
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return `data:${mimeTypeFromUri(uri)};base64,${base64}`;
  } catch {
    // Keep the current URI if the cache file has already been removed.
    return uri;
  }
}