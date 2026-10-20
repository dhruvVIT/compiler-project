export interface IRInstruction {
  op: string;
  arg1?: string;
  arg2?: string;
  result?: string;
}

export function isLabel(instruction: IRInstruction): boolean {
  return instruction.op === 'label';
}

export function isJump(instruction: IRInstruction): boolean {
  return instruction.op === 'goto' || instruction.op === 'if';
}

export function formatInstruction(instruction: IRInstruction): string {
  const { op, arg1, arg2, result } = instruction;

  switch (op) {
    case 'label':
      return `${result}:`;
    case 'goto':
      return `goto ${result}`;
    case 'if':
      return `if ${arg1} goto ${result}`;
    case 'return':
      return `return ${arg1}`;
    case '=':
      return `${result} = ${arg1}`;
    case 'neg':
      return `${result} = -${arg1}`;
    case 'not':
      return `${result} = !${arg1}`;
    case 'pos':
      return `${result} = +${arg1}`;
    default:
      return `${result} = ${arg1} ${op} ${arg2}`;
  }
}
