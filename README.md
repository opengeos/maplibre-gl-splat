# maplibre-gl-splat

A MapLibre GL JS plugin for visualizing 3D Gaussian Splats on maps.

[![npm version](https://badge.fury.io/js/maplibre-gl-splat.svg)](https://badge.fury.io/js/maplibre-gl-splat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🌐 **Georeferenced** - Place Gaussian splats at real-world coordinates
- 📁 **Multi-Format** - Supports `.splat`, `.ply`, `.spz`, `.ksplat`, and `.sog` file formats
- ⚡ **Fast Rendering** - Uses THREE.js and spark.js for efficient WebGL rendering
- 🎛️ **Interactive Control** - Built-in GUI for loading and managing splats
- ⚛️ **React Support** - First-class React components and hooks

## Installation

```bash
npm install maplibre-gl-splat
```

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import maplibregl from 'maplibre-gl';
import { GaussianSplatControl } from 'maplibre-gl-splat';
import 'maplibre-gl-splat/style.css';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  center: [0, 0],
  zoom: 2,
  pitch: 60,
  maxPitch: 85,
  antialias: true,
});

// Add Gaussian Splat control
const splatControl = new GaussianSplatControl({
  collapsed: false,
  defaultUrl: 'https://example.com/scene.splat',
  loadDefaultUrl: true,
});

map.addControl(splatControl, 'top-right');

// Listen for events
splatControl.on('splatload', (event) => {
  console.log('Splat loaded:', event.url);
});
```

### React

```tsx
import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { GaussianSplatControlReact } from 'maplibre-gl-splat/react';
import 'maplibre-gl-splat/style.css';

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [0, 0],
      zoom: 2,
      pitch: 60,
      maxPitch: 85,
      antialias: true,
    });

    mapInstance.on('load', () => setMap(mapInstance));
    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {map && (
        <GaussianSplatControlReact
          map={map}
          position="top-right"
          defaultUrl="https://example.com/scene.splat"
          loadDefaultUrl
          onSplatLoad={(url, id) => console.log('Loaded:', url)}
        />
      )}
    </div>
  );
}
```

## API Reference

### GaussianSplatControl

A control for loading and displaying Gaussian Splat 3D scenes on a MapLibre map.

#### Options

```typescript
interface GaussianSplatControlOptions {
  position?: ControlPosition;      // Control position (default: 'top-right')
  className?: string;              // Custom CSS class
  collapsed?: boolean;             // Start collapsed (default: true)
  title?: string;                  // Panel title (default: 'Gaussian Splats')
  panelWidth?: number;             // Panel width in px (default: 320)
  defaultUrl?: string;             // Default splat URL
  loadDefaultUrl?: boolean;        // Auto-load default URL (default: false)
  defaultOpacity?: number;         // Default opacity (default: 1)
  defaultRotation?: [x, y, z];     // Default rotation in degrees
  defaultScale?: number;           // Default scale (default: 1)
  defaultLongitude?: number;       // Default longitude
  defaultLatitude?: number;        // Default latitude
  defaultAltitude?: number;        // Default altitude (default: 0)
  flyTo?: boolean;                 // Fly to splat location (default: true)
  flyToZoom?: number;              // Zoom level when flying (default: 18)
}
```

#### Methods

```typescript
// Load a splat from URL
splatControl.loadSplat(url: string, options?: {
  longitude?: number;
  latitude?: number;
  altitude?: number;
  rotation?: [number, number, number];
  scale?: number;
}): Promise<string>  // Returns layer ID

// Remove a splat by ID
splatControl.removeSplat(layerId: string): void

// Remove all splats
splatControl.removeAllSplats(): void

// Get all splat layer IDs
splatControl.getSplatIds(): string[]

// Get info about a splat
splatControl.getSplatInfo(layerId: string): { url, longitude, latitude, altitude } | null

// Expand/collapse panel
splatControl.expand(): void
splatControl.collapse(): void
splatControl.toggle(): void

// Get current state
splatControl.getState(): GaussianSplatControlState

// Event handling
splatControl.on(event, handler): void
splatControl.off(event, handler): void
```

#### Events

- `splatload` - Fired when a splat is loaded
- `splatremove` - Fired when a splat is removed
- `error` - Fired when an error occurs
- `expand` - Fired when the panel is expanded
- `collapse` - Fired when the panel is collapsed

## Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| Splat | `.splat` | Standard Gaussian splat format |
| PLY | `.ply` | Point cloud format with splat data |
| SPZ | `.spz` | Compressed splat format from Niantic |
| KSplat | `.ksplat` | Format from GaussianSplats3D |
| SOG | `.sog` | PlayCanvas splat format |

## How It Works

This plugin uses:
- **[@dvt3d/maplibre-three-plugin](https://github.com/dvt3d/maplibre-three-plugin)** - Bridges MapLibre GL JS with Three.js
- **[@sparkjsdev/spark](https://github.com/sparkjsdev/spark)** - Advanced 3D Gaussian Splatting renderer for Three.js

The splats are rendered using WebGL through Three.js and positioned in geographic coordinates using the maplibre-three-plugin's RTC (Relative To Center) coordinate system.

## Examples

See the [examples](./examples/) directory:

- **Basic Example** - Vanilla TypeScript usage
- **React Example** - React component usage

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build examples
npm run build:examples
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Credits

- [spark.js](https://sparkjs.dev/) - Gaussian splatting renderer
- [maplibre-three-plugin](https://github.com/dvt3d/maplibre-three-plugin) - MapLibre/Three.js bridge
- [MapLibre GL JS](https://maplibre.org/) - Open-source map SDK
