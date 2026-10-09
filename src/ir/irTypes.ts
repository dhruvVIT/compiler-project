/**
 * Types for the Intermediate Representation (Phase 4).
 *
 * The IR is Three-Address Code (TAC): a flat list of very small instructions
 * where one instruction does one operation on at most two operands and stores
 * the answer in one place.
 *
 *   t1 = a + b
 *   c  = t1
 *
 * Everything the generator produces is one of these objects, so the whole IR
 * is just an `IRInstruction[]`. There is no control-flow graph and no basic
 * blocks - jumps and labels are ordinary instructions in the same list.
 */

/**
 * One three-address instruction.
 *
 * `op` decides how the other three fields are read:
 *
 *   an operator ("+", "-", "<", "&&", ...)   result = arg1 op arg2
 *   "="                                      result = arg1          (a copy)
 *   "neg" / "not" / "pos"                    result = -arg1 / !arg1 / +arg1
 *   "label"                                  result:
 *   "goto"                                   goto result
 *   "if"                                     if arg1 goto result
 *   "return"                                 return arg1
 *
 * The unused fields are simply left out, e.g. a `goto` only has `result`.
 */
export interface IRInstruction {
  op: string;
  arg1?: string;
  arg2?: string;
  result?: string;
}

/** True for a label instruction, e.g. `L1:`. Used by the viewer to lay it out. */
export function isLabel(instruction: IRInstruction): boolean {
  return instruction.op === 'label';
}

/** True for `goto L1` and `if t1 goto L1` - the instructions that jump. */
export function isJump(instruction: IRInstruction): boolean {
  return instruction.op === 'goto' || instruction.op === 'if';
}

/**
 * Turns one instruction into the line of TAC a reader expects to see.
 *
 * This is the only place that knows how an instruction is written down, so the
 * generator never has to build strings and the viewer never has to decode
 * `op` itself.
 */
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
      // Any binary operator: + - * / % > < >= <= == != && ||
      return `${result} = ${arg1} ${op} ${arg2}`;
  }
}
