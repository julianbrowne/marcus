// What the harness (ordinary code) did with a tool token the chain predicted
export default function HarnessCall({call}) {
  return (
    <span className={`harness ${call.ok ? 'ok' : 'failed'}`} role="note" aria-label="harness">
      <span className="harness-label">harness (code, not the chain)</span>
      <span>token <code>{call.token}</code> → tool <code>{call.tool}</code>, argument <code>{call.argument || '—'}</code></span>
      <span>{call.message}</span>
      <span>result: <code>{call.result}</code>{call.ok && ' (fills the NUM placeholders that follow)'}</span>
    </span>
  );
}
