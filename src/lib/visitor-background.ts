export interface BackgroundPosition {
  x: number;
  y: number;
}

export interface VisitorBackground {
  id: 'current';
  /** 首页使用的轻量版本。 */
  image: Blob;
  /** 仅在互动取景框打开时读取的未压缩原图。 */
  originalImage?: Blob;
  title: string;
  date: string;
  note: string;
  position: BackgroundPosition;
  updatedAt: string;
}

const DB_NAME = 'flacko-viewfinder';
const DB_VERSION = 1;
const STORE_NAME = 'visitor-backgrounds';
const RECORD_ID = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开本地背景存储'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本地背景操作失败'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('本地背景写入失败'));
    };
  });
}

export function loadVisitorBackground(): Promise<VisitorBackground | undefined> {
  return withStore('readonly', store => store.get(RECORD_ID));
}

export function saveVisitorBackground(background: VisitorBackground): Promise<IDBValidKey> {
  return withStore('readwrite', store => store.put(background));
}

export function deleteVisitorBackground(): Promise<undefined> {
  return withStore('readwrite', store => store.delete(RECORD_ID));
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('图片压缩失败')),
      'image/webp',
      0.88,
    );
  });
}

/** 将访客图片限制到适合全屏背景的尺寸，处理过程完全发生在浏览器本地。 */
export async function compressBackgroundImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');

  const bitmap = await createImageBitmap(file);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 2560 / longestEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error('浏览器无法处理该图片');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvasToBlob(canvas);
}
