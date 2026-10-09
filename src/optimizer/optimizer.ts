/**
 * CompilerViz - Optimizer (Phase 5, the final phase)
 * --------------------------------------------------
 * Input : IRInstruction[]      (the Three-Address Code from Phase 4)
 * Output: OptimizationResult   (the original IR, the optimized IR, what fired)
 *
 *   IR -> optimizeIR(ir) -> optimized IR
 *
 * The optimizer works ONLY on the instruction list it is given. It never looks
 * at the AST, the tokens or the source, and it never regenerates the IR.
 *
 * THREE OPTIMIZATIONS
 * -------------------
 *   1. Constant propagation - replace a variable by the constant it holds
 *   2. Constant folding     - evaluate an operation on two constants
 *   3. Dead code elimination - drop an assignment nobody reads
 *
 * They run one after another, and the whole sequence repeats a few times
 * because each one exposes work for the others:
 *
 *   t1 = 20 * 3        folding      -> t1 = 60
 *   t2 = 10 + t1       propagation  -> t2 = 10 + 60   -> folding -> t2 = 70
 *   x  = t2            propagation  -> x = 70         -> t1/t2 now dead
 *
 * REPORTING
 * ---------
 * Every instruction carries the line number it had in the ORIGINAL listing.
 * A pass copies that number onto the instruction it rewrites, so a change made
 * in the third pass is still reported against the line the user can see in the
 * "Original IR" column.
 *
 * CORRECTNESS FIRST
 * -----------------
 * The IR contains labels and jumps, so an instruction is NOT always reached
 * from the one above it. Two deliberately conservative rules keep the
 * optimizer safe without any data-flow framework:
 *
 *   - Propagation forgets everything it knows when it reaches a label.
 *     A label is a jump target, so we cannot know which instructions ran just
 *     before it. In
 *
 *           if t1 goto L1
 *           goto L2
 *       L1: c = 1
 *           goto L3
 *       L2: c = 2
 *       L3: return c      <- c is 1 or 2, depending on the branch taken
 *
 *     what was learned inside a branch is forgotten at L3, so the value from
 *     one branch can never leak into the code after the if.
 *
 *   - Dead code elimination removes an assignment only when its variable is
 *     read NOWHERE in the program, instead of tracking where it is read. That
 *     is the simplest rule that cannot be fooled by a variable which is
 *     assigned inside one branch and read after the branches join again.
 *
 * Anything that cannot be decided safely is left exactly as it was.
 */

import type { IRInstruction } from '../ir/irTypes';
import { formatInstruction } from '../ir/irTypes';

/** One optimization that actually changed something. */
export interface AppliedOptimization {
  /** The name shown in the UI, e.g. "Constant Folding". */
  name: string;
  /** The lines it affected, numbered as in the ORIGINAL IR, lowest first. */
  lines: number[];
}

/** Everything the optimizer produces. */
export interface OptimizationResult {
  original: IRInstruction[];
  optimized: IRInstruction[];
  /** Only the optimizations that fired, in the order they are applied. */
  applied: AppliedOptimization[];
}

/** The names of the three optimizations, spelled as the UI shows them. */
const CONSTANT_PROPAGATION = 'Constant Propagation';
const CONSTANT_FOLDING = 'Constant Folding';
const DEAD_CODE_ELIMINATION = 'Dead Code Elimination';

/**
 * How many times the three optimizations are repeated.
 *
 * A fixed, small number - never a loop that runs until nothing changes - and
 * the repetition stops early anyway as soon as a round changes nothing.
 */
const MAX_PASSES = 4;

/**
 * One instruction together with the place it came from.
 *
 * `originalLine` never changes: when a pass rewrites the instruction, the new
 * one inherits the same number, which is what lets the UI point back at the
 * line the user can see.
 */
interface TrackedInstruction {
  instruction: IRInstruction;
  /** 1-based position in the original IR. */
  originalLine: number;
}

