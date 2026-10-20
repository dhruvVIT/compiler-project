import type { DataType, Symbol } from './semanticTypes';

interface Scope {
  name: string;
  symbols: Map<string, Symbol>;
}

export class SymbolTable {
  private scopes: Scope[] = [];

  private allSymbols: Symbol[] = [];

  private blockCount = 0;

  enterScope(name: string) {
    this.scopes.push({ name, symbols: new Map() });
  }

  enterBlockScope() {
    this.blockCount++;
    this.enterScope(`${this.currentScopeName()}.block${this.blockCount}`);
  }

  exitScope() {
    this.scopes.pop();
  }

  currentScopeName(): string {
    if (this.scopes.length === 0) return 'global';
    return this.scopes[this.scopes.length - 1].name;
  }

  isDeclaredInCurrentScope(name: string): boolean {
    if (this.scopes.length === 0) return false;
    return this.scopes[this.scopes.length - 1].symbols.has(name);
  }

  declare(name: string, type: DataType) {
    const symbol: Symbol = { name, type, scope: this.currentScopeName() };
    this.scopes[this.scopes.length - 1].symbols.set(name, symbol);
    this.allSymbols.push(symbol);
  }

  lookup(name: string): Symbol | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const found = this.scopes[i].symbols.get(name);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  getSymbols(): Symbol[] {
    return this.allSymbols;
  }
}
