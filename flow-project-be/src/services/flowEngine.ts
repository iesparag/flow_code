import { IFlow, INode } from '../models/Flow.js';
import { evaluateCondition } from '../utils/conditionEvaluator.js';

export type EngineState = Record<string, any>;

export function getNodeById(flow: IFlow, nodeId: string): INode | undefined {
  return flow.nodes.find(n => n.id === nodeId);
}

export function computeNextNode(flow: IFlow, currentNodeId: string, state: EngineState): { nextNodeId?: string; completed?: boolean } {
  const node = getNodeById(flow, currentNodeId);
  if (!node) throw new Error(`Node ${currentNodeId} not found`);
  if (node.type === 'end') return { completed: true };
  const edges = node.next || [];
  for (const edge of edges) {
    if (evaluateCondition(state, edge.when)) {
      const nextNode = getNodeById(flow, edge.to);
      if (!nextNode) throw new Error(`Next node ${edge.to} not found`);
      if (nextNode.type === 'end') return { completed: true };
      return { nextNodeId: nextNode.id };
    }
  }
  // default: if exactly one next without condition
  if (edges.length === 1 && !edges[0].when) {
    const nextNode = getNodeById(flow, edges[0].to);
    if (!nextNode) throw new Error(`Next node ${edges[0].to} not found`);
    if (nextNode.type === 'end') return { completed: true };
    return { nextNodeId: nextNode.id };
  }
  // no match → end
  return { completed: true };
}
