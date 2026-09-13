/** Shared link / button classes for the native auth screens. */

export const appScreenLinkClass = "font-semibold text-primary-400 transition hover:text-primary-300";

export const appPrimaryButtonClass =
  "btn-grad flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-xl shadow-primary-600/25 transition disabled:cursor-not-allowed disabled:opacity-60";

export const appSecondaryButtonClass =
  "flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60";

export const appErrorBannerClass =
  "app-screen-fade mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300";

export const appSuccessBannerClass =
  "app-screen-fade mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";