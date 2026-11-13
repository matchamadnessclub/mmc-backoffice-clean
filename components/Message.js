export default function Message({ msg }) {
  if (!msg) return null;
  const ok = msg.type === 'ok';
  return (
    <div
      className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
        ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-red-300 bg-red-50 text-red-800'
      }`}
    >
      {msg.text}
    </div>
  );
}
