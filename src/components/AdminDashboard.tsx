import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Save, RotateCcw, AlertCircle, ShoppingBag, 
  Trash2, Edit, Upload, Image as ImageIcon, CheckCircle, Tag as TagIcon, X,
  FileUp, Paperclip, BarChart3, MousePointerClick, Download, TrendingUp
} from 'lucide-react';
import { Asset } from '../types';

interface AdminDashboardProps {
  assets: Asset[];
  token: string;
  onAssetCreated: (asset: Asset) => void;
  onAssetUpdated: (asset: Asset) => void;
  onAssetDeleted: (id: string) => void;
}

const CATEGORIES = ["3D Assets", "UI Kits", "Icons", "Audio", "Shaders", "Materials", "Templates"];

export default function AdminDashboard({
  assets,
  token,
  onAssetCreated,
  onAssetUpdated,
  onAssetDeleted
}: AdminDashboardProps) {
  // Editing state: if we have an asset here, we are in "Edit Mode", otherwise "Create Mode"
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [purchaseLink, setPurchaseLink] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // UI state feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const packageFileInputRef = useRef<HTMLInputElement>(null);

  // Load an asset into the form for editing
  const handleStartEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setDescription(asset.description);
    setPrice(asset.price);
    setPurchaseLink(asset.purchaseLink || '');
    setDownloadUrl(asset.downloadUrl || '');
    setDownloadFileName(asset.downloadFileName || '');
    setImageUrl(asset.imageUrl);
    setImagePreview(asset.imageUrl);
    setCategory(asset.category);
    setTags(asset.tags || []);
    setTagInput('');
    setError(null);
    setSuccessMsg(null);
    
    // Smooth scroll to form on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset core form items
  const handleResetForm = () => {
    setEditingAsset(null);
    setName('');
    setDescription('');
    setPrice('');
    setPurchaseLink('');
    setDownloadUrl('');
    setDownloadFileName('');
    setImageUrl('');
    setImagePreview(null);
    setCategory(CATEGORIES[0]);
    setTags([]);
    setTagInput('');
    setError(null);
    setSuccessMsg(null);
  };

  // Helper to dynamically downscale and compress local uploads using HTML5 Canvas
  // This maintains extremely small image storage sizes (<100KB) to prevent exceeding Firestore's 1MB document limit.
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Compress output to JPEG at 0.65 quality (excellent clarity at 10% footprint)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve(dataUrl);
        };
        img.onerror = () => {
          reject(new Error('Unsupported or corrupted image file format.'));
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read the local image.'));
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle local image uploads via FileReader with auto-compression
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Limit original image file to 10MB to prevent browser tab freeze during load/render
    if (file.size > 10 * 1024 * 1024) {
      setError('Selected image is too large. Please select an image under 10MB.');
      return;
    }

    try {
      setError(null);
      setSuccessMsg('Optimizing image for database storage...');
      const compressedUrl = await compressImageFile(file);
      setImageUrl(compressedUrl);
      setImagePreview(compressedUrl);
      setSuccessMsg('Image optimized and loaded successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to compress image.');
      setSuccessMsg(null);
    }
  };

  // Handle local generic files (e.g. models, shaders, scripts)
  const handlePackageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict size limit: 650KB limit to keep entire Firestore document structure under 1MB
    if (file.size > 650 * 1024) {
      setError('Direct file upload halted: Direct file storage is limited to 650KB due to database space constraints. For larger assets, please specify an external direct download link (e.g., Google Drive, Dropbox, GitHub) in the url input above instead of uploading directly.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDownloadUrl(reader.result);
        setDownloadFileName(file.name);
        setError(null);
        setSuccessMsg(`Asset pack file "${file.name}" uploaded successfully!`);
      }
    };
    reader.onerror = () => {
      setError('Failed reading the local asset file package.');
    };
    reader.readAsDataURL(file);
  };

  // Handle Tag Management
  const handleAddTag = () => {
    const cleanTag = tagInput.trim().replace(/,/g, '');
    if (!cleanTag) return;
    if (tags.includes(cleanTag)) {
      setTagInput('');
      return;
    }
    setTags([...tags, cleanTag]);
    setTagInput('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit asset handling
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Asset name is required.');
      return;
    }
    if (price === '') {
      setError('Asset pricing is required. Put 0 for free assets.');
      return;
    }
    if (!imageUrl) {
      setError('Please select a local image file or provide an external image link.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const assetPayload = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      purchaseLink: Number(price) > 0 ? purchaseLink.trim() : '',
      downloadUrl: Number(price) === 0 ? downloadUrl.trim() : '',
      downloadFileName: Number(price) === 0 ? downloadFileName.trim() : '',
      imageUrl,
      category,
      tags
    };

    try {
      const url = editingAsset ? `/api/assets/${editingAsset.id}` : '/api/assets';
      const method = editingAsset ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(assetPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server rejected administrative asset payload.');
      }

      if (editingAsset) {
        onAssetUpdated(data);
        setSuccessMsg(`Asset "${name}" updated successfully!`);
      } else {
        onAssetCreated(data);
        setSuccessMsg(`Asset "${name}" added to marketplace catalog!`);
      }

      handleResetForm();
    } catch (err: any) {
      setError(err.message || 'An error occurred operating the asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, assetName: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      // Reset after 3.5 seconds
      setTimeout(() => {
        setDeleteConfirmId(prev => prev === id ? null : prev);
      }, 3500);
      return;
    }

    setDeleteConfirmId(null);
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove asset.');
      }

      onAssetDeleted(id);
      setSuccessMsg(`Asset "${assetName}" removed from catalog!`);
      if (editingAsset?.id === id) {
        handleResetForm();
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred expunging asset.');
    }
  };

  // Analytics calculations
  const totalClicks = assets.reduce((sum, a) => sum + (a.clicks || 0), 0);
  const totalDownloads = assets.reduce((sum, a) => sum + (a.downloads || 0), 0);
  const totalFreeAssets = assets.filter(a => a.price === 0).length;
  const totalPaidAssets = assets.filter(a => a.price > 0).length;

  const sortedPopular = [...assets].sort((a, b) => {
    const scoreA = (a.clicks || 0) + (a.downloads || 0) * 2.5 + (a.favorites || 0) * 5;
    const scoreB = (b.clicks || 0) + (b.downloads || 0) * 2.5 + (b.favorites || 0) * 5;
    return scoreB - scoreA;
  });
  const topAsset = sortedPopular[0] || null;

  return (
    <div className="space-y-8" id="admin-hub-dashboard">
      
      {/* 4-COL ANALYTICS HEADER SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="col-span-1 md:col-span-4 border-b border-slate-100 pb-3 mb-1 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Live Marketplace Performance Analytics
          </h3>
          <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-semibold animate-pulse">
            ● Metrics Streaming Live
          </span>
        </div>

        {/* Card 1: Clicks */}
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <MousePointerClick className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Asset Click-Views</span>
            <span className="block font-mono text-lg font-extrabold text-slate-800">{totalClicks}</span>
          </div>
        </div>

        {/* Card 2: Downloads */}
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Free Pack Downloads</span>
            <span className="block font-mono text-lg font-extrabold text-slate-800">{totalDownloads}</span>
          </div>
        </div>

        {/* Card 3: Free vs Paid ratio */}
        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-blue-50 border border-blue-102 flex items-center justify-center text-blue-600">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Catalog Inventory</span>
            <span className="block font-mono text-lg font-extrabold text-slate-800">
              {assets.length} <span className="text-[10px] text-slate-400 font-sans font-medium">({totalFreeAssets} Free / {totalPaidAssets} Paid)</span>
            </span>
          </div>
        </div>

        {/* Card 4: Top product */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700">Most Popular Asset</span>
            <span className="block font-semibold text-xs text-amber-900 truncate" title={topAsset?.name || 'None'}>
              {topAsset ? topAsset.name : 'No items yet'}
            </span>
            {topAsset && (
              <span className="block text-[9px] font-mono text-amber-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {topAsset.clicks || 0}v · {topAsset.downloads || 0}d · {topAsset.favorites || 0}⭐
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LEFT: Creator/Editor Panel */}
      <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 h-fit sticky top-24">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
              {editingAsset ? 'Edit Catalogue Entry' : 'Publish New Asset'}
            </h2>
            <p className="text-xs text-slate-400">
              {editingAsset ? `Currently updating: id:${editingAsset.id}` : 'List a digital asset on the marketplace'}
            </p>
          </div>
          
          {editingAsset && (
            <button
              onClick={handleResetForm}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors py-1 px-2 rounded hover:bg-slate-50 cursor-pointer font-bold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Cancel Edit
            </button>
          )}
        </div>

        {/* Global Feedback Notifications */}
        <AnimatePresence mode="popLayout">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-600"
            >
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs text-emerald-600"
            >
              <CheckCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Catalog Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Asset Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ultra Realistic Water Material Pack"
              className="w-full rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              id="asset-form-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Asset Price (Robux)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10)))}
                placeholder="0 for Free"
                className="w-full rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                id="asset-form-price"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Asset Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                id="asset-form-category"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence>
            {price !== '' && Number(price) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Robux Purchase / Roblox Gamepass Link
                </label>
                <input
                  type="url"
                  required
                  value={purchaseLink}
                  onChange={(e) => setPurchaseLink(e.target.value)}
                  placeholder="https://www.roblox.com/game-pass/..."
                  className="w-full rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  id="asset-form-purchaselink"
                />
                <p className="text-[10px] text-indigo-650 mt-1 font-medium">Since you added a price, guests who click "Get Asset" will be redirected to this gamepass website.</p>
              </motion.div>
            )}

            {price !== '' && Number(price) === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Free Asset Source Package
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Input URL or Upload File</span>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={downloadUrl.startsWith('data:') ? '' : downloadUrl}
                      onChange={(e) => {
                        setDownloadUrl(e.target.value);
                        setDownloadFileName('');
                      }}
                      disabled={downloadUrl.startsWith('data:')}
                      placeholder={downloadUrl.startsWith('data:') ? "Using uploaded local file package" : "External direct file link https://..."}
                      className="flex-1 rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      id="asset-form-downloadurl"
                    />
                    <button
                      type="button"
                      onClick={() => packageFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-205 cursor-pointer shadow-sm animate-fade-in"
                      id="asset-form-package-trigger"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-emerald-600" />
                      Browse
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={packageFileInputRef}
                    onChange={handlePackageUpload}
                    className="hidden"
                  />

                  {downloadFileName && (
                    <div className="flex items-center justify-between bg-emerald-50 border border-emerald-150 rounded-lg p-2.5 text-xs text-emerald-800 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="truncate font-semibold">{downloadFileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDownloadUrl('');
                          setDownloadFileName('');
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Remove uploaded file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-emerald-600 font-medium font-sans">Guests who download this free item will safely download this uploaded package or receive the external link.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Product Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide clean markdown or a high-level summary of what this asset contains..."
              className="w-full rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors resize-none mb-1"
              id="asset-form-description"
            />
          </div>

          {/* Image Upload Block */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Asset Display Capture (Local Upload or URL)
            </label>
            
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value);
                }}
                placeholder="External image URL https://..."
                className="flex-1 rounded-lg border border-slate-205 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                id="asset-form-url"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-205 cursor-pointer shadow-sm"
                id="asset-form-upload-trigger"
              >
                <Upload className="h-3.5 w-3.5 text-indigo-600" />
                Upload
              </button>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Live image preview framework */}
            {imagePreview && (
              <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50 aspect-video flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Live cover preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 rounded-full p-1 bg-black/60 text-white hover:bg-rose-600 transition-colors shadowCursor cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Asset Badges & Tags
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <TagIcon className="h-3.5 w-3.5" />
                </span>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Type tag and press Enter"
                  className="w-full rounded-lg border border-slate-205 bg-slate-50 py-2 pl-9 pr-3.5 text-xs text-slate-800 placeholder-slate-450 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                  id="asset-form-taginput"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* List of tag chips */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {tags.map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700 font-mono font-medium border border-indigo-100"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="text-indigo-400 hover:text-indigo-650 font-extrabold ml-1 cursor-pointer"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-750 hover:to-indigo-800 py-3 text-sm font-semibold text-white transition-all duration-200 cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-50"
            id="asset-form-submit"
          >
            {isSubmitting ? (
              'Synchronizing catalog...'
            ) : (
              <>
                <Save className="h-4 w-4" />
                {editingAsset ? 'Update Asset Details' : 'Publish Asset to Marketplace'}
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT: Assets Grid Manager */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-250 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600" />
              Live Marketplace Grid ({assets.length} Assets)
            </h2>
            <p className="text-xs text-slate-400">Click actions below to modify elements in real time</p>
          </div>
        </div>

        {/* Tight Admin Catalog List Table view */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {assets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No digital assets listed yet. Create one on the left to start!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Asset</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Performance Metrics</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                           <img
                            src={asset.imageUrl}
                            alt=""
                            className="h-10 w-16 object-cover rounded-lg border border-slate-205 bg-slate-50"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="font-semibold text-slate-800 max-w-[150px] md:max-w-[220px] truncate overflow-hidden">
                              {asset.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">id: {asset.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="rounded bg-slate-100 text-slate-600 px-2 py-0.5 border border-slate-205 font-medium">
                          {asset.category}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-705">
                        {asset.price === 0 ? (
                          <span className="text-emerald-600 font-bold">FREE</span>
                        ) : (
                          `${asset.price} Robux`
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-[10px]">
                          <span className="text-slate-650 flex items-center gap-1">
                            👁️ <strong className="font-mono text-slate-800">{asset.clicks || 0}</strong> views
                          </span>
                          <span className="text-slate-500 flex items-center gap-1 font-mono">
                            📥 <strong>{asset.downloads || 0}</strong> free dls
                          </span>
                          <span className="text-amber-600 flex items-center gap-1 font-mono">
                            ⭐ <strong>{asset.favorites || 0}</strong> favorites
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-1.5 items-center">
                          <button
                            onClick={() => handleStartEdit(asset)}
                            className="rounded bg-indigo-50 hover:bg-slate-900 text-indigo-700 hover:text-white p-2 transition-all cursor-pointer"
                            title="Edit Asset"
                            id={`dash-edit-${asset.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id, asset.name)}
                            className={`rounded px-2.5 py-1.5 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                              deleteConfirmId === asset.id
                                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                : 'bg-rose-50 hover:bg-rose-600 text-rose-650 hover:text-white'
                            }`}
                            title={deleteConfirmId === asset.id ? "Click again to confirm delete" : "Delete Asset"}
                            id={`dash-delete-${asset.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deleteConfirmId === asset.id && <span>Sure?</span>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  </div>
  );
}
