/**
 * Draws the AST as a real tree diagram using React Flow.
 *
 * THE IDEA
 * --------
 * Walk the AST once, recursively. For every ASTNode create one React Flow
 * node, and for every parent-child link create one edge.
 *
 * THE LAYOUT
 * ----------
 * Deciding where to put each box is three simple rules:
 *
 *   - the Y position is the depth of the node, so each level of the tree is
 *     one row further down;
 *   - leaves are placed left to right using a counter;
 *   - a parent is centred between its first and its last child.
 *
 * Children are positioned BEFORE their parent, so the parent always knows
 * where they ended up. That is the whole algorithm - no layout library.
 */

import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Position, MarkerType } from '@xyflow/react';
import type { Edge, Node, ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ASTNode } from '../ast/astTypes';

/** Size of one box and the spacing between boxes. */
const NODE_WIDTH = 150;
const X_GAP = 24; // horizontal space between two neighbouring boxes
const Y_GAP = 90; // vertical distance between two levels

/** Statements and structure get a blue box, values get a plain white box. */
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

/** Turns the AST into the nodes and edges that React Flow draws. */
function buildGraph(root: ASTNode): { nodes: Node[]; edges: Edge[]; rootX: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let nextLeafX = 0; // x position for the next leaf we meet

  /** Places one node and everything below it, and returns where it ended up. */
  function visit(astNode: ASTNode, depth: number): number {
    let x: number;

    if (astNode.children.length === 0) {
      // A leaf simply takes the next free slot on the row.
      x = nextLeafX;
      nextLeafX += NODE_WIDTH + X_GAP;
    } else {
      // Place the children first...
      const childXs = astNode.children.map((child) => visit(child, depth + 1));

      // ...draw an edge from this node down to each of them...
      for (const child of astNode.children) {
        edges.push({
          id: `${astNode.id}->${child.id}`,
          source: astNode.id,
          target: child.id,
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }

      // ...then sit in the middle of the first and the last child.
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
      // Edges leave the bottom of a box and arrive at the top of the next one.
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
  // Keep the React Flow instance so the "Fit View" button can use it.
  const [flow, setFlow] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  // Rebuild the diagram only when a new AST arrives.
  const graph = useMemo(() => (ast === null ? null : buildGraph(ast)), [ast]);

  // Whenever a new tree is drawn, move the view back to its root so the
  // diagram is never left scrolled off to the side.
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
