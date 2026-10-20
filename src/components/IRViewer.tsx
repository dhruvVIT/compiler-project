import type { IRInstruction } from '../ir/irTypes';
import { IRCodeList } from './IRCodeList';

interface IRViewerProps {
  instructions: IRInstruction[];
  astError: string | null;
  semanticErrorCount: number;
}

export function IRViewer({ instructions, astError, semanticErrorCount }: IRViewerProps) {
  if (astError !== null) {
    return (
      <div className="errors">
        <strong>Cannot generate IR.</strong>
        <p>The code must build an AST first. {astError}</p>
      </div>
    );
  }

  if (instructions.length === 0) {
    return <p className="empty-note">No IR generated.</p>;
  }

  return (
    <div className="ir-view">
      <h3>Three-Address Code</h3>

      {semanticErrorCount > 0 && (
        <p className="ir-warning">
          Semantic analysis reported {semanticErrorCount} error
          {semanticErrorCount === 1 ? '' : 's'}. The IR below was still generated from the AST.
        </p>
      )}

      <IRCodeList instructions={instructions} />

      <p className="ir-note">
        {instructions.length} instructions. Temporaries are named t1, t2, ... and labels L1, L2, ...
        No optimization has been applied.
      </p>
    </div>
  );
}
