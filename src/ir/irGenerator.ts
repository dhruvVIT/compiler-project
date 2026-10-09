/**
 * CompilerViz - IR Generator (Phase 4)
 * ------------------------------------
 * Input : ASTNode          (the tree built in Phase 2)
 * Output: IRInstruction[]  (Three-Address Code)
 *
 *   AST -> generateIR(ast) -> IRInstruction[]
 *
 * The generator reads ONLY the AST. It never looks at the source text or the
 * tokens, and it never rebuilds the tree. Semantic analysis has already run by
 * this point, so this file does no checking at all - its single job is to
 * translate.
 *
 * HOW IT WORKS
 * ------------
 * Two mutually recursive walks over the tree:
 *
 *   generateStatement(node)   emits the instructions for a statement
 *   translateExpression(node) emits the instructions for an expression AND
 *                             returns the NAME that holds its answer
 *
 * The second one is the heart of TAC. An expression is broken up so that each
 * instruction has at most two operands: the deepest operation is emitted
 * first into a temporary, and the parent then uses that temporary as its own
 * operand. Because the AST already stores precedence as its shape, following
 * the tree is all that is needed to get the order right.
 *
 *   a + b * c   ->   t1 = b * c
 *                    t2 = a + t1
 *
 * NO OPTIMIZATION
 * ---------------
 * The IR is written down exactly as the AST describes it. Constant folding,
 * copy propagation and friends belong to the next phase, so "10 + 20 * 3"
 * stays three instructions here and is NOT reduced to 70.
 */

import type { ASTNode } from '../ast/astTypes';
import type { IRInstruction } from './irTypes';

/* ------------------------------------------------------------------ */
/* Generator state                                                     */
/*                                                                     */
/* Kept at module level, the same way the AST builder keeps its state, */
/* and reset by generateIR() so every run starts from t1 and L1.       */
/* ------------------------------------------------------------------ */

/** The instructions produced so far, in order. */
let instructions: IRInstruction[] = [];

/** How many temporaries have been handed out (t1, t2, t3, ...). */
let tempCount = 0;

/** How many labels have been handed out (L1, L2, L3, ...). */
let labelCount = 0;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Adds one instruction to the end of the list. */
function emit(instruction: IRInstruction) {
  instructions.push(instruction);
}

/** Gives out the next temporary: t1, then t2, then t3 ... */
function newTemp(): string {
  tempCount++;
  return `t${tempCount}`;
}

/** Gives out the next label: L1, then L2, then L3 ... */
function newLabel(): string {
  labelCount++;
  return `L${labelCount}`;
}

/** `name = value` */
function emitCopy(name: string, value: string) {
  emit({ op: '=', arg1: value, result: name });
}

/** `L1:` */
function emitLabel(label: string) {
  emit({ op: 'label', result: label });
}

/** `goto L1` */
function emitGoto(label: string) {
  emit({ op: 'goto', result: label });
}

