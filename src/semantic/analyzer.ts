import type { ASTNode } from '../ast/astTypes';
import { SymbolTable } from './symbolTable';
import type { DataType, ExpressionType, SemanticError, SemanticResult } from './semanticTypes';

const MAIN_RETURN_TYPE: DataType = 'int';

let table = new SymbolTable();
let errors: SemanticError[] = [];

function addError(message: string, astNode?: ASTNode) {
  errors.push({ message, line: astNode?.line, column: astNode?.column });
}

export function analyzeSemantics(ast: ASTNode): SemanticResult {
  table = new SymbolTable();
  errors = [];

  analyzeProgram(ast);

  return { symbols: table.getSymbols(), errors };
}

function analyzeProgram(programNode: ASTNode) {
  for (const child of programNode.children) {
    if (child.type === 'MainFunction') {
      analyzeMainFunction(child);
    }
  }
}

function analyzeMainFunction(functionNode: ASTNode) {
  table.enterScope('main');

  for (const child of functionNode.children) {
    if (child.type === 'Block') {
      analyzeStatements(child);
    }
  }

  table.exitScope();
}

function analyzeStatements(blockNode: ASTNode) {
  for (const statement of blockNode.children) {
    analyzeStatement(statement);
  }
}

function analyzeBlock(blockNode: ASTNode) {
  table.enterBlockScope();
  analyzeStatements(blockNode);
  table.exitScope();
}

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
      getExpressionType(statement);
      break;
  }
}

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
    return;
  }

  table.declare(name, declaredType);
}

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

function analyzeIfStatement(statement: ASTNode) {
  checkCondition(statement.children[0]);
  analyzeStatement(statement.children[1]);
  if (statement.children.length > 2) {
    analyzeStatement(statement.children[2]);
  }
}

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

function checkCondition(conditionNode: ASTNode) {
  const type = getExpressionType(conditionNode);
  if (type !== 'unknown' && type !== 'bool') {
    addError('Condition must be of type bool.', conditionNode);
  }
}

function isNumeric(type: ExpressionType): boolean {
  return type === 'int' || type === 'float';
}

function isAssignable(targetType: DataType, valueType: ExpressionType): boolean {
  if (valueType === 'unknown') return true;
  if (targetType === valueType) return true;
  if (targetType === 'float' && valueType === 'int') return true;
  return false;
}

function checkAssignable(targetType: DataType, valueType: ExpressionType, where: ASTNode) {
  if (!isAssignable(targetType, valueType)) {
    addError(`Cannot assign ${valueType} to ${targetType}.`, where);
  }
}

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

function getLiteralType(literal: ASTNode): ExpressionType {
  const text = literal.value ?? '';

  if (text === 'true' || text === 'false') return 'bool';
  if (text.startsWith("'")) return 'char';
  if (text.includes('.')) return 'float';
  return 'int';
}

function getIdentifierType(identifier: ASTNode): ExpressionType {
  const name = identifier.value ?? '';
  const symbol = table.lookup(name);

  if (symbol === undefined) {
    addError(`Variable '${name}' is not declared.`, identifier);
    return 'unknown';
  }

  return symbol.type;
}

function getBinaryExpressionType(expression: ASTNode): ExpressionType {
  const operator = expression.value ?? '';
  const leftType = getExpressionType(expression.children[0]);
  const rightType = getExpressionType(expression.children[1]);

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
