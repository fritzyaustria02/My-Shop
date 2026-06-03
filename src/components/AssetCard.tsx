import { motion } from 'motion/react';
import { Star, Download, Edit, Trash2 } from 'lucide-react';
import { Asset } from '../types';

interface AssetCardProps {
  key?: string;
  asset: Asset;
  isAdmin: boolean;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onDelete?: (id: string) => void;
  onViewDetails?: (asset: Asset) => void;
}

export default function AssetCard({
  asset,
  isAdmin,
  isFavorited,
  onToggleFavorite,
  onEdit,
  onDelete,
  onViewDetails
}: AssetCardProps) {
  const isFree = asset.price === 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white hover:border-indigo-400/50 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 shadow-sm"
      id={`asset-card-${asset.id}`}
    >
      {/* Floating Star/Favorite Button (Top Right of image) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(asset.id);
        }}
        className={`absolute top-3 right-3 z-30 h-8 w-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all duration-300 cursor-pointer ${
          isFavorited 
            ? 'bg-amber-500/95 text-white border-amber-400 scale-105 hover:bg-amber-600' 
            : 'bg-white/85 text-slate-400 border border-slate-200 hover:text-amber-500 hover:bg-white'
        }`}
        title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
        id={`fav-btn-${asset.id}`}
      >
        <Star className={`h-4.5 w-4.5 ${isFavorited ? 'fill-current' : ''}`} />
      </button>

      {/* Asset Preview Frame */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100/70 flex items-center justify-center">
        <img
          src={asset.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800'}
          alt={asset.name}
          className="h-full w-full object-cover transform group-hover:scale-[1.02] transition-transform duration-500"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback for missing or broken images
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800';
          }}
        />
        {/* Subtle light vignette layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/10 via-transparent to-transparent opacity-40" />
      </div>

      {/* Body Metadata */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-bold tracking-wide uppercase text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded">
            {asset.category}
          </span>
          {asset.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="text-[9px] font-medium text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 line-clamp-1 transition-colors duration-205">
          {asset.name}
        </h3>
        
        <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed flex-1">
          {asset.description}
        </p>

        {/* Pricing & Call-to-actions */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">License Price</span>
            {isFree ? (
              <span className="font-mono text-sm font-bold text-emerald-600">FREE</span>
            ) : (
              <span className="font-mono text-sm font-bold text-slate-950 flex items-center gap-0.5">
                {asset.price} <span className="text-[10px] uppercase text-indigo-600 font-bold font-sans">Robux</span>
              </span>
            )}
            <span className="text-[9px] text-slate-400 font-mono mt-1 flex flex-wrap gap-x-1 items-center">
              <span>👁️ {asset.clicks || 0} v</span>
              <span>·</span>
              <span>📥 {asset.downloads || 0} d</span>
              <span>·</span>
              <span className="text-amber-500 font-semibold">⭐ {asset.favorites || 0} f</span>
            </span>
          </div>

          <div className="flex gap-1.5">
            {isAdmin ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit?.(asset)}
                  className="rounded bg-slate-50 border border-slate-250 p-1.5 text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 transition-colors cursor-pointer"
                  title="Edit Asset"
                  id={`edit-btn-${asset.id}`}
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(asset.id)}
                  className="rounded bg-slate-50 border border-slate-250 p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Delete Asset"
                  id={`delete-btn-${asset.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onViewDetails?.(asset)}
                className="inline-flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                id={`get-btn-${asset.id}`}
              >
                <Download className="h-3 w-3" />
                Get Asset
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
