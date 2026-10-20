import type { Token } from '../types/compiler';
import type { ASTNode } from './astTypes';

let tokens: Token[] = [];

let current = 0;

let nextId = 0;

function peek(): Token | undefined {
  return tokens[current];
}

function peekNext(): Token | undefined {
  return tokens[current + 1];
}

function advance(): Token {
  const token = tokens[current];
  current++;
  return token;
}

function isAtEnd(): boolean {
  return current >= tokens.length;
}

function check(type: string, value?: string): boolean {
  const token = peek();
  if (token === undefined) return false;
  if (token.type !== type) return false;
  if (value !== undefined && token.value !== value) return false;
  return true;
}

function match(type: string, value?: string): Token | undefined {
  if (check(type, value)) {
    return advance();
  }
  return undefined;
}

function expect(type: string, value?: string): Token {
  if (check(type, value)) {
    return advance();
  }

  const wanted = value !== undefined ? `'${value}'` : type;
  const token = peek();
  if (token === undefined) {
    throw new Error(`Expected ${wanted} but the code ended`);
  }
  throw new Error(
    `Line ${token.line}, column ${token.column}: Expected ${wanted} but found '${token.value}'`,
  );
}

function node(type: string, children: ASTNode[] = [], value?: string, token?: Token): ASTNode {
  const created: ASTNode = { id: `n${nextId}`, type, children };
  nextId++;
  if (value !== undefined) {
    created.value = value;
  }
  if (token !== undefined) {
    created.line = token.line;
    created.column = token.column;
  }
  return created;
}

function isTypeKeyword(): boolean {
  return (
    check('KEYWORD', 'int') ||
    check('KEYWORD', 'float') ||
    check('KEYWORD', 'bool') ||
    check('KEYWORD', 'char')
  );
}

export function buildAST(inputTokens: Token[]): ASTNode {
  tokens = inputTokens;
  current = 0;
  nextId = 0;
  return parseProgram();
}

function parseProgram(): ASTNode {
  if (isAtEnd()) {
    throw new Error('There is no code to analyse');
  }

  const main = parseMainFunction();

  const leftover = peek();
  if (leftover !== undefined) {
    throw new Error(
      `Line ${leftover.line}, column ${leftover.column}: Unexpected '${leftover.value}' after the end of main()`,
    );
  }

  return node('Program', [main]);
}

function parseMainFunction(): ASTNode {
  expect('KEYWORD', 'int');
  expect('IDENTIFIER', 'main');
  expect('DELIMITER', '(');
  expect('DELIMITER', ')');
  const body = parseBlock();
  return node('MainFunction', [body]);
}

function parseBlock(): ASTNode {
  expect('DELIMITER', '{');

  const statements: ASTNode[] = [];
  while (!isAtEnd() && !check('DELIMITER', '}')) {
    statements.push(parseStatement());
  }

  expect('DELIMITER', '}');
  return node('Block', statements);
}

function parseStatement(): ASTNode {
  if (isTypeKeyword()) return parseVariableDeclaration();
  if (check('KEYWORD', 'if')) return parseIfStatement();
  if (check('KEYWORD', 'return')) return parseReturnStatement();
  if (check('DELIMITER', '{')) return parseBlock();

  if (check('IDENTIFIER')) {
    const next = peekNext();
    if (next !== undefined && (next.value === '++' || next.value === '--')) {
      const statement = parseIncrement();
      expect('DELIMITER', ';');
      return statement;
    }
    return parseAssignment();
  }

  const token = peek();
  if (token === undefined) {
    throw new Error('The code ended in the middle of a statement');
  }
  throw new Error(
    `Line ${token.line}, column ${token.column}: '${token.value}' cannot start a statement`,
  );
}

function parseVariableDeclaration(): ASTNode {
  const typeToken = advance();
  const nameToken = expect('IDENTIFIER');

  const children: ASTNode[] = [node('Identifier', [], nameToken.value, nameToken)];

  if (match('OPERATOR', '=') !== undefined) {
    children.push(parseExpression());
  }

  expect('DELIMITER', ';');
  return node('VariableDeclaration', children, typeToken.value, nameToken);
}

