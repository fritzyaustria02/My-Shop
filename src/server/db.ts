import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { Asset } from '../types';

// Password hashing helper using Node's standard crypto module
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export interface AdminAccount {
  id: string;
  username: string;
  passwordHash: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: 'server-client-role',
      email: null,
      emailVerified: null,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const INITIAL_ASSETS: Asset[] = [
  {
    id: 'asset-1',
    name: 'Unreal Stylized Forest Pack',
    description: 'A complete, modular hand-painted modular forest pack including 45 premium rock models, 15 tree meshes with custom wind shaders, and immersive ground materials.',
    price: 34.99,
    imageUrl: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=800',
    category: '3D Assets',
    tags: ['Popular', 'Unreal 5', 'Stylized'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'asset-2',
    name: 'Sci-Fi Cyberpunk HUD Kit',
    description: 'Neon cyan layered user interface dashboard. Over 120 vector design elements like reticles, scopes, gauges, frame boundaries, and telemetry panels for custom integrations.',
    price: 19.00,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800',
    category: 'UI Kits',
    tags: ['Popular', 'Vector', 'Futuristic'],
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'asset-3',
    name: 'RPG Skill Icon Masterclass Pack',
    description: '250+ ultra-detailed fantasy skill icons. Fully illustrated spells, passive abilities, weapons, stats, and loot components in 3 distinct size formats.',
    price: 0, // Free
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&q=80&w=800',
    category: 'Icons',
    tags: ['Free', 'RPG', 'Illustrated'],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'asset-4',
    name: 'Cinematic Ambient Soundscapes',
    description: '10 unique high-fidelity 96kHz spacial drone sound files. Designed for atmospheric space exploration, minimalist puzzles, and horror/thriller backgrounds.',
    price: 0, // Free
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800',
    category: 'Audio',
    tags: ['Free', 'Ambient', 'High-Res'],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: 'asset-5',
    name: 'Lustrous Ocean Shader',
    description: 'Complex real-time water shader with full wave crest simulation, subsurface scattering, foam generation on boundaries, and complete customizable depth absorption.',
    price: 14.50,
    imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&q=80&w=800',
    category: 'Shaders',
    tags: ['New', 'Shaders', 'Mobile Friendly'],
    createdAt: new Date(Date.now() - 800000).toISOString()
  }
];

export class Database {
  private static db: any = null;
  private static isInitialized = false;

  private static async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      const firebaseConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
      
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

      // Validate Connection to Firestore (Skill Requirement)
      try {
        await getDoc(doc(this.db, 'test/connection'));
      } catch (err) {
        console.warn('Firebase server connection check bypass/fallback:', err);
      }

      // Bootstrap databases
      await this.bootstrapAdmins();
      await this.bootstrapAssets();

      this.isInitialized = true;
    } catch (e: any) {
      console.error('Failed to initialize Firestore database:', e);
      throw e;
    }
  }

  private static async bootstrapAdmins(): Promise<void> {
    const adminRef1 = doc(this.db, 'admins', 'admin-1');
    const adminRef2 = doc(this.db, 'admins', 'admin-2');
    
    try {
      const snap1 = await getDoc(adminRef1);
      if (!snap1.exists()) {
        await setDoc(adminRef1, {
          id: 'admin-1',
          username: 'admin',
          passwordHash: hashPassword('password123')
        });
      }
      
      const snap2 = await getDoc(adminRef2);
      if (!snap2.exists()) {
        await setDoc(adminRef2, {
          id: 'admin-2',
          username: 'Ayumi',
          passwordHash: hashPassword('AyumiAdmin098')
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'admins');
    }
  }

  private static async bootstrapAssets(): Promise<void> {
    const assetsCol = collection(this.db, 'assets');
    try {
      const assetsSnap = await getDocs(assetsCol);
      if (assetsSnap.empty) {
        for (const asset of INITIAL_ASSETS) {
          await setDoc(doc(this.db, 'assets', asset.id), asset);
        }
        console.log('Successfully bootstrapped initial assets to Firestore.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assets');
    }
  }

  public static async getAssets(): Promise<Asset[]> {
    await this.init();
    const assetsCol = collection(this.db, 'assets');
    try {
      const querySnap = await getDocs(assetsCol);
      const list: Asset[] = [];
      querySnap.forEach((docSnap: any) => {
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
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'assets');
      return [];
    }
  }

  public static async addAsset(asset: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> {
    await this.init();
    const id = `asset-${crypto.randomBytes(6).toString('hex')}`;
    const createdAt = new Date().toISOString();
    
    const newAsset: Asset = {
      ...asset,
      id,
      createdAt,
      clicks: 0,
      downloads: 0,
      favorites: 0
    };

    try {
      await setDoc(doc(this.db, 'assets', id), newAsset);
      return newAsset;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `assets/${id}`);
      throw error;
    }
  }

  public static async updateAsset(id: string, updatedFields: Partial<Asset>): Promise<Asset> {
    await this.init();
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid, null or undefined asset ID provided to updateAsset');
    }
    const assetRef = doc(this.db, 'assets', id);
    try {
      const docSnap = await getDoc(assetRef);
      if (!docSnap.exists()) {
        throw new Error(`Asset with id ${id} not found`);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
      throw error;
    }
  }

  public static async recordClick(id: string): Promise<Asset> {
    await this.init();
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid, null or undefined asset ID provided to recordClick');
    }
    const assetRef = doc(this.db, 'assets', id);
    try {
      const docSnap = await getDoc(assetRef);
      if (!docSnap.exists()) {
        throw new Error(`Asset with id ${id} not found`);
      }
      const currentAsset = docSnap.data() as Asset;
      const updatedAsset: Asset = {
        ...currentAsset,
        clicks: (currentAsset.clicks || 0) + 1
      };
      await setDoc(assetRef, updatedAsset);
      return updatedAsset;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
      throw error;
    }
  }

  public static async recordDownload(id: string): Promise<Asset> {
    await this.init();
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid, null or undefined asset ID provided to recordDownload');
    }
    const assetRef = doc(this.db, 'assets', id);
    try {
      const docSnap = await getDoc(assetRef);
      if (!docSnap.exists()) {
        throw new Error(`Asset with id ${id} not found`);
      }
      const currentAsset = docSnap.data() as Asset;
      const updatedAsset: Asset = {
        ...currentAsset,
        downloads: (currentAsset.downloads || 0) + 1
      };
      await setDoc(assetRef, updatedAsset);
      return updatedAsset;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
      throw error;
    }
  }

  public static async toggleFavorite(id: string, action: 'increment' | 'decrement'): Promise<Asset> {
    await this.init();
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid, null or undefined asset ID provided to toggleFavorite');
    }
    const assetRef = doc(this.db, 'assets', id);
    try {
      const docSnap = await getDoc(assetRef);
      if (!docSnap.exists()) {
        throw new Error(`Asset with id ${id} not found`);
      }
      const currentAsset = docSnap.data() as Asset;
      const currentFavs = currentAsset.favorites || 0;
      const nextFavs = action === 'increment' ? currentFavs + 1 : Math.max(0, currentFavs - 1);
      const updatedAsset: Asset = {
        ...currentAsset,
        favorites: nextFavs
      };
      await setDoc(assetRef, updatedAsset);
      return updatedAsset;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `assets/${id}`);
      throw error;
    }
  }

  public static async deleteAsset(id: string): Promise<boolean> {
    await this.init();
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid, null or undefined asset ID provided to deleteAsset');
    }
    const assetRef = doc(this.db, 'assets', id);
    try {
      const docSnap = await getDoc(assetRef);
      if (!docSnap.exists()) {
        return false;
      }
      await deleteDoc(assetRef);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `assets/${id}`);
      throw error;
    }
  }

  public static async getAdminByUsername(username: string): Promise<AdminAccount | null> {
    await this.init();
    try {
      const adminsCol = collection(this.db, 'admins');
      const querySnap = await getDocs(adminsCol);
      let matchAdmin: AdminAccount | null = null;
      querySnap.forEach((docSnap: any) => {
        const ad = docSnap.data() as AdminAccount;
        if (ad.username.toLowerCase() === username.toLowerCase()) {
          matchAdmin = ad;
        }
      });
      return matchAdmin;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'admins');
      return null;
    }
  }
}
