/**
 * CompilerViz - AST Builder (Phase 2)
 * -----------------------------------
 * Input : Token[]   (produced by the lexer in Phase 1)
 * Output: ASTNode   (the root of the Abstract Syntax Tree)
 *
 * There is NO parse tree in between. Each function reads the tokens it expects
 * and immediately returns the AST node for them, so the conversion is:
 *
 *   tokens -> AST
 *
 * HOW IT WORKS
 * ------------
 * This is a recursive-descent builder. Every rule of the language has one
 * function. A function looks at the current token, consumes the tokens that
 * belong to it, calls the functions for the smaller pieces inside it, and
 * returns one AST node holding those pieces as children.
 *
 * WHAT MAKES IT AN AST (not a parse tree)
 * ---------------------------------------
 * Punctuation that only exists to help the parser - ';' ',' '(' ')' '{' '}'
 * and the '=' of a declaration - is consumed but NOT stored. Only the parts
 * that carry meaning become nodes.
 *
 * ERRORS
 * ------
 * If the tokens do not fit the language, `expect()` throws an Error whose
 * message names the line and column. `buildAST` does not try to recover; the
 * UI simply shows the message.
 */

import type { Token } from '../types/compiler';
import type { ASTNode } from './astTypes';

/* ------------------------------------------------------------------ */
/* Builder state                                                       */
/* ------------------------------------------------------------------ */

/** The tokens we are reading. */
let tokens: Token[] = [];

/** The position of the token we are looking at right now. */
let current = 0;

/** Counter used to give every AST node a unique id. */
let nextId = 0;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Returns the current token without consuming it. */
function peek(): Token | undefined {
  return tokens[current];
}

/** Returns the token just after the current one, without consuming anything. */
function peekNext(): Token | undefined {
  return tokens[current + 1];
}

/** Returns the current token AND moves to the next one. */
function advance(): Token {
  const token = tokens[current];
  current++;
  return token;
}

/** True when all tokens have been read. */
function isAtEnd(): boolean {
  return current >= tokens.length;
}

/** Is the current token of this type (and, if given, this exact value)? */
function check(type: string, value?: string): boolean {
  const token = peek();
  if (token === undefined) return false;
  if (token.type !== type) return false;
  if (value !== undefined && token.value !== value) return false;
  return true;
}

/** If the current token matches, consume it and return it. Otherwise undefined. */
function match(type: string, value?: string): Token | undefined {
  if (check(type, value)) {
    return advance();
  }
  return undefined;
}

/** Requires the current token to match, otherwise reports a syntax error. */
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

/**
 * Creates one AST node. Every node gets its own id.
 *
 * `token` is the token the node was built from. Its line and column are copied
 * onto the node so that the semantic analyser can report where a problem is.
 */
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

/** True when the current token is one of the type keywords. */
function isTypeKeyword(): boolean {
  return (
    check('KEYWORD', 'int') ||
    check('KEYWORD', 'float') ||
    check('KEYWORD', 'bool') ||
    check('KEYWORD', 'char')
  );
}

/* ------------------------------------------------------------------ */
/* Statements                                                          */
/* ------------------------------------------------------------------ */

/**
 * The entry point: turns the token list into an AST.
 * Throws an Error (with line and column) if the tokens are not valid.
 */
export function buildAST(inputTokens: Token[]): ASTNode {
  tokens = inputTokens;
  current = 0;
  nextId = 0;
  return parseProgram();
}

/** program -> mainFunction */
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

/** mainFunction -> "int" "main" "(" ")" block */
function parseMainFunction(): ASTNode {
  expect('KEYWORD', 'int');
  expect('IDENTIFIER', 'main');
  expect('DELIMITER', '(');
  expect('DELIMITER', ')');
  const body = parseBlock();
  return node('MainFunction', [body]);
}

/** block -> "{" statement* "}" */
function parseBlock(): ASTNode {
  expect('DELIMITER', '{');

  const statements: ASTNode[] = [];
  while (!isAtEnd() && !check('DELIMITER', '}')) {
    statements.push(parseStatement());
  }

  expect('DELIMITER', '}');
  return node('Block', statements);
}

