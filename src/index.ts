// Import styles
import './lib/styles/splat-control.css';

// Main entry point - Core exports
export { GaussianSplatControl } from './lib/core/GaussianSplatControl';

// Adapter export
export { GaussianSplatLayerAdapter } from './lib/adapters/GaussianSplatLayerAdapter';

// Type exports
export type {
  GaussianSplatControlOptions,
  GaussianSplatSampleDataset,
  GaussianSplatControlState,
  GaussianSplatEvent,
  GaussianSplatEventHandler,
  GaussianSplatAssetType,
  GaussianSplatLoadOptions,
  GaussianSplatAssetPlacement,
} from './lib/core/types';
