/**
 * One numbered listing of Three-Address Code.
 *
 * Both the IR stage and the Optimization stage show instructions this way, so
 * the markup lives here once instead of being repeated in each of them.
 *
 * Labels are pulled out to the left margin and jumps are tinted, which is
 * enough to make the control flow easy to follow without drawing a graph.
 */

import type { IRInstruction } from '../ir/irTypes';
import { formatInstruction, isLabel, isJump } from '../ir/irTypes';

/** Picks the CSS class for one line, so the JSX below stays readable. */
function lineClass(instruction: IRInstruction): string {
  if (isLabel(instruction)) {
    return 'ir-line ir-line-label';
  }
  if (isJump(instruction)) {
    return 'ir-line ir-line-jump';
  }
  return 'ir-line';
}

interface IRCodeListProps {
  instructions: IRInstruction[];
}

export function IRCodeList({ instructions }: IRCodeListProps) {
  if (instructions.length === 0) {
    return <p className="empty-note">(empty)</p>;
  }

  // An <ol> gives the line numbers through CSS, so they are not part of the
  // text and cannot be copied along with the code.
  return (
    <ol className="ir-code">
      {instructions.map((instruction, i) => (
        <li key={i} className={lineClass(instruction)}>
          {formatInstruction(instruction)}
        </li>
      ))}
    </ol>
  );
}
