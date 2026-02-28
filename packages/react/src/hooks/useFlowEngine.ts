import { useEffect, useRef, useCallback } from 'react';
import { FlowEngine } from '@flowviz/core';
import type { NodeDefinition, EdgeDefinition, FlowConfig, FlowMode } from '@flowviz/core';

export interface UseFlowEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  width: number;
  height: number;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
  config?: FlowConfig;
}

export function useFlowEngine(options: UseFlowEngineOptions) {
  const { canvasRef, width, height, nodes, edges, config } = options;
  const engineRef = useRef<FlowEngine | null>(null);

  // Create / destroy engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new FlowEngine({
      canvas,
      width,
      height,
      nodes,
      edges,
      config: config ?? {},
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // Canvas ref is stable — only recreate engine if canvas element changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  // Sync nodes reactively
  useEffect(() => {
    engineRef.current?.setNodes(nodes);
  }, [nodes]);

  // Sync edges reactively
  useEffect(() => {
    engineRef.current?.setEdges(edges);
  }, [edges]);

  // Sync config reactively
  useEffect(() => {
    if (config) engineRef.current?.setConfig(config);
  }, [config]);

  // Resize
  useEffect(() => {
    engineRef.current?.resize(width, height);
  }, [width, height]);

  // ── Imperative methods ────────────────────────────────────────────────────
  const pause           = useCallback(() => engineRef.current?.pause(),  []);
  const resume          = useCallback(() => engineRef.current?.resume(), []);
  const setSpeed        = useCallback((v: number)               => engineRef.current?.setSpeed(v),                []);
  const setFlowMode     = useCallback((m: FlowMode)             => engineRef.current?.setFlowMode(m),            []);
  const trigger         = useCallback((edgeId: string)          => engineRef.current?.trigger(edgeId),           []);
  const addNode         = useCallback((n: NodeDefinition)       => engineRef.current?.addNode(n),                []);
  const removeNode      = useCallback((id: string)              => engineRef.current?.removeNode(id),            []);
  const addEdge         = useCallback((e: EdgeDefinition)       => engineRef.current?.addEdge(e),                []);
  const removeEdge      = useCallback((id: string)              => engineRef.current?.removeEdge(id),            []);
  const setParticleCount = useCallback((edgeId: string, n: number) => engineRef.current?.setParticleCount(edgeId, n), []);

  return {
    engineRef,
    pause,
    resume,
    setSpeed,
    setFlowMode,
    trigger,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    setParticleCount,
  };
}
