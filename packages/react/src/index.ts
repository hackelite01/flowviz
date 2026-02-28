export { FlowViz } from './FlowViz';
export type { FlowVizProps, FlowVizHandle } from './FlowViz';
export { useFlowEngine } from './hooks/useFlowEngine';
export type { UseFlowEngineOptions } from './hooks/useFlowEngine';

// Re-export commonly-used types from core for consumer convenience
export type {
  NodeDefinition,
  EdgeDefinition,
  EdgeParticleConfig,
  FlowConfig,
  FlowVizConfig,     // backward-compat alias
  FlowMode,
  BackgroundConfig,
  AnimationConfig,
  RenderConfig,
  LayoutConfig,
  NodeShape,
  ParticleShape,
  Vec2,
  EngineEventType,
} from '@flowviz/core';
