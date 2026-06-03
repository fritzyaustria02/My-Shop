import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
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

export interface DbSchema {
  assets: Asset[];
  admins: AdminAccount[];
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'marketplace-db.json');

// SHA-256 hash of 'password123'
const DEFAULT_ADMIN_HASH = hashPassword('password123');

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
  private static schema: DbSchema | null = null;

  // Initialize DB directory and file if it does not exist
  private static async init(): Promise<void> {
    if (this.schema) return;

    try {
      await fs.mkdir(DB_DIR, { recursive: true });
    } catch (e) {
      // Ignore directory exists errors
    }

    try {
      const data = await fs.readFile(DB_FILE, 'utf-8');
      this.schema = JSON.parse(data);
      
      // Safety: always ensure 'Ayumi' admin is registered in existing database
      if (this.schema && Array.isArray(this.schema.admins)) {
        const hasAyumi = this.schema.admins.some(a => a.username.toLowerCase() === 'ayumi');
        if (!hasAyumi) {
          this.schema.admins.push({
            id: 'admin-2',
            username: 'Ayumi',
            passwordHash: hashPassword('AyumiAdmin098')
          });
          await this.save();
        }
      }
    } catch (error) {
      // Create fresh file if read fails (e.g. file doesn't exist)
      this.schema = {
        assets: INITIAL_ASSETS,
        admins: [
          {
            id: 'admin-1',
            username: 'admin',
            passwordHash: DEFAULT_ADMIN_HASH
          },
          {
            id: 'admin-2',
            username: 'Ayumi',
            passwordHash: hashPassword('AyumiAdmin098')
          }
        ]
      };
      await this.save();
    }
  }

  private static async save(): Promise<void> {
    if (!this.schema) return;
    await fs.writeFile(DB_FILE, JSON.stringify(this.schema, null, 2), 'utf-8');
  }

  public static async getAssets(): Promise<Asset[]> {
    await this.init();
    return this.schema ? this.schema.assets : [];
  }

  public static async addAsset(asset: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');

    const newAsset: Asset = {
      ...asset,
      id: `asset-${crypto.randomBytes(6).toString('hex')}`,
      createdAt: new Date().toISOString()
    };

    this.schema.assets.unshift(newAsset); // Add to beginning of the list
    await this.save();
    return newAsset;
  }

  public static async updateAsset(id: string, updatedFields: Partial<Asset>): Promise<Asset> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');

    const index = this.schema.assets.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Asset with id ${id} not found`);

    const currentAsset = this.schema.assets[index];
    const updatedAsset: Asset = {
      ...currentAsset,
      ...updatedFields,
      id, // Protect ID overriding
      createdAt: currentAsset.createdAt // Safeguard original creation time
    };

    this.schema.assets[index] = updatedAsset;
    await this.save();
    return updatedAsset;
  }

  public static async recordClick(id: string): Promise<Asset> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');
    const index = this.schema.assets.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Asset with id ${id} not found`);
    const currentAsset = this.schema.assets[index];
    const updatedAsset: Asset = {
      ...currentAsset,
      clicks: (currentAsset.clicks || 0) + 1
    };
    this.schema.assets[index] = updatedAsset;
    await this.save();
    return updatedAsset;
  }

  public static async recordDownload(id: string): Promise<Asset> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');
    const index = this.schema.assets.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Asset with id ${id} not found`);
    const currentAsset = this.schema.assets[index];
    const updatedAsset: Asset = {
      ...currentAsset,
      downloads: (currentAsset.downloads || 0) + 1
    };
    this.schema.assets[index] = updatedAsset;
    await this.save();
    return updatedAsset;
  }

  public static async toggleFavorite(id: string, action: 'increment' | 'decrement'): Promise<Asset> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');
    const index = this.schema.assets.findIndex(a => a.id === id);
    if (index === -1) throw new Error(`Asset with id ${id} not found`);
    const currentAsset = this.schema.assets[index];
    const currentFavs = currentAsset.favorites || 0;
    const nextFavs = action === 'increment' ? currentFavs + 1 : Math.max(0, currentFavs - 1);
    const updatedAsset: Asset = {
      ...currentAsset,
      favorites: nextFavs
    };
    this.schema.assets[index] = updatedAsset;
    await this.save();
    return updatedAsset;
  }

  public static async deleteAsset(id: string): Promise<boolean> {
    await this.init();
    if (!this.schema) throw new Error('DB not initialized');

    const originalLength = this.schema.assets.length;
    this.schema.assets = this.schema.assets.filter(a => a.id !== id);
    
    if (this.schema.assets.length < originalLength) {
      await this.save();
      return true;
    }
    return false;
  }

  public static async getAdminByUsername(username: string): Promise<AdminAccount | null> {
    await this.init();
    if (!this.schema) return null;

    const admin = this.schema.admins.find(a => a.username.toLowerCase() === username.toLowerCase());
    return admin || null;
  }
}
