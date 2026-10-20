import type { IRInstruction } from '../ir/irTypes';
import { formatInstruction, isLabel, isJump } from '../ir/irTypes';

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
