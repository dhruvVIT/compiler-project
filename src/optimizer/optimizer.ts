import type { IRInstruction } from '../ir/irTypes';
import { formatInstruction } from '../ir/irTypes';

export interface AppliedOptimization {
  name: string;
  lines: number[];
}

export interface OptimizationResult {
  original: IRInstruction[];
  optimized: IRInstruction[];
  applied: AppliedOptimization[];
}

const CONSTANT_PROPAGATION = 'Constant Propagation';
const CONSTANT_FOLDING = 'Constant Folding';
const DEAD_CODE_ELIMINATION = 'Dead Code Elimination';

const MAX_PASSES = 4;

interface TrackedInstruction {
  instruction: IRInstruction;
  originalLine: number;
}

interface ChangedLines {
  constantPropagation: Set<number>;
  constantFolding: Set<number>;
  deadCodeElimination: Set<number>;
}

export function optimizeIR(instructions: IRInstruction[]): OptimizationResult {
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

function sortedLines(lines: Set<number>): number[] {
  return [...lines].sort((a, b) => a - b);
}

function asText(instructions: TrackedInstruction[]): string {
  return instructions.map((tracked) => formatInstruction(tracked.instruction)).join('\n');
}

function constantPropagation(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
  const constants = new Map<string, string>();
  const result: TrackedInstruction[] = [];

  for (const tracked of instructions) {
    const { instruction, originalLine } = tracked;

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

function substitute(value: string | undefined, constants: Map<string, string>): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return constants.get(value) ?? value;
}

function constantFolding(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
  const result: TrackedInstruction[] = [];

  for (const tracked of instructions) {
    const { instruction, originalLine } = tracked;
    const { op, arg1, arg2, result: target } = instruction;

    if (op === 'if' && (arg1 === 'true' || arg1 === 'false')) {
      if (arg1 === 'true') {
        result.push({ instruction: { op: 'goto', result: target }, originalLine });
      }
      changed.constantFolding.add(originalLine);
      continue;
    }

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

function isUnaryOperation(op: string): boolean {
  return op === 'neg' || op === 'not' || op === 'pos';
}

const BINARY_OPERATORS = ['+', '-', '*', '/', '%', '>', '<', '>=', '<=', '==', '!=', '&&', '||'];

function isBinaryOperation(op: string): boolean {
  return BINARY_OPERATORS.includes(op);
}

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
  return value;
}

function foldBinary(op: string, left: string, right: string): string | undefined {
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
    return undefined;
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
      if (r === 0) return undefined;
      return bothAreIntegers ? String(Math.trunc(l / r)) : formatNumber(l / r, false);
    case '%':
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

function formatNumber(value: number, isIntegerArithmetic: boolean): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (isIntegerArithmetic) {
    return String(value);
  }
  return String(parseFloat(value.toPrecision(15)));
}

function deadCodeElimination(
  instructions: TrackedInstruction[],
  changed: ChangedLines,
): TrackedInstruction[] {
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

function isConstant(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  return isNumber(value) || isBoolean(value) || isCharLiteral(value);
}

function isNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function isWholeNumberLiteral(value: string): boolean {
  return /^-?\d+$/.test(value);
}

function isBoolean(value: string): boolean {
  return value === 'true' || value === 'false';
}

function isCharLiteral(value: string): boolean {
  return value.length >= 2 && value.startsWith("'") && value.endsWith("'");
}