/** The original line numbers that each optimization has changed so far. */
interface ChangedLines {
  constantPropagation: Set<number>;
  constantFolding: Set<number>;
  deadCodeElimination: Set<number>;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Optimizes the IR and returns the original list, the optimized list and the
 * optimizations that fired. The input array is never modified.
 */
export function optimizeIR(instructions: IRInstruction[]): OptimizationResult {
  // Number the instructions 1, 2, 3, ... so that a change made in a later pass
  // can still be reported against the original listing.
  let current: TrackedInstruction[] = instructions.map((instruction, index) => ({
    instruction,
    originalLine: index + 1,
  }));

  const changed: ChangedLines = {
    constantPropagation: new Set(),
    constantFolding: new Set(),
    deadCodeElimination: new Set(),
  };

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = asText(current);

    current = constantPropagation(current, changed);
    current = constantFolding(current, changed);
    current = deadCodeElimination(current, changed);

    // Nothing moved in this round, so another round cannot help either.
    if (asText(current) === before) {
      break;
    }
  }

  return {
    original: instructions,
    optimized: current.map((tracked) => tracked.instruction),
    applied: summarize(changed),
  };
}

/**
 * Turns the collected line numbers into the list the UI shows, in the order the
 * optimizations run. An optimization that changed nothing is left out.
 */
function summarize(changed: ChangedLines): AppliedOptimization[] {
  const applied: AppliedOptimization[] = [];

  if (changed.constantPropagation.size > 0) {
    applied.push({ name: CONSTANT_PROPAGATION, lines: sortedLines(changed.constantPropagation) });
  }
  if (changed.constantFolding.size > 0) {
    applied.push({ name: CONSTANT_FOLDING, lines: sortedLines(changed.constantFolding) });
  }
  if (changed.deadCodeElimination.size > 0) {
    applied.push({
      name: DEAD_CODE_ELIMINATION,
      lines: sortedLines(changed.deadCodeElimination),
    });
  }

  return applied;
}

/** The line numbers in increasing order, which is how the UI lists them. */
function sortedLines(lines: Set<number>): number[] {
  return [...lines].sort((a, b) => a - b);
}

/** The whole list as one string, used to notice that a pass changed nothing. */
function asText(instructions: TrackedInstruction[]): string {
  return instructions.map((tracked) => formatInstruction(tracked.instruction)).join('\n');
}

/* ------------------------------------------------------------------ */
/* 1. Constant propagation                                             */
/* ------------------------------------------------------------------ */

/**
 * Remembers which variables currently hold a constant and rewrites later uses
 * of those variables to the constant itself.
 *
 *   a = 10          a = 10
 *   t1 = a + 5  ->  t1 = 10 + 5
 *
 * The operand of `return` is deliberately left alone, so the value the program
 * gives back keeps its name and the assignment that produces it stays in the
 * listing. Everything else (operations, copies and the condition of a branch)
 * has its operands replaced.
 */
function constantPropagation(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
  /** variable name -> the constant it is known to hold right here. */
  const constants = new Map<string, string>();
  const result: TrackedInstruction[] = [];

  for (const tracked of instructions) {
    const { instruction, originalLine } = tracked;

    // A label can be jumped to, so what we learned above it may not apply.
    if (instruction.op === 'label') {
      constants.clear();
      result.push(tracked);
      continue;
    }

    let current = tracked;

    if (instruction.op !== 'return') {
      const arg1 = substitute(instruction.arg1, constants);
      const arg2 = substitute(instruction.arg2, constants);

      if (arg1 !== instruction.arg1 || arg2 !== instruction.arg2) {
        const rewritten: IRInstruction = { ...instruction };
        if (arg1 !== undefined) rewritten.arg1 = arg1;
        if (arg2 !== undefined) rewritten.arg2 = arg2;
        current = { instruction: rewritten, originalLine };
        changed.constantPropagation.add(originalLine);
      }
    }

    // Whatever this instruction writes to, our old knowledge about it is now
    // out of date: either it holds a new constant, or it holds something we
    // cannot predict and must forget. This is what stops
    //   a = 10 ; a = 20 ; c = a
    // from turning c into 10.
    const defined = definedVariable(current.instruction);
    if (defined !== undefined) {
      if (current.instruction.op === '=' && isConstant(current.instruction.arg1)) {
        constants.set(defined, current.instruction.arg1 as string);
      } else {
        constants.delete(defined);
      }
    }

    result.push(current);
  }

  return result;
}

