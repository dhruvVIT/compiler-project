# CompilerViz

Interactive Compiler Visualization Tools — a browser-based teaching aid that shows
what a compiler does to a program written in a controlled subset of C++.

Everything runs in the browser. There is no backend, no database and no API.

## Current status: Phase 3 — Semantic Analysis + Symbol Table

| Stage | Status |
| --- | --- |
| Source | implemented |
| Tokens (Lexical Analysis) | implemented |
| AST | implemented |
| Semantic Analysis + Symbol Table | implemented |
| IR | later phase |
| Optimization | later phase |

The stages marked "later phase" appear in the navigation bar as disabled items.
They produce no output at all — there is deliberately no placeholder or fake data.

## Running the project

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check (tsc -b) and produce a production build
npm run preview  # serve the production build
npm run lint
```

## How to use it

1. Edit the C++ code in the Monaco editor on the left.
2. Press **Analyze Code**.
3. The Tokens stage shows the token stream, with each token's type, value, line
   and column.
4. The AST stage shows the Abstract Syntax Tree as a diagram. It updates
   whenever the source changes, so no extra button is needed.
5. The Semantic Analysis stage lists any semantic errors and shows the symbol
   table (name, type and scope of every declared variable).

## Project structure

```
src/
├── components/
│   ├── CodeEditor.tsx   Monaco editor wrapper (C++ syntax highlighting)
│   ├── TokenTable.tsx   renders the Token[] returned by the lexer
│   ├── ASTViewer.tsx    draws the AST with React Flow
│   ├── SemanticView.tsx errors + symbol table
│   └── StageTabs.tsx    compiler stage navigation
├── compiler/
│   └── lexer.ts         tokenize() — source text to Token[]
├── ast/
│   ├── astTypes.ts      the ASTNode interface
│   └── astBuilder.ts    buildAST()  — Token[] straight to an AST
├── semantic/
│   ├── semanticTypes.ts Symbol, SemanticError, SemanticResult
│   ├── symbolTable.ts   the scope stack
│   └── analyzer.ts      analyzeSemantics() — AST to a SemanticResult
├── types/
│   └── compiler.ts      shared Token and token type definitions
├── App.tsx
├── main.tsx
└── index.css
```

## The language subset

* **Keywords:** `int float bool char if else return true false`
* **Identifiers:** start with a letter or `_`, then letters, digits or `_`
* **Literals:** integers (`10`), floats (`3.14`), characters (`'a'`)
* **Operators:** `+ - * / %`, `> < >= <= == !=`, `&& || !`, `++ --`, `=`
* **Delimiters:** `( ) { } [ ] ; ,`
* **Comments:** `// line` and `/* block */` — ignored, but line numbers stay correct
* **Statements:** declarations, assignments, expressions, `if`, `if`/`else`, `return`
  — there are no loops

## Lexer API

```ts
import { tokenize } from './compiler/lexer';

tokenize(source); // Token[]
```

Error reporting is not part of this phase. A character that is not in the
supported subset is simply skipped, and the lexer never throws.

Note that a missing semicolon is a *syntax* error, not a lexical one — the lexer
tokenizes such a program without complaint. Syntax checking arrives with the parser
in a later phase.

## AST (Phase 2)

```ts
import { buildAST } from './ast/astBuilder';

const ast = buildAST(tokens); // ASTNode
```

There is **no parse tree**. The token list is turned straight into an AST by a
recursive-descent builder: each function reads the tokens it expects and returns
the AST node for them. Punctuation that only helps the parser — `;` `,` `(` `)`
`{` `}` and the `=` of a declaration — is consumed but never stored, which is
what makes the result abstract rather than a concrete syntax tree.

Expressions use one function per precedence level:

```
expression -> logicalOr -> logicalAnd -> equality -> relational
           -> additive -> multiplicative -> unary -> primary
```

Each level parses the level below it first, so tighter-binding operators end up
deeper in the tree. `a + b * 2` therefore becomes `+` with `*` as its right
child. There is no precedence table.

`buildAST` throws an `Error` naming the line and column when the tokens do not
fit the language; the UI shows "Unable to build AST." together with the message.
The builder is plain TypeScript and does not import React.

## Semantic analysis (Phase 3)

```ts
import { analyzeSemantics } from './semantic/analyzer';

const result = analyzeSemantics(ast); // { symbols, errors }
```

The analyser walks the AST and never looks at the source text or the tokens.
Errors are collected rather than thrown, so one program can report several
problems at once.

Checks performed: duplicate declaration, use of an undeclared variable,
assignment compatibility, operand types for arithmetic / comparison / logical /
unary operators, an `if` condition must be `bool`, and the `return` value must
fit main's `int` return type.

Type rules are deliberately simple: the two types must match, except that an
`int` may be stored in a `float`. Arithmetic on an `int` and a `float` produces a
`float`; every comparison produces a `bool`.

Scopes are a stack. `main` is pushed for the function body and `main.block1`,
`main.block2`, ... for nested blocks. A lookup starts at the innermost scope and
walks outwards, which is what makes shadowing work.
