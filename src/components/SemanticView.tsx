import type { SemanticResult } from '../semantic/semanticTypes';

interface SemanticViewProps {
  result: SemanticResult | null;
  astError: string | null;
}

export function SemanticView({ result, astError }: SemanticViewProps) {
  if (astError !== null) {
    return (
      <div className="errors">
        <strong>Cannot run semantic analysis.</strong>
        <p>The code must build an AST first. {astError}</p>
      </div>
    );
  }

  if (result === null) {
    return <p className="empty-note">No semantic analysis yet.</p>;
  }

  const { symbols, errors } = result;

  return (
    <div className="semantic-view">
      <h3>Semantic Result</h3>

      {errors.length === 0 ? (
        <p className="semantic-ok">No semantic errors found</p>
      ) : (
        <div className="errors">
          <strong>
            {errors.length} semantic error{errors.length === 1 ? '' : 's'}
          </strong>
          <ul>
            {errors.map((error, i) => (
              <li key={i}>
                {error.line !== undefined && <span className="error-place">Line {error.line}: </span>}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Symbol Table</h3>

      {symbols.length === 0 ? (
        <p className="empty-note">No variables declared.</p>
      ) : (
        <table className="token-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map((symbol, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="mono">{symbol.name}</td>
                <td>{symbol.type}</td>
                <td className="mono">{symbol.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
