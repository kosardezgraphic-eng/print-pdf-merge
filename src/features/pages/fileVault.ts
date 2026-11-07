import type { SourceFileMeta } from '../../shared/types';

export interface StoredSourceEntry {
  meta: SourceFileMeta;
  file?: File;
  bytes?: Uint8Array;
  /** For multi-page or decoded TIFF/WebP/BMP frames, cached lossless PNG bytes per frame index */
  losslessPngFrames?: Map<number, Uint8Array>;
}

const vault = new Map<string, StoredSourceEntry>();

export function putSourceInVault(entry: StoredSourceEntry): void {
  vault.set(entry.meta.id, entry);
}

export function getSourceFromVault(sourceFileId: string): StoredSourceEntry | undefined {
  return vault.get(sourceFileId);
}

export async function getSourceBytes(sourceFileId: string): Promise<Uint8Array> {
  const entry = vault.get(sourceFileId);
  if (!entry) {
    throw new Error('فایل منبع در حافظه برنامه یافت نشد. لطفاً فایل را مجدداً اضافه کنید.');
  }
  if (entry.bytes) {
    return entry.bytes;
  }
  if (entry.file) {
    const buf = await entry.file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    entry.bytes = bytes;
    return bytes;
  }
  throw new Error(`داده باینری فایل «${entry.meta.name}» در دسترس نیست.`);
}

export function cacheLosslessPngFrame(
  sourceFileId: string,
  frameIndex: number,
  pngBytes: Uint8Array
): void {
  const entry = vault.get(sourceFileId);
  if (!entry) return;
  if (!entry.losslessPngFrames) {
    entry.losslessPngFrames = new Map();
  }
  entry.losslessPngFrames.set(frameIndex, pngBytes);
}

export function getCachedLosslessPngFrame(
  sourceFileId: string,
  frameIndex: number
): Uint8Array | undefined {
  return vault.get(sourceFileId)?.losslessPngFrames?.get(frameIndex);
}

export function listVaultMetas(): SourceFileMeta[] {
  return Array.from(vault.values()).map((e) => e.meta);
}

export function removeUnusedSourcesFromVault(referencedSourceIds: Set<string>): void {
  for (const id of Array.from(vault.keys())) {
    if (!referencedSourceIds.has(id)) {
      vault.delete(id);
    }
  }
}

export function clearVault(): void {
  vault.clear();
}
