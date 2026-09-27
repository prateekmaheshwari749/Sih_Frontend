import rawEmbeddings from './oceanFiveCategoryEmbeddings.json';

export type OceanEmbeddingCategoryKey =
  | 'all'
  | 'cyclone'
  | 'oceansubsurface'
  | 'seasonal'
  | 'mhw'
  | 'thermocline';

export interface OceanEmbeddingItem {
  id: string;
  category: string;
  categoryKey: 'cyclone' | 'oceansubsurface' | 'seasonal' | 'mhw' | 'thermocline';
  categoryLabel: string;
  folder_name: string;
  name: string;
  relative_path: string;
  file_count: number;
  extensions: Record<string, number>;
  files: string[];
  total_files_count: number;
  embedding_index: number;
  embedding_dim: number;
  x: number;
  y: number;
  norm: number;
  source: string;
  architecture?: string;
  role?: string;
  nature_text?: string;
  diagnostics?: string[];
  depths_m?: number[];
  evidence_text?: string;
}

export interface CategoryMeta {
  key: OceanEmbeddingCategoryKey;
  label: string;
  shortLabel: string;
  count: number;
  color: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  icon: string;
  description: string;
  sourcePath: string;
}

export const CATEGORY_DEFINITIONS: Record<
  Exclude<OceanEmbeddingCategoryKey, 'all'>,
  CategoryMeta
> = {
  cyclone: {
    key: 'cyclone',
    label: 'Cyclone Forecast Models',
    shortLabel: 'Cyclone',
    count: 63,
    color: '#f97316', // Orange
    accentBg: 'bg-orange-50',
    accentBorder: 'border-orange-200',
    accentText: 'text-orange-800',
    icon: 'Cyclone',
    description:
      'Track prediction, intensity classification, XGBoost favorability, ConvGRU & cross-attention spatial storm forecasting.',
    sourcePath: 'backend/models/Cyclon_models',
  },
  oceansubsurface: {
    key: 'oceansubsurface',
    label: 'Ocean Subsurface Temperature',
    shortLabel: 'Subsurface',
    count: 47,
    color: '#06b6d4', // Cyan
    accentBg: 'bg-cyan-50',
    accentBorder: 'border-cyan-200',
    accentText: 'text-cyan-800',
    icon: 'Layers',
    description:
      '3D CNNs (1st-4th gen), Swin Transformers, ConvGRU, GNN, and Autoencoder 0-1000m thermal reconstructions.',
    sourcePath: 'backend/models/Ocean_SubSurface',
  },
  seasonal: {
    key: 'seasonal',
    label: 'Seasonal Climate & Ocean',
    shortLabel: 'Seasonal',
    count: 307,
    color: '#10b981', // Emerald
    accentBg: 'bg-emerald-50',
    accentBorder: 'border-emerald-200',
    accentText: 'text-emerald-800',
    icon: 'Calendar',
    description:
      'Long-lead climate cycles, Indian Ocean Dipole, ENSO teleconnections, and multi-month seasonal projection runs.',
    sourcePath: 'backend/models/seasonal_ocean',
  },
  mhw: {
    key: 'mhw',
    label: 'Marine Heatwaves (MHW)',
    shortLabel: 'MHW (Heatwave)',
    count: 43,
    color: '#f43f5e', // Rose
    accentBg: 'bg-rose-50',
    accentBorder: 'border-rose-200',
    accentText: 'text-rose-800',
    icon: 'Flame',
    description:
      'Extreme thermal anomaly benchmarks: U-Net vs FNO vs Transformer, 85-95% threshold sensitivity & tracking.',
    sourcePath: 'backend/models/OHW_MODEL_COMPARISON',
  },
  thermocline: {
    key: 'thermocline',
    label: 'Thermocline Specialist Suite',
    shortLabel: 'Thermocline',
    count: 6,
    color: '#8b5cf6', // Purple
    accentBg: 'bg-purple-50',
    accentBorder: 'border-purple-200',
    accentText: 'text-purple-800',
    icon: 'Thermometer',
    description:
      'Specialist depth stratification suite: U-Net, ConvGRU, ConvLSTM, Transformer, TCN with D_TC and G_max gradient outputs.',
    sourcePath: 'backend/Thermocline_Nature_Embeddings',
  },
};

export const ALL_CATEGORY_META: CategoryMeta = {
  key: 'all',
  label: 'All 5 Ocean AI Categories',
  shortLabel: 'All Domains',
  count: 466,
  color: '#3b82f6',
  accentBg: 'bg-blue-50',
  accentBorder: 'border-blue-200',
  accentText: 'text-blue-800',
  icon: 'BrainCircuit',
  description:
    'Unified 384-dimensional embedding manifold spanning Cyclone, Subsurface, Seasonal, Marine Heatwaves, and Thermocline.',
  sourcePath: 'backend/models & Thermocline_Nature_Embeddings',
};

export const OCEAN_EMBEDDINGS_DATA: OceanEmbeddingItem[] =
  rawEmbeddings as unknown as OceanEmbeddingItem[];

export function getCategoryEmbeddings(
  key: OceanEmbeddingCategoryKey,
): OceanEmbeddingItem[] {
  if (key === 'all') {
    return OCEAN_EMBEDDINGS_DATA;
  }
  return OCEAN_EMBEDDINGS_DATA.filter((item) => item.categoryKey === key);
}

export function searchOceanEmbeddings(
  query: string,
  categoryKey: OceanEmbeddingCategoryKey = 'all',
): OceanEmbeddingItem[] {
  const base = getCategoryEmbeddings(categoryKey);
  const q = query.trim().toLowerCase();
  if (!q) return base;

  return base.filter((item) => {
    return (
      item.name.toLowerCase().includes(q) ||
      item.folder_name.toLowerCase().includes(q) ||
      item.relative_path.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q) ||
      (item.architecture && item.architecture.toLowerCase().includes(q)) ||
      (item.role && item.role.toLowerCase().includes(q)) ||
      (item.nature_text && item.nature_text.toLowerCase().includes(q)) ||
      item.files.some((f) => f.toLowerCase().includes(q))
    );
  });
}
