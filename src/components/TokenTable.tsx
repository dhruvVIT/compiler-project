import type { Token } from '../types/compiler';

interface TokenTableProps {
  tokens: Token[];
}

export function TokenTable({ tokens }: TokenTableProps) {
  if (tokens.length === 0) {
    return <p className="empty-note">No tokens generated yet.</p>;
  }

  return (
    <table className="token-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Type</th>
          <th>Value</th>
          <th>Line</th>
          <th>Column</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{token.type}</td>
            <td className="mono">{token.value}</td>
            <td>{token.line}</td>
            <td>{token.column}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