/** Swaps one operand for its constant value, when we know it. */
function substitute(value: string | undefined, constants: Map<string, string>): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return constants.get(value) ?? value;
}

/* ------------------------------------------------------------------ */
/* 2. Constant folding                                                 */
/* ------------------------------------------------------------------ */

/**
 * Evaluates the operations whose operands are all constants, turning them into
 * a plain copy:
 *
 *   t1 = 20 * 3   ->   t1 = 60
 *
 * It also simplifies a branch whose condition is already known, which is safe
 * no matter what follows it:
 *
 *   if true  goto L1   ->   goto L1          (the jump always happens)
 *   if false goto L1   ->   (removed)        (the jump never happens, so we
 *                                             carry on to the next line)
 *
 * An operation that cannot be evaluated - an unknown variable, a division by
 * zero, a type we do not handle - is left untouched.
 */
function constantFolding(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
  const result: TrackedInstruction[] = [];

  for (const tracked of instructions) {
    const { instruction, originalLine } = tracked;
    const { op, arg1, arg2, result: target } = instruction;

    // A branch on a condition we already know.
    if (op === 'if' && (arg1 === 'true' || arg1 === 'false')) {
      if (arg1 === 'true') {
        result.push({ instruction: { op: 'goto', result: target }, originalLine });
      }
      changed.constantFolding.add(originalLine);
      continue;
    }

    // An operation on constants: "neg"/"not"/"pos" take one operand, every
    // other operator takes two.
    let value: string | undefined;
    if (isUnaryOperation(op) && isConstant(arg1)) {
      value = foldUnary(op, arg1 as string);
    } else if (isBinaryOperation(op) && isConstant(arg1) && isConstant(arg2)) {
      value = foldBinary(op, arg1 as string, arg2 as string);
    }

    if (value === undefined) {
      result.push(tracked);
      continue;
    }

    result.push({ instruction: { op: '=', arg1: value, result: target }, originalLine });
    changed.constantFolding.add(originalLine);
  }

  return result;
}

/** The three one-operand operations the IR uses. */
function isUnaryOperation(op: string): boolean {
  return op === 'neg' || op === 'not' || op === 'pos';
}

/** Every two-operand operator the IR can contain. */
const BINARY_OPERATORS = ['+', '-', '*', '/', '%', '>', '<', '>=', '<=', '==', '!=', '&&', '||'];

/** Is this a real two-operand operation, rather than a copy or a jump? */
function isBinaryOperation(op: string): boolean {
  return BINARY_OPERATORS.includes(op);
}

/** -10 -> "-10", !true -> "false". Returns undefined when it cannot be done. */
function foldUnary(op: string, value: string): string | undefined {
  if (op === 'not') {
    return isBoolean(value) ? String(value !== 'true') : undefined;
  }
  if (!isNumber(value)) {
    return undefined;
  }
  if (op === 'neg') {
    return formatNumber(-Number(value), isWholeNumberLiteral(value));
  }
  return value; // "pos": +10 is just 10
}

/**
 * Evaluates one operation on two constants.
 *
 * Integer and floating-point arithmetic are told apart by how the literals are
 * written, which is how C++ reads them too: "7 / 2" is integer division and
 * gives 3, while "7.0 / 2" gives 3.5.
 */
