/**
 * CompilerViz - Semantic Analyzer (Phase 3)
 * -----------------------------------------
 * Input : ASTNode         (the tree built in Phase 2)
 * Output: SemanticResult  (the symbol table + the errors that were found)
 *
 * The analyser walks the AST. For each node it performs the check that belongs
 * to that node and then visits the node's children:
 *
 *   AST node -> look at its type -> run the check -> visit the children
 *
 * Errors are COLLECTED, not thrown, so one program can report several problems
 * at once. The analyser never looks at the source text or the tokens; every
 * answer comes from the AST and the symbol table.
 */

import type { ASTNode } from '../ast/astTypes';
import { SymbolTable } from './symbolTable';
import type { DataType, ExpressionType, SemanticError, SemanticResult } from './semanticTypes';

/** main() returns int, so `return` expressions are checked against this. */
const MAIN_RETURN_TYPE: DataType = 'int';

/* ------------------------------------------------------------------ */
/* Analyzer state                                                      */
/* ------------------------------------------------------------------ */

let table = new SymbolTable();
let errors: SemanticError[] = [];

/** Records a problem, together with the position stored on the AST node. */
function addError(message: string, astNode?: ASTNode) {
  errors.push({ message, line: astNode?.line, column: astNode?.column });
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/** Checks the program and returns the symbol table and the errors found. */
export function analyzeSemantics(ast: ASTNode): SemanticResult {
  table = new SymbolTable();
  errors = [];

  analyzeProgram(ast);

  return { symbols: table.getSymbols(), errors };
}

/** Program -> MainFunction */
function analyzeProgram(programNode: ASTNode) {
  for (const child of programNode.children) {
    if (child.type === 'MainFunction') {
      analyzeMainFunction(child);
    }
  }
}

/**
 * MainFunction -> Block
 *
 * The body of main() IS the "main" scope, so the block below it does not open
 * a second scope of its own.
 */
function analyzeMainFunction(functionNode: ASTNode) {
  table.enterScope('main');

  for (const child of functionNode.children) {
    if (child.type === 'Block') {
      analyzeStatements(child);
    }
  }

  table.exitScope();
}

/** Runs the checks for every statement inside a block. */
function analyzeStatements(blockNode: ASTNode) {
  for (const statement of blockNode.children) {
    analyzeStatement(statement);
  }
}

/** A nested block: its own scope, so its variables disappear at the end. */
function analyzeBlock(blockNode: ASTNode) {
  table.enterBlockScope();
  analyzeStatements(blockNode);
  table.exitScope();
}

/* ------------------------------------------------------------------ */
/* Statements                                                          */
/* ------------------------------------------------------------------ */

function analyzeStatement(statement: ASTNode) {
  switch (statement.type) {
    case 'VariableDeclaration':
      analyzeVariableDeclaration(statement);
      break;
    case 'Assignment':
      analyzeAssignment(statement);
      break;
    case 'IfStatement':
      analyzeIfStatement(statement);
      break;
    case 'ReturnStatement':
      analyzeReturnStatement(statement);
      break;
    case 'Block':
      analyzeBlock(statement);
      break;
    default:
      // Anything else here is an expression used as a statement, e.g. "x++;".
      getExpressionType(statement);
      break;
  }
}

/**
 * int a = 10;
 *
 * The initialiser is checked FIRST, so that "int a = a;" correctly reports that
 * `a` is not declared yet. Then the variable is added to the current scope.
 */
function analyzeVariableDeclaration(declaration: ASTNode) {
  const declaredType = declaration.value as DataType;
  const nameNode = declaration.children[0];
  const name = nameNode.value ?? '';

  if (declaration.children.length > 1) {
    const valueType = getExpressionType(declaration.children[1]);
    checkAssignable(declaredType, valueType, declaration.children[1]);
  }

  if (table.isDeclaredInCurrentScope(name)) {
    addError(`Variable '${name}' is already declared in this scope.`, declaration);
    return; // the duplicate is not added to the symbol table
  }

  table.declare(name, declaredType);
}

/** x = expression; */
function analyzeAssignment(assignment: ASTNode) {
  const nameNode = assignment.children[0];
  const name = nameNode.value ?? '';
  const valueType = getExpressionType(assignment.children[1]);

  const symbol = table.lookup(name);
  if (symbol === undefined) {
    addError(`Variable '${name}' is not declared.`, nameNode);
    return;
  }

  checkAssignable(symbol.type, valueType, assignment.children[1]);
}

/** if (condition) statement [else statement] */
function analyzeIfStatement(statement: ASTNode) {
  checkCondition(statement.children[0]);
  analyzeStatement(statement.children[1]);
  if (statement.children.length > 2) {
    analyzeStatement(statement.children[2]);
  }
}

/** return expression; - main() returns int, so the value must fit an int. */
function analyzeReturnStatement(statement: ASTNode) {
  const valueNode = statement.children[0];
  const valueType = getExpressionType(valueNode);

  if (valueType === 'unknown') return;

  if (!isAssignable(MAIN_RETURN_TYPE, valueType)) {
    addError(
      `Cannot return ${valueType} from main, which returns ${MAIN_RETURN_TYPE}.`,
      valueNode,
    );
  }
}

/** The condition of an if must be a bool. */
function checkCondition(conditionNode: ASTNode) {
  const type = getExpressionType(conditionNode);
  if (type !== 'unknown' && type !== 'bool') {
    addError('Condition must be of type bool.', conditionNode);
  }
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** int and float are the numeric types. */
function isNumeric(type: ExpressionType): boolean {
  return type === 'int' || type === 'float';
}

/**
 * Can a value of `valueType` be stored in a variable of `targetType`?
 *
 * The rule is deliberately simple: the types must match, except that an int
 * may be stored in a float (widening). Narrowing a float into an int is not
 * allowed, because it would silently lose the fractional part.
 */
function isAssignable(targetType: DataType, valueType: ExpressionType): boolean {
  if (valueType === 'unknown') return true; // already reported elsewhere
  if (targetType === valueType) return true;
  if (targetType === 'float' && valueType === 'int') return true;
  return false;
}

/** Reports a type mismatch if the value does not fit the target. */
function checkAssignable(targetType: DataType, valueType: ExpressionType, where: ASTNode) {
  if (!isAssignable(targetType, valueType)) {
    addError(`Cannot assign ${valueType} to ${targetType}.`, where);
  }
}

/**
 * Works out the type of an expression.
 *
 * Returns "unknown" when the type cannot be decided, which happens after an
 * error has already been reported for that part of the expression.
 */
function getExpressionType(expression: ASTNode): ExpressionType {
  switch (expression.type) {
    case 'Literal':
      return getLiteralType(expression);
    case 'Identifier':
      return getIdentifierType(expression);
    case 'BinaryExpression':
      return getBinaryExpressionType(expression);
    case 'UnaryExpression':
      return getUnaryExpressionType(expression);
    default:
      return 'unknown';
  }
}

/** 10 -> int, 10.5 -> float, true/false -> bool, 'a' -> char */
function getLiteralType(literal: ASTNode): ExpressionType {
  const text = literal.value ?? '';

  if (text === 'true' || text === 'false') return 'bool';
  if (text.startsWith("'")) return 'char';
  if (text.includes('.')) return 'float';
  return 'int';
}

/** The type of a variable comes from the symbol table. */
function getIdentifierType(identifier: ASTNode): ExpressionType {
  const name = identifier.value ?? '';
  const symbol = table.lookup(name);

  if (symbol === undefined) {
    addError(`Variable '${name}' is not declared.`, identifier);
    return 'unknown';
  }

  return symbol.type;
}

/**
 * a + b, a > b, a && b ...
 *
 *   + - * / %      both sides numeric; float if either side is float
 *   > < >= <=      both sides numeric; the result is bool
 *   == !=          both sides numeric, or both exactly the same type
 *   && ||          both sides bool
 */
function getBinaryExpressionType(expression: ASTNode): ExpressionType {
  const operator = expression.value ?? '';
  const leftType = getExpressionType(expression.children[0]);
  const rightType = getExpressionType(expression.children[1]);

  // A part of the expression was already wrong, so stay quiet about the rest.
  if (leftType === 'unknown' || rightType === 'unknown') return 'unknown';

  if (operator === '+' || operator === '-' || operator === '*' || operator === '/' || operator === '%') {
    if (!isNumeric(leftType) || !isNumeric(rightType)) {
      addError(
        `Operator '${operator}' cannot be used with ${leftType} and ${rightType}.`,
        expression,
      );
      return 'unknown';
    }
    return leftType === 'float' || rightType === 'float' ? 'float' : 'int';
  }

  if (operator === '>' || operator === '<' || operator === '>=' || operator === '<=') {
    if (!isNumeric(leftType) || !isNumeric(rightType)) {
      addError(
        `Operator '${operator}' cannot be used with ${leftType} and ${rightType}.`,
        expression,
      );
      return 'unknown';
    }
    return 'bool';
  }

  if (operator === '==' || operator === '!=') {
    const bothNumbers = isNumeric(leftType) && isNumeric(rightType);
    if (!bothNumbers && leftType !== rightType) {
      addError(
        `Operator '${operator}' cannot be used with ${leftType} and ${rightType}.`,
        expression,
      );
      return 'unknown';
    }
    return 'bool';
  }

  if (operator === '&&' || operator === '||') {
    if (leftType !== 'bool' || rightType !== 'bool') {
      addError(
        `Operator '${operator}' needs bool operands but got ${leftType} and ${rightType}.`,
        expression,
      );
      return 'unknown';
    }
    return 'bool';
  }

  return 'unknown';
}

/**
 * !x, -x, x++, x--
 *
 *   !        the operand must be bool, the result is bool
 *   - ++ --  the operand must be numeric, the result keeps that type
 */
function getUnaryExpressionType(expression: ASTNode): ExpressionType {
  const operator = expression.value ?? '';
  const operandType = getExpressionType(expression.children[0]);

  if (operandType === 'unknown') return 'unknown';

  if (operator === '!') {
    if (operandType !== 'bool') {
      addError(`Operator '!' needs a bool operand but got ${operandType}.`, expression);
      return 'unknown';
    }
    return 'bool';
  }

  if (operator === '-' || operator === '++' || operator === '--') {
    if (!isNumeric(operandType)) {
      addError(
        `Operator '${operator}' cannot be used with ${operandType}.`,
        expression,
      );
      return 'unknown';
    }
    return operandType;
  }

  return 'unknown';
}
