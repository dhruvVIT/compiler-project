/**
 * AST types for CompilerViz (Phase 2).
 *
 * The whole tree is made of one kind of object. A node knows what it is
 * (`type`), an optional piece of text (`value`, e.g. an operator or a name)
 * and the nodes below it (`children`).
 *
 * Node types used by the builder:
 *
 *   Program              the root
 *   MainFunction         int main() { ... }
 *   Block                a { ... } group of statements
 *   VariableDeclaration  value = the declared type, e.g. "int"
 *   Assignment           x = expression
 *   IfStatement          condition, then-block, optional else-block
 *   ReturnStatement      the returned expression
 *   BinaryExpression     value = the operator, e.g. "+"
 *   UnaryExpression      value = the operator, e.g. "!" or "++"
 *   Identifier           value = the name
 *   Literal              value = the literal text, e.g. "10" or "true"
 */

export interface ASTNode {
  id: string;
  type: string;
  value?: string;
  children: ASTNode[];
  /**
   * Where this node started in the source. Taken from the token the node was
   * built from, so later phases (semantic analysis) can report the position of
   * an error without looking at the source text again.
   */
  line?: number;
  column?: number;
}
