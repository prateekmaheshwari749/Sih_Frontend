import React from 'react';
import ModelComparisonPage from './ModelComparisonPage';

/**
 * Dedicated Embedding Page
 * Direct access to the Multi-Category Ocean AI Embedding Explorer
 * (466 neural representation vectors across 5 ocean domains, PCA/t-SNE/UMAP projections & live sync).
 */
export default function EmbeddingPage() {
  return <ModelComparisonPage defaultTab="embedding" />;
}