function foldBinary(op: string, left: string, right: string): string | undefined {
  // true/false: only the logical and equality operators make sense.
  if (isBoolean(left) && isBoolean(right)) {
    const l = left === 'true';
    const r = right === 'true';
    switch (op) {
      case '&&':
        return String(l && r);
      case '||':
        return String(l || r);
      case '==':
        return String(l === r);
      case '!=':
        return String(l !== r);
      default:
        return undefined;
    }
  }

  if (!isNumber(left) || !isNumber(right)) {
    return undefined; // characters, or a mix we do not handle
  }

  const l = Number(left);
  const r = Number(right);
  const bothAreIntegers = isWholeNumberLiteral(left) && isWholeNumberLiteral(right);

  switch (op) {
    case '+':
      return formatNumber(l + r, bothAreIntegers);
    case '-':
      return formatNumber(l - r, bothAreIntegers);
    case '*':
      return formatNumber(l * r, bothAreIntegers);
    case '/':
      // Dividing by zero is left in the IR exactly as written - folding it
      // would invent a value the program never had.
      if (r === 0) return undefined;
      return bothAreIntegers ? String(Math.trunc(l / r)) : formatNumber(l / r, false);
    case '%':
      // "%" only applies to whole numbers.
      if (!bothAreIntegers || r === 0) return undefined;
      return String(l % r);
    case '>':
      return String(l > r);
    case '<':
      return String(l < r);
    case '>=':
      return String(l >= r);
    case '<=':
      return String(l <= r);
    case '==':
      return String(l === r);
    case '!=':
      return String(l !== r);
    default:
      return undefined;
  }
}

/**
 * Writes a number back as IR text.
 *
 * Floating-point arithmetic can leave a long tail of digits (0.1 + 0.2 comes
 * out as 0.30000000000000004), so a float is rounded to the digits that are
 * actually meaningful before being printed.
 */
function formatNumber(value: number, isIntegerArithmetic: boolean): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (isIntegerArithmetic) {
    return String(value);
  }
  return String(parseFloat(value.toPrecision(15)));
}

/* ------------------------------------------------------------------ */
/* 3. Dead code elimination                                            */
/* ------------------------------------------------------------------ */

/**
 * Removes an assignment whose variable is never read anywhere in the program.
 *
 *   a = 10
 *   b = 20          <- b is read by nothing, so this line goes
 *   return a
 *
 * Only instructions that write to a variable are candidates. Labels, `goto`,
 * `if` and `return` are never removed, so the shape of the control flow and
 * the result of the program cannot change.
 *
 * Each call removes one layer: dropping "c = t1" is what reveals that t1 is
 * now unread, and the next pass removes "t1 = ..." in turn.
 */
function deadCodeElimination(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
  // Every name that is read by any instruction, anywhere in the list. Operands
  // that are literals land in here too, which does no harm because we only
  // ever ask about the variable an instruction writes to.
  const read = new Set<string>();
  for (const { instruction } of instructions) {
    if (instruction.arg1 !== undefined) read.add(instruction.arg1);
    if (instruction.arg2 !== undefined) read.add(instruction.arg2);
  }

  const result: TrackedInstruction[] = [];
  for (const tracked of instructions) {
    const defined = definedVariable(tracked.instruction);

    if (defined === undefined || read.has(defined)) {
      result.push(tracked);
      continue;
    }

    changed.deadCodeElimination.add(tracked.originalLine);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * The variable this instruction writes to, or undefined when it writes to no
 * variable at all.
 *
 * For a label and a jump `result` holds a LABEL rather than a variable, which
 * is why they have to be listed here: treating "L1" as a variable would let
 * the optimizer delete the control flow.
 */
function definedVariable(instruction: IRInstruction): string | undefined {
  switch (instruction.op) {
    case 'label':
    case 'goto':
    case 'if':
    case 'return':
      return undefined;
    default:
      return instruction.result;
  }
}

/** True when this operand is a literal rather than a variable name. */
function isConstant(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return isNumber(value) || isBoolean(value) || isCharLiteral(value);
}

/** 10, -10, 10.5 - the numbers we can compute with. */
function isNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

/** A number written without a decimal point, so C++ would treat it as an int. */
function isWholeNumberLiteral(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function isBoolean(value: string): boolean {
  return value === 'true' || value === 'false';
}

/** 'a' - a constant we can copy around but never compute with. */
function isCharLiteral(value: string): boolean {
  return value.length >= 2 && value.startsWith("'") && value.endsWith("'");
}
