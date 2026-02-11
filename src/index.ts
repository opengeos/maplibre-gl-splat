// Import styles
import './lib/styles/splat-control.css';

// Main entry point - Core exports
export { GaussianSplatControl } from './lib/core/GaussianSplatControl';

// Adapter export
export { GaussianSplatLayerAdapter } from './lib/adapters/GaussianSplatLayerAdapter';

// Type exports
export type {
  GaussianSplatControlOptions,
  GaussianSplatControlState,
  GaussianSplatEvent,
  GaussianSplatEventHandler,
} from './lib/core/types';
