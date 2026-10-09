/**
 * Types for semantic analysis (Phase 3).
 *
 * The analyser reads the AST and produces one SemanticResult: the symbol table
 * it built and the list of problems it found.
 */

/** The types our controlled C++ subset understands. */
export type DataType = 'int' | 'float' | 'bool' | 'char';

/**
 * "unknown" is used when the analyser cannot work out a type, for example the
 * type of a variable that was never declared. It stops one mistake from
 * producing a second, misleading error further up the expression.
 */
export type ExpressionType = DataType | 'unknown';

/** One entry of the symbol table. */
export interface Symbol {
  name: string;
  type: DataType;
  scope: string;
}

/** One problem found during semantic analysis. */
export interface SemanticError {
  message: string;
  line?: number;
  column?: number;
}

/** Everything the analyser produces. */
export interface SemanticResult {
  symbols: Symbol[];
  errors: SemanticError[];
}
