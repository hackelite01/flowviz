import React, {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import type { NodeDefinition, EdgeDefinition, FlowConfig, FlowMode } from '@flowviz/core';
import { useFlowEngine } from './hooks/useFlowEngine';

// ─── Public Imperative Handle ─────────────────────────────────────────────────

export interface FlowVizHandle {
  pause():                                      void;
  resume():                                     void;
  setSpeed(multiplier: number):                 void;
  setFlowMode(mode: FlowMode):                  void;
  /** Activate an edge in manual flow mode */
  trigger(edgeId: string):                      void;
  setParticleCount(edgeId: string, n: number):  void;
  addNode(node: NodeDefinition):                void;
  removeNode(id: string):                      void;
  addEdge(edge: EdgeDefinition):                void;
  removeEdge(id: string):                      void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FlowVizProps {
  nodes:      NodeDefinition[];
  edges:      EdgeDefinition[];
  /** FlowConfig (also accepts the FlowVizConfig alias) */
  config?:    FlowConfig;
  width?:     number | string;
  height?:    number | string;
  className?: string;
  style?:     React.CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────
//
// Pure-canvas React wrapper around FlowEngine.
// All rendering (nodes, edges, particles, labels) happens on <canvas>.
// InteractionSystem inside FlowEngine handles click/hover events directly on canvas.
// No SVG overlay. No polling. No React state sync for animation.

export const FlowViz = forwardRef<FlowVizHandle, FlowVizProps>(function FlowViz(
  { nodes, edges, config = {}, width = '100%', height = 500, className, style },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({
    w: 800,
    h: typeof height === 'number' ? height : 500,
  });

  // ── Measure container ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = (rawW: number, rawH: number) => {
      // Round to integer CSS pixels; ignore sub-2px changes (browser zoom glitches)
      const nw = Math.max(1, Math.round(rawW));
      const nh = Math.max(1, Math.round(rawH));
      setDims(prev =>
        Math.abs(prev.w - nw) < 2 && Math.abs(prev.h - nh) < 2
          ? prev
          : { w: nw, h: nh }
      );
    };

    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect;
      update(w || el.clientWidth, h || el.clientHeight);
    });
    ro.observe(el);
    update(
      el.clientWidth  || 800,
      el.clientHeight || (typeof height === 'number' ? height : 500)
    );
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Engine ────────────────────────────────────────────────────────────────
  const {
    pause,
    resume,
    setSpeed,
    setFlowMode,
    trigger,
    setParticleCount,
    addNode:    _addNode,
    removeNode: _removeNode,
    addEdge:    _addEdge,
    removeEdge: _removeEdge,
  } = useFlowEngine({
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    width:     dims.w,
    height:    dims.h,
    nodes,
    edges,
    config,
  });

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    pause,
    resume,
    setSpeed,
    setFlowMode,
    trigger,
    setParticleCount,
    addNode:    _addNode,
    removeNode: _removeNode,
    addEdge:    _addEdge,
    removeEdge: _removeEdge,
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={`flowviz-container${className ? ` ${className}` : ''}`}
      style={{ position: 'relative', width, height, overflow: 'hidden', ...style }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display:  'block',
          position: 'absolute',
          top:      0,
          left:     0,
          width:    '100%',
          height:   '100%',
        }}
      />
    </div>
  );
});

FlowViz.displayName = 'FlowViz';
