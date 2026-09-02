export default function EmptyState({
  title = "Nothing here yet",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="glass rounded-2xl border-dashed px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.05] ring-1 ring-white/10">
        <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.182 16.318A4.486 4.486 0 0012 14.99c-1.312 0-2.494.56-3.303 1.464M6.75 12h.008v.008H6.75V12zm12 0h.008v.008h-.008V12zM12 3a9 9 0 100 18 9 9 0 000-18z"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 max-w-sm mx-auto text-sm text-zinc-400">{message}</p>
    </div>
  );
}