/** The name an Identifier or Literal node carries. */
function nameOf(node: ASTNode): string {
  return node.value ?? '';
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Translates a whole program into Three-Address Code.
 *
 * Returns an empty list when there is no AST (the code did not build), which
 * is the only error handling this phase needs.
 */
export function generateIR(ast: ASTNode | null): IRInstruction[] {
  instructions = [];
  tempCount = 0;
  labelCount = 0;

  if (ast === null) {
    return [];
  }

  generateStatement(ast);
  return instructions;
}

/* ------------------------------------------------------------------ */
/* Statements                                                          */
/* ------------------------------------------------------------------ */

/** Emits the instructions for one statement. */
function generateStatement(node: ASTNode) {
  switch (node.type) {
    // These only group other statements, so we walk straight through them.
    // Program -> MainFunction -> Block means the IR starts at the first
    // statement inside main(), with no prologue instructions.
    case 'Program':
    case 'MainFunction':
    case 'Block':
      for (const child of node.children) {
        generateStatement(child);
      }
      break;

    case 'VariableDeclaration':
      generateDeclaration(node);
      break;

    case 'Assignment':
      generateAssignment(node);
      break;

    case 'IfStatement':
      generateIfStatement(node);
      break;

    case 'ReturnStatement':
      emit({ op: 'return', arg1: translateExpression(node.children[0]) });
      break;

    default:
      // An expression used as a statement, e.g. "i++;". We translate it for
      // its effect and throw the resulting name away.
      translateExpression(node);
      break;
  }
}

/**
 * int a = 10;      ->   a = 10
 * int c = a + b;   ->   t1 = a + b
 *                       c = t1
 *
 * The declared type is not part of basic TAC, so it is ignored here - the
 * symbol table already records it. A declaration with no initialiser
 * ("int x;") reserves nothing at this level and emits nothing.
 */
function generateDeclaration(node: ASTNode) {
  if (node.children.length < 2) {
    return;
  }
  const name = nameOf(node.children[0]);
  const value = translateExpression(node.children[1]);
  emitCopy(name, value);
}

/** c = a + b;  ->  t1 = a + b ; c = t1 */
function generateAssignment(node: ASTNode) {
  const name = nameOf(node.children[0]);
  const value = translateExpression(node.children[1]);
  emitCopy(name, value);
}

/**
 * if (a > b) { ... } else { ... }
 *
 *       t1 = a > b
 *       if t1 goto L1      <- then-branch
 *       goto L2            <- else-branch (or the end, when there is no else)
 *   L1: ...then...
 *       goto L3            }
 *   L2: ...else...         } only when there is an else
 *   L3:                    }
 *
 * The condition is always reduced to one name first, so the branch
 * instruction looks the same everywhere in the IR.
 */
function generateIfStatement(node: ASTNode) {
  const [conditionNode, thenBranch] = node.children;
  const elseBranch = node.children[2];
  const hasElse = elseBranch !== undefined;

  const thenLabel = newLabel();
  const elseLabel = newLabel();
  // Allocated now, with the other two, so the labels of a simple if/else read
  // L1, L2, L3 in order.
  const endLabel = hasElse ? newLabel() : elseLabel;

  const condition = translateExpression(conditionNode);
  emit({ op: 'if', arg1: condition, result: thenLabel });
  emitGoto(elseLabel);

  emitLabel(thenLabel);
  generateStatement(thenBranch);

  if (hasElse) {
    emitGoto(endLabel);
    emitLabel(elseLabel);
    generateStatement(elseBranch);
  }

  emitLabel(endLabel);
}

/* ------------------------------------------------------------------ */
/* Expressions                                                         */
/* ------------------------------------------------------------------ */

/**
 * Emits the instructions for an expression and returns the name holding its
 * value - a temporary, a variable name, or a literal written out as it is.
 *
 * Literals and variables need no instruction of their own, so no pointless
 * temporaries are created for them: "int x = 10;" really is just "x = 10".
 */
function translateExpression(node: ASTNode): string {
  switch (node.type) {
    case 'Literal':
    case 'Identifier':
      return nameOf(node);

    case 'BinaryExpression': {
      // The operands are translated first, so the inner operations are
      // emitted before the one that uses their results.
      const left = translateExpression(node.children[0]);
      const right = translateExpression(node.children[1]);
      const target = newTemp();
      emit({ op: nameOf(node), arg1: left, arg2: right, result: target });
      return target;
    }

    case 'UnaryExpression':
      return translateUnary(node);

    default:
      // Not reachable for a tree the AST builder produced; returning the
      // node's own text keeps the output readable if it ever happens.
      return nameOf(node);
  }
}

/**
 * !valid   ->   t1 = !valid
 * -a       ->   t1 = -a
 * i++      ->   i = i + 1
 *
 * Note on ++ and --: the AST builder stores a prefix "++i" and a postfix
 * "i++" as the same node, so the IR cannot tell them apart. We therefore use
 * one simple rule - increment the variable, then use the variable - which is
 * exactly right for a statement like "i++;", the only place this subset
 * actually uses them.
 */
function translateUnary(node: ASTNode): string {
  const operator = nameOf(node);
  const operand = node.children[0];

  if (operator === '++' || operator === '--') {
    // Only a variable can be incremented; anything else is a semantic error
    // that was already reported, so we just translate the operand.
    if (operand.type !== 'Identifier') {
      return translateExpression(operand);
    }
    const name = nameOf(operand);
    emit({ op: operator === '++' ? '+' : '-', arg1: name, arg2: '1', result: name });
    return name;
  }

  const value = translateExpression(operand);
  const target = newTemp();

  if (operator === '!') {
    emit({ op: 'not', arg1: value, result: target });
  } else if (operator === '-') {
    emit({ op: 'neg', arg1: value, result: target });
  } else {
    emit({ op: 'pos', arg1: value, result: target });
  }

  return target;
}
