# ⬡ @flowviz/react

**React wrapper for the FlowViz flow visualization engine.**

Drop-in `<FlowViz />` component that renders animated particle flows over directed graphs using Canvas2D.

[![npm](https://img.shields.io/npm/v/@flowviz/react)](https://www.npmjs.com/package/@flowviz/react)
[![license](https://img.shields.io/npm/l/@flowviz/react)](https://github.com/hackelite01/flowviz/blob/main/LICENSE)

---

## Install

```bash
npm install @flowviz/react @flowviz/core
```

> `@flowviz/core` is a dependency and will be installed automatically, but you'll want it for the type imports.

## Quick Start

```tsx
import { FlowViz } from '@flowviz/react';
import type { NodeDefinition, EdgeDefinition, FlowConfig } from '@flowviz/core';

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

export default function App() {
  return (
    <FlowViz
      nodes={nodes}
      edges={edges}
      config={config}
      width={900}
      height={500}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `nodes` | `NodeDefinition[]` | Array of node objects |
| `edges` | `EdgeDefinition[]` | Array of edge objects |
| `config` | `FlowConfig` | Engine & render configuration |
| `width` | `number` | Canvas width in pixels |
| `height` | `number` | Canvas height in pixels |
| `className` | `string?` | CSS class for the canvas element |
| `style` | `CSSProperties?` | Inline styles for the canvas |

## Features

- **Declarative** — pass nodes/edges/config as props, the component handles the rest
- **Auto-cleanup** — engine is destroyed on unmount, no memory leaks
- **Reactive** — config/node/edge changes are picked up automatically
- **Lightweight** — thin wrapper around `@flowviz/core`, tree-shakeable

## Core Engine

See [`@flowviz/core`](https://www.npmjs.com/package/@flowviz/core) for the headless engine API, vanilla JS usage, and full type reference.

## Documentation

Full API reference and examples: [GitHub README](https://github.com/hackelite01/flowviz#readme)

## License

MIT © [mayankrajput](https://github.com/hackelite01)
