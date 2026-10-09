/**
 * Symbol table and scopes for semantic analysis.
 *
 * HOW SCOPES WORK HERE
 * --------------------
 * The table is a stack of scopes. Entering a block pushes a new scope, leaving
 * it pops that scope off again:
 *
 *   main                <- pushed when main() starts
 *   main.block1         <- pushed when an inner { ... } starts
 *
 * Looking a name up starts at the TOP of the stack (the innermost scope) and
 * walks outwards, which is what makes shadowing work: the nearest declaration
 * is the one that is found.
 *
 * Popping a scope removes its names from the lookup, so a variable declared
 * inside a block is not visible outside it. The symbol is still kept in
 * `allSymbols` so the UI can show the full table after the analysis.
 */

import type { DataType, Symbol } from './semanticTypes';

interface Scope {
  name: string;
  /** The variables declared in this scope, keyed by name. */
  symbols: Map<string, Symbol>;
}

export class SymbolTable {
  /** The scopes that are currently open. The last one is the innermost. */
  private scopes: Scope[] = [];

  /** Every symbol ever declared, in the order it was declared, for display. */
  private allSymbols: Symbol[] = [];

  /** Used to give inner blocks the names block1, block2, ... */
  private blockCount = 0;

  /** Opens a new scope with this exact name, e.g. "main". */
  enterScope(name: string) {
    this.scopes.push({ name, symbols: new Map() });
  }

  /** Opens a new inner block scope, e.g. "main.block1". */
  enterBlockScope() {
    this.blockCount++;
    this.enterScope(`${this.currentScopeName()}.block${this.blockCount}`);
  }

  /** Closes the innermost scope. Its variables stop being visible. */
  exitScope() {
    this.scopes.pop();
  }

  /** The name of the scope we are in right now. */
  currentScopeName(): string {
    if (this.scopes.length === 0) return 'global';
    return this.scopes[this.scopes.length - 1].name;
  }

  /** Is this name already declared in the CURRENT scope? */
  isDeclaredInCurrentScope(name: string): boolean {
    if (this.scopes.length === 0) return false;
    return this.scopes[this.scopes.length - 1].symbols.has(name);
  }

  /** Adds a variable to the current scope and to the table shown in the UI. */
  declare(name: string, type: DataType) {
    const symbol: Symbol = { name, type, scope: this.currentScopeName() };
    this.scopes[this.scopes.length - 1].symbols.set(name, symbol);
    this.allSymbols.push(symbol);
  }

  /**
   * Finds a variable, searching from the innermost scope outwards.
   * Returns undefined when the name has not been declared anywhere.
   */
  lookup(name: string): Symbol | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const found = this.scopes[i].symbols.get(name);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  /** Every symbol that was declared, for the Symbol Table view. */
  getSymbols(): Symbol[] {
    return this.allSymbols;
  }
}
