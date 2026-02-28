# ⬡ @flowviz/core

**High-performance, headless 2D flow visualization engine — Pure Canvas2D.**

Animated particle flows over directed graphs — built for data-pipeline dashboards, cybersecurity visualizers, network topology tools, and any application that needs smooth, real-time flow aesthetics.

[![npm](https://img.shields.io/npm/v/@flowviz/core)](https://www.npmjs.com/package/@flowviz/core)
[![license](https://img.shields.io/npm/l/@flowviz/core)](https://github.com/hackelite01/flowviz/blob/main/LICENSE)

---

## Install

```bash
npm install @flowviz/core
```

## Quick Start — Vanilla JS / Canvas

```typescript
import { FlowEngine } from '@flowviz/core';
import type { NodeDefinition, EdgeDefinition, FlowConfig } from '@flowviz/core';

const canvas = document.getElementById('flow') as HTMLCanvasElement;

const nodes: NodeDefinition[] = [
  { id: 'a', label: 'Ingest',  layer: 0, shape: 'rect',
    color: '#060c1a', borderColor: '#3b82f6', glowColor: '#3b82f6', glowRadius: 8, size: 46 },
  { id: 'b', label: 'Process', layer: 1, shape: 'rect',
    color: '#060c1a', borderColor: '#22d3ee', glowColor: '#22d3ee', glowRadius: 8, size: 46 },
];

const edges: EdgeDefinition[] = [
  { from: 'a', to: 'b', color: '#3b82f6', width: 2 },
];

const config: FlowConfig = {
  autoLayout: true,
  flowSpeed: 0.6,
  particleDensity: 0.5,
  edgeStyle: 'bezier',
  background: '#060c1a',
};

const engine = new FlowEngine(canvas, nodes, edges, config);
engine.start();
```

## Features

- **Zero dependencies** — pure Canvas2D rendering, no WebGL/Three.js
- **Framework-agnostic** — works with React, Vue, Svelte, or vanilla JS
- **Auto-layout** — force-directed + layered DAG layout out of the box
- **Particle system** — object-pooled, burst & trail animations
- **Edge styles** — bezier, straight, step, with tubes, glow, neon beams
- **Interactive** — click, hover, trigger/untrigger flow modes
- **Tree-shakeable** — ESM + CJS dual build, `sideEffects: false`
- **TypeScript-first** — full type definitions included

## React Wrapper

See [`@flowviz/react`](https://www.npmjs.com/package/@flowviz/react) for a drop-in React component.

## Documentation

Full API reference and examples: [GitHub README](https://github.com/hackelite01/flowviz#readme)

## License

MIT © [mayankrajput](https://github.com/hackelite01)
