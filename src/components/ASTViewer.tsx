import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Position, MarkerType } from '@xyflow/react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../ast/astTypes';

const NODE_WIDTH = 150;
const X_GAP = 24;
const Y_GAP = 90;

const BRANCH_STYLE = {
  width: NODE_WIDTH,
  padding: 6,
  border: '1px solid #1a4b8c',
  borderRadius: 3,
  background: '#eaf1fb',
  color: '#1a4b8c',
  fontSize: 12,
  fontWeight: 'bold' as const,
};

const LEAF_STYLE = {
  width: NODE_WIDTH,
  padding: 6,
  border: '1px solid #bbb',
  borderRadius: 3,
  background: '#fff',
  color: '#333',
  fontSize: 12,
};

function buildGraph(root: ASTNode): { nodes: Node[]; edges: Edge[]; rootX: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let nextLeafX = 0;

  function visit(astNode: ASTNode, depth: number): number {
    let x: number;

    if (astNode.children.length === 0) {
      x = nextLeafX;
      nextLeafX += NODE_WIDTH + X_GAP;
    } else {
      const childXs = astNode.children.map((child) => visit(child, depth + 1));

      for (const child of astNode.children) {
        edges.push({
          id: `${astNode.id}->${child.id}`,
          source: astNode.id,
          target: child.id,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }

      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }

    const isLeaf = astNode.children.length === 0;

    nodes.push({
      id: astNode.id,
      position: { x, y: depth * Y_GAP },
      data: {
        label: (
          <div>
            <div>{astNode.type}</div>
            {astNode.value !== undefined && <div className="ast-node-value">{astNode.value}</div>}
          </div>
        ),
      },
      style: isLeaf ? LEAF_STYLE : BRANCH_STYLE,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    return x;
  }

  const rootX = visit(root, 0);
  return { nodes, edges, rootX };
}

interface ASTViewerProps {
  ast: ASTNode | null;
  error: string | null;
}

export function ASTViewer({ ast, error }: ASTViewerProps) {
  const [flow, setFlow] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  const graph = useMemo(() => (ast === null ? null : buildGraph(ast)), [ast]);

  useEffect(() => {
    if (flow !== null && graph !== null) {
      flow.setCenter(graph.rootX + NODE_WIDTH / 2, 150, { zoom: 0.75 });
    }
  }, [flow, graph]);

  if (error !== null) {
    return (
      <div className="errors">
        <strong>Unable to build AST.</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (graph === null) {
    return <p className="empty-note">No AST generated yet.</p>;
  }

  return (
    <div className="ast-view">
      <div className="ast-toolbar">
        <button
          type="button"
          className="fit-view-btn"
          onClick={() => flow?.fitView({ padding: 0.1 })}
        >
          Fit View
        </button>
        <span className="count">{graph.nodes.length} nodes</span>
      </div>

      <div className="ast-canvas">
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          onInit={setFlow}
          minZoom={0.05}
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
