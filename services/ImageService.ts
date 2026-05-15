
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { storage, isConfigured as isFirebaseConfigured } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Define the DB Schema Interface
interface ImageDB extends DBSchema {
  images: {
    key: string;
    value: {
        id: string;
        blob: Blob;
        timestamp: number;
    };
  };
}

const DB_NAME = 'mosque-assets-db';
const STORE_NAME = 'images';

class ImageService {
  private dbPromise: Promise<IDBPDatabase<ImageDB>>;

  constructor() {
    this.dbPromise = openDB<ImageDB>(DB_NAME, 1, {
      upgrade(db: IDBPDatabase<ImageDB>) {
        // Explicitly typed 'db' parameter fixes the "implicitly has an 'any' type" error
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  // Save image locally (Offline first)
  async saveLocally(id: string, file: File | Blob): Promise<string> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, {
        id,
        blob: file,
        timestamp: Date.now()
    });
    return URL.createObjectURL(file);
  }

  // Upload to Firebase Storage
  async uploadToCloud(file: File, path: string): Promise<string> {
    if (!isFirebaseConfigured || !storage) {
        // Fallback to local if Firebase isn't configured
        return this.saveLocally(path, file);
    }

    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch (error) {
        console.error("Upload failed:", error);
        return this.saveLocally(path, file);
    }
  }

  async getLocalImage(id: string): Promise<string | null> {
      try {
        const db = await this.dbPromise;
        const record = await db.get(STORE_NAME, id);
        if (record) {
            return URL.createObjectURL(record.blob);
        }
        return null;
      } catch (e) {
          return null;
      }
  }
}

export const imageService = new ImageService();
