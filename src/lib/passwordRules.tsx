export const PASSWORD_RULES = [
  { label: "8 to 50 characters", ok: (p: string) => p.length >= 8 && p.length <= 50 },
  { label: "An uppercase letter", ok: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", ok: (p: string) => /[a-z]/.test(p) },
  { label: "A number", ok: (p: string) => /[0-9]/.test(p) },
  { label: "A special character (! @ # $ %)", ok: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordValid(p: string) {
  return PASSWORD_RULES.every((r) => r.ok(p));
}

// optional: for edit windows, where a blank password means "keep the current one"
export function PasswordChecklist({ password, optional = false }: { password: string; optional?: boolean }) {
  if (optional && !password) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2">
      {PASSWORD_RULES.map((r) => {
        const ok = r.ok(password);
        return (
          <li key={r.label} className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-green-600" : "text-gray-400"}`}>
            <span
              aria-hidden="true"
              className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] leading-none ${ok ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
            >
              {ok ? "✓" : "•"}
            </span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}