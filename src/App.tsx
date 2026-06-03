import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, ShoppingBag, LogIn, LogOut, Settings, 
  Layers, Filter, Sparkles, Download, Check, X,
  ExternalLink, ArrowUpRight, HelpCircle, AlertCircle, RefreshCw
} from 'lucide-react';
import { Asset } from './types';
import AssetCard from './components/AssetCard';
import AdminLoginModal from './components/AdminLoginModal';
import AdminDashboard from './components/AdminDashboard';

const CATEGORIES = ["All", "3D Assets", "UI Kits", "Icons", "Audio", "Shaders", "Materials", "Templates"];

export default function App() {
  // Assets list catalogs
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter queries
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [priceFilter, setPriceFilter] = useState<'All' | 'Free' | 'Paid'>('All');

  // Authentication states
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminModeActive, setIsAdminModeActive] = useState(false); // Controls if we are viewing the Admin Dashboard

  // Detail overlay states
  const [selectedAssetForView, setSelectedAssetForView] = useState<Asset | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadComplete, setIsDownloadComplete] = useState(false);
  const downloadIntervalRef = useRef<any>(null);
  
  // Sorting queries
  const [sortBy, setSortBy] = useState<'Newest' | 'Popular'>('Newest');

  // Favorites tracking list
  const [favoritedIds, setFavoritedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ayumi_favorites');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Hydrate admin session token from LocalStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token');
    const storedUser = localStorage.getItem('admin_user');
    if (storedToken && storedUser) {
      setAdminToken(storedToken);
      setAdminUser(storedUser);
    }
    fetchAssets();
  }, []);

  const trackClick = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/click`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, clicks: data.clicks } : a));
        setSelectedAssetForView(prev => prev && prev.id === assetId ? { ...prev, clicks: data.clicks } : prev);
      }
    } catch (err) {
      console.error('Failed to track click:', err);
    }
  };

  const trackDownload = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/download`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, downloads: data.downloads } : a));
        setSelectedAssetForView(prev => prev && prev.id === assetId ? { ...prev, downloads: data.downloads } : prev);
      }
    } catch (err) {
      console.error('Failed to track download:', err);
    }
  };

  const handleToggleFavorite = async (assetId: string) => {
    const isCurrentlyFavorited = favoritedIds.includes(assetId);
    const action = isCurrentlyFavorited ? 'decrement' : 'increment';
    
    try {
      const res = await fetch(`/api/assets/${assetId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        const data = await res.json();
        let updatedFavs: string[];
        if (isCurrentlyFavorited) {
          updatedFavs = favoritedIds.filter(id => id !== assetId);
        } else {
          updatedFavs = [...favoritedIds, assetId];
        }
        setFavoritedIds(updatedFavs);
        localStorage.setItem('ayumi_favorites', JSON.stringify(updatedFavs));

        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, favorites: data.favorites } : a));
        
        // Also update details panel active instance
        setSelectedAssetForView(prev => prev && prev.id === assetId ? { ...prev, favorites: data.favorites } : prev);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const fetchAssets = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/assets');
      if (!response.ok) {
        throw new Error('Failed to fetch asset catalog from server.');
      }
      const data = await response.json();
      setAssets(data);
    } catch (err: any) {
      setFetchError(err.message || 'Error communicating with full-stack endpoints.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login handler
  const handleLoginSuccess = (token: string, username: string) => {
    setAdminToken(token);
    setAdminUser(username);
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', username);
    setIsAdminModeActive(true); // Automatically switch to dashboard upon auth mapping
  };

  // Logout handler
  const handleLogout = () => {
    setAdminToken(null);
    setAdminUser(null);
    setIsAdminModeActive(false);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  };

  // Asset additions callbacks
  const handleAssetCreated = (newAsset: Asset) => {
    setAssets(prev => [newAsset, ...prev]);
  };

  const handleAssetUpdated = (updatedAsset: Asset) => {
    setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
  };

  const handleAssetDeleted = (deletedId: string) => {
    setAssets(prev => prev.filter(a => a.id !== deletedId));
  };

  const handleCloseModal = () => {
    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
      downloadIntervalRef.current = null;
    }
    setIsDownloading(false);
    setIsDownloadComplete(false);
    setDownloadProgress(0);
    setSelectedAssetForView(null);
  };

  // Trigger single actual download file action (reusable for auto triggered and user-triggered click backup)
  const downloadPhysicalFile = (asset?: Asset | null) => {
    try {
      if (!asset) {
        console.error('downloadPhysicalFile called with null or undefined asset');
        return;
      }
      const safeName = asset.name || 'asset';
      const sanitizedName = safeName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (asset.downloadUrl) {
        const link = document.createElement('a');
        link.href = asset.downloadUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const finalFileName = asset.downloadFileName || `${sanitizedName}-pack.zip`;
        link.setAttribute('download', finalFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fileContent = `=== AYUMI ASSET SHOP PACKAGE ===\n\nAsset ID: ${asset.id || 'unknown'}\nAsset Name: ${asset.name || 'Ayumi Asset'}\nCategory: ${asset.category || 'Asset'}\nStatus: Officially Released (Free)\n\nDescription:\n${asset.description || ''}\n\nThank you for choosing Ayumi Asset Shop!\nThis local package of mesh links and/or procedural codes has been downloaded to your machine.\n`;
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const fileUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = `${sanitizedName}-vault-asset.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(fileUrl);
      }
    } catch (e) {
      console.error('Manual download trigger error:', e);
    }
  };

  // Asset checkout simulator
  const triggerSimulatedDownload = (specificAsset?: Asset) => {
    const assetRef = specificAsset || selectedAssetForView;
    if (!assetRef) return;

    if (downloadIntervalRef.current) {
      clearInterval(downloadIntervalRef.current);
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setIsDownloadComplete(false);

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          downloadIntervalRef.current = null;
          setTimeout(() => {
            setIsDownloading(false);
            setIsDownloadComplete(true);
            trackDownload(assetRef.id);
            downloadPhysicalFile(assetRef);
          }, 300);
          return 100;
        }
        return prev + 15; // Download speed multiplier
      });
    }, 120);

    downloadIntervalRef.current = interval;
  };

  // Filtered evaluation matrix
  const filteredAssets = assets
    .filter(asset => {
      const matchesSearch = 
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === 'All' || 
        asset.category.toLowerCase() === selectedCategory.toLowerCase();

      const matchesPrice = 
        priceFilter === 'All' || 
        (priceFilter === 'Free' && asset.price === 0) || 
        (priceFilter === 'Paid' && asset.price > 0);

      return matchesSearch && matchesCategory && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'Popular') {
        const popularityA = (a.clicks || 0) + (a.downloads || 0) * 2.5 + (a.favorites || 0) * 5;
        const popularityB = (b.clicks || 0) + (b.downloads || 0) * 2.5 + (b.favorites || 0) * 5;
        if (popularityB !== popularityA) {
          return popularityB - popularityA;
        }
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Decorative cyber grid backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.2px,transparent_1.2px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

      {/* PRIMARY HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="h-10 w-10 drop-shadow-md select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="vip-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFE066" />
                    <stop offset="35%" stopColor="#F5B041" />
                    <stop offset="70%" stopColor="#D4AC0D" />
                    <stop offset="100%" stopColor="#9A7D0A" />
                  </linearGradient>
                  <linearGradient id="vip-gold-light" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFF2B2" />
                    <stop offset="100%" stopColor="#D4AC0D" />
                  </linearGradient>
                  <linearGradient id="vip-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E74C3C" />
                    <stop offset="50%" stopColor="#C0392B" />
                    <stop offset="100%" stopColor="#7B241C" />
                  </linearGradient>
                </defs>

                {/* Red Ribbon badge backing */}
                <path d="M50 15 L82 38 L82 72 L50 90 L18 72 L18 38 Z" fill="url(#vip-ribbon)" stroke="#922B21" strokeWidth="2.5" />
                
                {/* Crown decoration */}
                <path d="M26 48 C38 52, 62 52, 74 48 L71 28 L59 40 L50 20 L41 40 L29 28 Z" fill="url(#vip-gold)" stroke="#7D6608" strokeWidth="1.5" />
                
                {/* Crown points tip circles */}
                <circle cx="29" cy="28" r="3" fill="url(#vip-gold-light)" stroke="#7D6608" strokeWidth="1" />
                <circle cx="41" cy="40" r="2.5" fill="url(#vip-gold-light)" stroke="#7D6608" strokeWidth="1" />
                <circle cx="50" cy="20" r="4.5" fill="url(#vip-gold-light)" stroke="#7D6608" strokeWidth="1" />
                <circle cx="59" cy="40" r="2.5" fill="url(#vip-gold-light)" stroke="#7D6608" strokeWidth="1" />
                <circle cx="71" cy="28" r="3" fill="url(#vip-gold-light)" stroke="#7D6608" strokeWidth="1" />
                
                {/* Crown center ruby crown jewel */}
                <polygon points="50,29 55,36 45,36" fill="#E74C3C" stroke="#7B241C" strokeWidth="1" />

                {/* VIP Text overlays drawing */}
                <g transform="translate(0, 8)" filter="drop-shadow(0px 1.5px 1.5px rgba(0, 0, 0, 0.45))">
                  {/* V */}
                  <path d="M25 50 L34 50 L39 68 L44 50 L52 50 L44 76 L34 76 Z" fill="url(#vip-gold-light)" stroke="#5D4037" strokeWidth="0.8" />
                  {/* I */}
                  <path d="M51 50 L58 50 L58 76 L51 76 Z" fill="url(#vip-gold-light)" stroke="#5D4037" strokeWidth="0.8" />
                  {/* P */}
                  <path d="M62 50 L75 50 C79 50, 81 52, 81 55 C81 58, 79 61, 75 61 L69 61 L69 76 L62 76 Z M69 53.5 L69 57.5 L74 57.5 C75 57.5, 75 53.5, 74 53.5 Z" fill="url(#vip-gold-light)" stroke="#5D4037" strokeWidth="0.8" />
                </g>
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 uppercase sm:inline block">Ayumi Asset Shop</span>
              <p className="text-[9px] text-indigo-650 tracking-wider font-mono uppercase font-semibold">Premium Creative Essentials</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Secondary public view toggle */}
            {adminToken && (
              <button
                onClick={() => setIsAdminModeActive(!isAdminModeActive)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.8 text-xs font-semibold cursor-pointer transition-all duration-200 border ${
                  isAdminModeActive 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-650 hover:bg-indigo-100/60' 
                    : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-50 hover:text-slate-900'
                }`}
                id="toggle-admin-mode"
              >
                <Settings className={`h-3.5 w-3.5 ${isAdminModeActive ? 'animate-spin' : ''}`} />
                {isAdminModeActive ? 'Portal: Public View' : 'Portal: Admin Dashboard'}
              </button>
            )}

            {/* Auth Buttons */}
            {adminToken ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Admin: <span className="font-semibold text-slate-800">{adminUser}</span>
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-105 text-red-650 hover:text-red-700 rounded-lg px-3.5 py-1.8 text-xs font-semibold border border-red-200 transition-all cursor-pointer"
                  id="admin-logout-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-slate-200"
                id="admin-login-btn"
              >
                <LogIn className="h-3.5 w-3.5" />
                Admin Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT WRAPPER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10" id="main-content-area">
        
        <AnimatePresence mode="wait">
          {isAdminModeActive && adminToken ? (
            
            // ADMIN HUB
            <motion.div
              key="admin-workspace"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm rounded-2xl p-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Admin Catalog Hub</h1>
                  <p className="text-xs text-slate-500">Modify items, prices, cover snapshots, and categorical classifications</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-600 py-1.5 px-3 bg-indigo-50 rounded border border-indigo-100">
                    Mode: SECURE AUTHORIZED SESSION
                  </span>
                </div>
              </div>

              <AdminDashboard
                assets={assets}
                token={adminToken}
                onAssetCreated={handleAssetCreated}
                onAssetUpdated={handleAssetUpdated}
                onAssetDeleted={handleAssetDeleted}
              />
            </motion.div>

          ) : (

            // GUEST OR PUBLIC VIEW
            <motion.div
              key="public-marketplace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >

              {/* SEARCH & SYSTEM MULTI-FILTERS BAR */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex flex-col md:flex-row items-center gap-4">
                
                {/* Search query field */}
                <div className="relative w-full md:flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search UI Kits, icons, shaders, packages..."
                    className="w-full rounded-lg border border-slate-250 bg-slate-50 py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                    id="search-input-field"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-900 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filters layout */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  {/* Price range triggers */}
                  <div className="flex border border-slate-200 p-1 rounded-lg bg-slate-50">
                    {(["All", "Free", "Paid"] as const).map(pType => (
                      <button
                        key={pType}
                        onClick={() => setPriceFilter(pType)}
                        className={`px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          priceFilter === pType 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        id={`price-filter-${pType}`}
                      >
                        {pType}
                      </button>
                    ))}
                  </div>

                  {/* Dynamic Sorting Selection */}
                  <div className="flex border border-slate-200 p-1 rounded-lg bg-slate-50">
                    {(["Newest", "Popular"] as const).map(sortType => (
                      <button
                        key={sortType}
                        onClick={() => setSortBy(sortType)}
                        className={`px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          sortBy === sortType 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                        id={`sort-filter-${sortType}`}
                      >
                        {sortType === 'Newest' ? '🆕 New' : '🔥 Popular'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CATEGORICAL HORIZONTAL CHIP LIST */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                <span className="text-slate-500 text-xs shrink-0 flex items-center gap-1 pr-2 uppercase font-mono tracking-wider">
                  <Filter className="h-3 w-3 text-indigo-505" /> Categories:
                </span>
                {CATEGORIES.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer transition-all shrink-0 border ${
                      selectedCategory === category
                        ? 'bg-indigo-50 border-indigo-250 text-indigo-700 shadow-sm'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-805'
                    }`}
                    id={`cat-chip-${category.replace(' ', '')}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* GRAPHICAL RESULTS AREA */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-505 mb-3" />
                  <p className="text-sm">Connecting to Ayumi Cloud Vault...</p>
                </div>
              ) : fetchError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center max-w-lg mx-auto">
                  <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-rose-650">Vault Access Failure</p>
                  <p className="text-xs text-slate-500 mt-1">{fetchError}</p>
                  <button
                    onClick={fetchAssets}
                    className="mt-4 rounded-lg bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs text-white"
                  >
                    Attempt Reconnection
                  </button>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-semibold">No digital assets matched filters</p>
                  <p className="text-xs text-slate-400 mt-1 font-medium">Try expanding search query parameters or changing categories.</p>
                  {(searchQuery || selectedCategory !== 'All' || priceFilter !== 'All') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setPriceFilter('All');
                      }}
                      className="mt-4 text-xs font-bold text-indigo-600 underline hover:text-indigo-805 cursor-pointer"
                    >
                      Reset active queries
                    </button>
                  )}
                </div>
              ) : (
                <motion.div 
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  <AnimatePresence>
                    {filteredAssets.map(asset => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        isAdmin={false} // Managed from Header / Dashboard view
                        isFavorited={favoritedIds.includes(asset.id)}
                        onToggleFavorite={handleToggleFavorite}
                        onViewDetails={(a) => {
                          setSelectedAssetForView(a);
                          trackClick(a.id);
                          setIsDownloading(false);
                          setIsDownloadComplete(false);
                          setDownloadProgress(0);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* FOOTER DIVISION */}
      <footer className="mt-auto border-t border-slate-200 bg-white/60 py-10 relative z-10 animate-fade-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 font-mono tracking-tight font-semibold">
              © {new Date().getFullYear()} AYUMI ASSET SHOP. ALL INTELLECTUAL ASSETS SECURED.
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Powered by Node.js, Express server, and localized persistence. Beautifully rendered in White theme.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-help">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
              Store FAQ
            </span>
            <span className="text-slate-200">|</span>
            <span className="font-semibold text-slate-500">Status: Vault Operational</span>
          </div>
        </div>
      </footer>

      {/* ADMIN LOGIN DIALOG */}
      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* GUEST ASSET EXPLORATION MODAL WINDOW */}
      <AnimatePresence>
        {selectedAssetForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            {/* Content Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10"
              id="asset-detail-dialog"
            >
              {/* Image Frame */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                <img
                  src={selectedAssetForView.imageUrl}
                  alt={selectedAssetForView.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent p-3.5 flex justify-between items-end">
                  <span className="rounded bg-indigo-600 text-white font-semibold text-[10px] tracking-wide uppercase px-2 py-0.5">
                    {selectedAssetForView.category}
                  </span>
                  
                  {/* Pricing Badge */}
                  <span className="font-mono text-sm font-bold text-white bg-slate-950/75 backdrop-blur-sm px-2.5 py-1 rounded-md border border-slate-850">
                    {selectedAssetForView.price === 0 ? 'FREE' : `${selectedAssetForView.price} Robux`}
                  </span>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="absolute top-3 right-3 rounded-full bg-slate-950/75 p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer hover:scale-105"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Information body */}
              <div className="mt-4 space-y-3.5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    {selectedAssetForView.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {selectedAssetForView.tags?.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-405 font-mono ml-auto flex items-center gap-2">
                      <span>👁️ {selectedAssetForView.clicks || 0} v</span>
                      <span>📥 {selectedAssetForView.downloads || 0} d</span>
                      <span className="text-amber-500 font-semibold">⭐ {selectedAssetForView.favorites || 0} f</span>
                      <span className="text-slate-300">|</span>
                      <span>ID: {selectedAssetForView.id}</span>
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Product Specs & Description</h4>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed font-sans whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {selectedAssetForView.description}
                  </p>
                </div>

                {/* Progress elements or dynamic checkout elements */}
                <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Instant package package delivery
                    </span>
                    <span className="font-mono text-indigo-650 font-bold">Ayumi Approved</span>
                  </div>

                  <div className="w-full animate-fade-in pt-0.5">
                    {isDownloading ? (
                      <div className="w-full bg-slate-50 rounded-lg border border-slate-205 p-2.5">
                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                          <span>Downloading package...</span>
                          <span className="font-mono">{downloadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all duration-150" 
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : isDownloadComplete ? (
                      <div className="flex flex-col gap-2 w-full animate-fade-in">
                        <div className="w-full inline-flex items-center justify-center gap-2 bg-emerald-55 border border-emerald-150 text-emerald-650 rounded-xl py-3.5 text-xs font-bold shadow-sm shadow-emerald-50">
                          <Check className="h-4 w-4" />
                          Download Succeeded!
                        </div>
                        <div className="text-center bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-[11px] text-slate-500">
                          <p>If your device download did not trigger automatically:</p>
                          <button
                            type="button"
                            onClick={() => downloadPhysicalFile(selectedAssetForView)}
                            className="mt-1.5 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-750 underline cursor-pointer"
                          >
                            <Download className="h-3 w-3" />
                            Force Manual Download
                          </button>
                        </div>
                      </div>
                    ) : selectedAssetForView.price === 0 ? (
                      <button
                        onClick={triggerSimulatedDownload}
                        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-850 py-3 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-100 relative overflow-hidden active:scale-[0.98]"
                        id="modal-checkout-btn"
                      >
                        <Download className="h-4 w-4" />
                        Download Free Asset
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    ) : selectedAssetForView.purchaseLink ? (
                      <a
                        href={selectedAssetForView.purchaseLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-650 py-3.5 rounded-xl text-xs font-extrabold text-white transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-lg shadow-amber-500/15 border border-amber-400/20"
                        id="modal-checkout-link"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Purchase on Gamepass ({selectedAssetForView.price} Robux)
                        <ExternalLink className="h-3 w-3 opacity-80" />
                      </a>
                    ) : (
                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-400 border border-slate-205 py-3.5 rounded-xl text-xs font-bold cursor-not-allowed"
                        id="modal-checkout-disabled"
                      >
                        No Gamepass URL set ({selectedAssetForView.price} Robux)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