function parseAssignment(): ASTNode {
  const nameToken = expect('IDENTIFIER');
  expect('OPERATOR', '=');
  const value = parseExpression();
  expect('DELIMITER', ';');
  return node(
    'Assignment',
    [node('Identifier', [], nameToken.value, nameToken), value],
    undefined,
    nameToken,
  );
}

function parseIncrement(): ASTNode {
  const nameToken = expect('IDENTIFIER');
  const operator = advance();
  return node('UnaryExpression', [node('Identifier', [], nameToken.value, nameToken)], operator.value, operator);
}

function parseIfStatement(): ASTNode {
  expect('KEYWORD', 'if');
  expect('DELIMITER', '(');
  const condition = parseExpression();
  expect('DELIMITER', ')');
  const thenBranch = parseStatement();

  const children = [condition, thenBranch];
  if (match('KEYWORD', 'else') !== undefined) {
    children.push(parseStatement());
  }

  return node('IfStatement', children);
}

function parseReturnStatement(): ASTNode {
  expect('KEYWORD', 'return');
  const value = parseExpression();
  expect('DELIMITER', ';');
  return node('ReturnStatement', [value]);
}

function parseExpression(): ASTNode {
  return parseLogicalOr();
}

function parseLogicalOr(): ASTNode {
  let left = parseLogicalAnd();
  while (check('OPERATOR', '||')) {
    const operator = advance();
    const right = parseLogicalAnd();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseLogicalAnd(): ASTNode {
  let left = parseEquality();
  while (check('OPERATOR', '&&')) {
    const operator = advance();
    const right = parseEquality();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseEquality(): ASTNode {
  let left = parseRelational();
  while (check('OPERATOR', '==') || check('OPERATOR', '!=')) {
    const operator = advance();
    const right = parseRelational();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseRelational(): ASTNode {
  let left = parseAdditive();
  while (
    check('OPERATOR', '>') ||
    check('OPERATOR', '<') ||
    check('OPERATOR', '>=') ||
    check('OPERATOR', '<=')
  ) {
    const operator = advance();
    const right = parseAdditive();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseAdditive(): ASTNode {
  let left = parseMultiplicative();
  while (check('OPERATOR', '+') || check('OPERATOR', '-')) {
    const operator = advance();
    const right = parseMultiplicative();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseMultiplicative(): ASTNode {
  let left = parseUnary();
  while (check('OPERATOR', '*') || check('OPERATOR', '/') || check('OPERATOR', '%')) {
    const operator = advance();
    const right = parseUnary();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

function parseUnary(): ASTNode {
  if (
    check('OPERATOR', '!') ||
    check('OPERATOR', '-') ||
    check('OPERATOR', '++') ||
    check('OPERATOR', '--')
  ) {
    const operator = advance();
    const operand = parseUnary();
    return node('UnaryExpression', [operand], operator.value, operator);
  }
  return parsePrimary();
}

function parsePrimary(): ASTNode {
  if (match('DELIMITER', '(') !== undefined) {
    const inner = parseExpression();
    expect('DELIMITER', ')');
    return inner;
  }

  if (check('IDENTIFIER')) {
    const nameToken = advance();
    if (check('OPERATOR', '++') || check('OPERATOR', '--')) {
      const operator = advance();
      return node('UnaryExpression', [node('Identifier', [], nameToken.value, nameToken)], operator.value, operator);
    }
    return node('Identifier', [], nameToken.value, nameToken);
  }

  if (
    check('INTEGER_LITERAL') ||
    check('FLOAT_LITERAL') ||
    check('CHAR_LITERAL') ||
    check('KEYWORD', 'true') ||
    check('KEYWORD', 'false')
  ) {
    const literal = advance();
    return node('Literal', [], literal.value, literal);
  }

  const token = peek();
  if (token === undefined) {
    throw new Error('The code ended in the middle of an expression');
  }
  throw new Error(
    `Line ${token.line}, column ${token.column}: Expected a value but found '${token.value}'`,
  );
}
