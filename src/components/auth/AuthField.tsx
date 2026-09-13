import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Native-style auth input: floating label, leading icon, optional trailing
 * control (password visibility toggle), iOS-like rounded field, safe focus
 * ring. Consistent on every auth screen.
 */
interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: ReactNode;
  after?: ReactNode;
  hint?: string;
}

export default function AuthField({ id, label, icon, after, hint, className = "", ...props }: AuthFieldProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">{icon}</span>
        )}
        <input
          id={id}
          {...props}
          className={`h-[52px] w-full rounded-2xl border border-white/10 bg-white/[0.06] text-[15px] text-white outline-none transition placeholder:text-zinc-500 focus:border-primary-500/70 focus:bg-white/[0.09] focus:ring-4 focus:ring-primary-500/15 ${
            icon ? "pl-11" : "pl-4"
          } ${after ? "pr-12" : "pr-4"} ${className}`}
        />
        {after && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{after}</span>}
      </div>
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}