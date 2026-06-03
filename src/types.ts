export interface Asset {
  id: string;
  name: string;
  description: string;
  price: number; // 0 represents "Free"
  purchaseLink?: string; // Optional URL/Roblox gamepass link
  downloadUrl?: string; // Optional direct file download URL for free assets
  downloadFileName?: string; // Optional original file name for free downloads
  imageUrl: string; // URL or Base64 data-URL
  category: string; // e.g., "UI Kits", "Icons", "3D Assets", "Audio", "Shaders"
  tags: string[]; // e.g., ["Popular", "New", "Cinematic"]
  clicks?: number;
  downloads?: number;
  favorites?: number;
  createdAt: string;
}

export interface User {
  username: string;
}

export interface AuthResponse {
  token: string;
  username: string;
}
