import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Asset } from '../types';

let db: any = null;

export function getClientDb() {
  if (db) return db;
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  return db;
}

// SHA-256 password hash client implementation compatible with crypto/db.ts
export async function hashPasswordClient(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const firebaseClient = {
  // 1. Fetch Assets
  getAssets: async (): Promise<Asset[]> => {
    const firestoreDb = getClientDb();
    const assetsCol = collection(firestoreDb, 'assets');
    const querySnap = await getDocs(assetsCol);
    const list: Asset[] = [];
    querySnap.forEach((docSnap) => {
      const data = docSnap.data() as Asset;
      if (data) {
        list.push({
          ...data,
          id: data.id || docSnap.id,
          name: data.name || 'Unnamed Asset',
          price: typeof data.price === 'number' ? data.price : 0,
          imageUrl: data.imageUrl || '',
          category: data.category || 'Templates',
          createdAt: data.createdAt || new Date().toISOString()
        });
      }
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // 2. Click tracking
  recordClick: async (id: string): Promise<number> => {
    const firestoreDb = getClientDb();
    const assetRef = doc(firestoreDb, 'assets', id);
    const docSnap = await getDoc(assetRef);
    if (!docSnap.exists()) {
      throw new Error(`Asset not found`);
    }
    const currentAsset = docSnap.data() as Asset;
    const nextClicks = (currentAsset.clicks || 0) + 1;
    await setDoc(assetRef, {
      ...currentAsset,
      clicks: nextClicks
    });
    return nextClicks;
  },

  // 3. Download tracking
  recordDownload: async (id: string): Promise<number> => {
    const firestoreDb = getClientDb();
    const assetRef = doc(firestoreDb, 'assets', id);
    const docSnap = await getDoc(assetRef);
    if (!docSnap.exists()) {
      throw new Error(`Asset not found`);
    }
    const currentAsset = docSnap.data() as Asset;
    const nextDownloads = (currentAsset.downloads || 0) + 1;
    await setDoc(assetRef, {
      ...currentAsset,
      downloads: nextDownloads
    });
    return nextDownloads;
  },

  // 4. Toggle Favorite metric
  toggleFavorite: async (id: string, action: 'increment' | 'decrement'): Promise<number> => {
    const firestoreDb = getClientDb();
    const assetRef = doc(firestoreDb, 'assets', id);
    const docSnap = await getDoc(assetRef);
    if (!docSnap.exists()) {
      throw new Error(`Asset not found`);
    }
    const currentAsset = docSnap.data() as Asset;
    const currentFavs = currentAsset.favorites || 0;
    const nextFavs = action === 'increment' ? currentFavs + 1 : Math.max(0, currentFavs - 1);
    await setDoc(assetRef, {
      ...currentAsset,
      favorites: nextFavs
    });
    return nextFavs;
  },

  // 5. Admin Authentication local verification
  loginAdmin: async (username: string, passwordHash: string): Promise<boolean> => {
    const firestoreDb = getClientDb();
    const adminsCol = collection(firestoreDb, 'admins');
    const querySnap = await getDocs(adminsCol);
    let matched = false;
    querySnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.username && data.username.toLowerCase() === username.toLowerCase()) {
        if (data.passwordHash === passwordHash) {
          matched = true;
        }
      }
    });
    return matched;
  },

  // 6. Admin Create Asset
  createAsset: async (asset: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> => {
    const firestoreDb = getClientDb();
    // Unique random hex generator (client friendly)
    const randomHex = Array.from({length: 6}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const id = `asset-${randomHex}`;
    const createdAt = new Date().toISOString();
    
    const newAsset: Asset = {
      ...asset,
      id,
      createdAt,
      clicks: 0,
      downloads: 0,
      favorites: 0
    };

    await setDoc(doc(firestoreDb, 'assets', id), newAsset);
    return newAsset;
  },

  // 7. Admin Update Asset
  updateAsset: async (id: string, updatedFields: Partial<Asset>): Promise<Asset> => {
    const firestoreDb = getClientDb();
    const assetRef = doc(firestoreDb, 'assets', id);
    const docSnap = await getDoc(assetRef);
    if (!docSnap.exists()) {
      throw new Error(`Asset not found`);
    }
    const currentAsset = docSnap.data() as Asset;
    const updatedAsset: Asset = {
      ...currentAsset,
      ...updatedFields,
      id,
      createdAt: currentAsset.createdAt
    };
    await setDoc(assetRef, updatedAsset);
    return updatedAsset;
  },

  // 8. Admin Delete Asset
  deleteAsset: async (id: string): Promise<boolean> => {
    const firestoreDb = getClientDb();
    const assetRef = doc(firestoreDb, 'assets', id);
    const docSnap = await getDoc(assetRef);
    if (!docSnap.exists()) {
      return false;
    }
    await deleteDoc(assetRef);
    return true;
  }
};