/** Chooses which kind of statement starts here by looking at the current token. */
function parseStatement(): ASTNode {
  if (isTypeKeyword()) return parseVariableDeclaration();
  if (check('KEYWORD', 'if')) return parseIfStatement();
  if (check('KEYWORD', 'return')) return parseReturnStatement();
  if (check('DELIMITER', '{')) return parseBlock();

  if (check('IDENTIFIER')) {
    // "x++;" and "x--;" are increments, anything else is an assignment.
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

/**
 * variableDeclaration -> type IDENTIFIER ";"
 *                      | type IDENTIFIER "=" expression ";"
 *
 * The declared type is kept as the node's value, e.g. VariableDeclaration "int".
 */
function parseVariableDeclaration(): ASTNode {
  const typeToken = advance(); // int / float / bool / char
  const nameToken = expect('IDENTIFIER');

  const children: ASTNode[] = [node('Identifier', [], nameToken.value, nameToken)];

  if (match('OPERATOR', '=') !== undefined) {
    children.push(parseExpression());
  }

  expect('DELIMITER', ';');
  return node('VariableDeclaration', children, typeToken.value, nameToken);
}

/** assignment -> IDENTIFIER "=" expression ";" */
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

/** "x++" or "x--" - stored as a UnaryExpression holding the variable. */
function parseIncrement(): ASTNode {
  const nameToken = expect('IDENTIFIER');
  const operator = advance(); // ++ or --
  return node('UnaryExpression', [node('Identifier', [], nameToken.value, nameToken)], operator.value, operator);
}

/**
 * ifStatement -> "if" "(" expression ")" statement ( "else" statement )?
 *
 * Children: condition, then-branch, and the else-branch when there is one.
 */
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

/** returnStatement -> "return" expression ";" */
function parseReturnStatement(): ASTNode {
  expect('KEYWORD', 'return');
  const value = parseExpression();
  expect('DELIMITER', ';');
  return node('ReturnStatement', [value]);
}

/* ------------------------------------------------------------------ */
/* Expressions                                                         */
/*                                                                     */
/* One function per precedence level. Each level builds the level BELOW */
/* it first, so operators that bind tighter end up deeper in the tree.  */
/* That is the whole of the precedence handling - there is no table.    */
/*                                                                     */
/*   expression -> logicalOr -> logicalAnd -> equality -> relational    */
/*   -> additive -> multiplicative -> unary -> primary                  */
/* ------------------------------------------------------------------ */

/** expression -> logicalOr */
function parseExpression(): ASTNode {
  return parseLogicalOr();
}

/** logicalOr -> logicalAnd ( "||" logicalAnd )* */
function parseLogicalOr(): ASTNode {
  let left = parseLogicalAnd();
  while (check('OPERATOR', '||')) {
    const operator = advance();
    const right = parseLogicalAnd();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

/** logicalAnd -> equality ( "&&" equality )* */
function parseLogicalAnd(): ASTNode {
  let left = parseEquality();
  while (check('OPERATOR', '&&')) {
    const operator = advance();
    const right = parseEquality();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

/** equality -> relational ( ( "==" | "!=" ) relational )* */
function parseEquality(): ASTNode {
  let left = parseRelational();
  while (check('OPERATOR', '==') || check('OPERATOR', '!=')) {
    const operator = advance();
    const right = parseRelational();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

/** relational -> additive ( ( ">" | "<" | ">=" | "<=" ) additive )* */
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

/** additive -> multiplicative ( ( "+" | "-" ) multiplicative )* */
function parseAdditive(): ASTNode {
  let left = parseMultiplicative();
  while (check('OPERATOR', '+') || check('OPERATOR', '-')) {
    const operator = advance();
    const right = parseMultiplicative();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

/** multiplicative -> unary ( ( "*" | "/" | "%" ) unary )* */
function parseMultiplicative(): ASTNode {
  let left = parseUnary();
  while (check('OPERATOR', '*') || check('OPERATOR', '/') || check('OPERATOR', '%')) {
    const operator = advance();
    const right = parseUnary();
    left = node('BinaryExpression', [left, right], operator.value, operator);
  }
  return left;
}

/** unary -> ( "!" | "-" | "++" | "--" ) unary | primary */
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

/**
 * primary -> IDENTIFIER | IDENTIFIER ("++"|"--") | literal | "(" expression ")"
 *
 * Brackets only group the expression, so they disappear from the AST: the
 * expression inside them is returned directly.
 */
function parsePrimary(): ASTNode {
  if (match('DELIMITER', '(') !== undefined) {
    const inner = parseExpression();
    expect('DELIMITER', ')');
    return inner;
  }

  if (check('IDENTIFIER')) {
    const nameToken = advance();
    // a postfix increment inside an expression, e.g. "average++"
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
