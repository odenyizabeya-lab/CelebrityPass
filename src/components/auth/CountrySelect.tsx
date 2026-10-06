"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  countryOptions,
  searchCountryOptions,
  countryIndexLetters,
  countryFlagEmoji,
  type CountryOption,
} from "@/lib/countries";
import { GlobeIcon } from "@/components/auth/AuthIcons";

/**
 * Professional country selector.
 *
 * Replaces the old free-text "Country" input: the user taps a field, a
 * full-screen searchable list opens, and the chosen country is echoed back in
 * the field. Free typing is impossible, so the value stored on the account is
 * always a canonical country name from the platform's own list — which is what
 * `/api/auth/register` now validates against.
 *
 * Localised through `Intl.DisplayNames` (see `@/lib/countries`) with a safe
 * English fallback, so the list reads natively in every supported language
 * without a hand-maintained translation table.
 *
 * Android/WebView notes: the sheet is a plain `position: fixed` overlay (no
 * portal, no transition library), body scroll is locked while open and always
 * restored on unmount, Escape/backdrop taps close it, and focus returns to the
 * trigger. Every listener is removed in the effect cleanup so navigating away
 * mid-animation can never leave the page unscrollable.
 */
export default function CountrySelect({
  id,
  label,
  locale,
  placeholder,
  searchPlaceholder,
  required = true,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  id: string;
  label: string;
  locale?: string;
  placeholder: string;
  searchPlaceholder: string;
  required?: boolean;
  value: string;
  onChange: (country: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();

  const all = useMemo(() => countryOptions(locale), [locale]);
  const results = useMemo(() => searchCountryOptions(all, query), [all, query]);
  const letters = useMemo(() => countryIndexLetters(all), [all]);
  // Alphabetical sections, so the A–Z index has something to scroll to.
  const grouped = useMemo(() => {
    const buckets = new Map<string, CountryOption[]>();
    for (const option of results) {
      const letter = option.label.trim().charAt(0).toUpperCase() || "#";
      const bucket = buckets.get(letter);
      if (bucket) bucket.push(option);
      else buckets.set(letter, [option]);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [results]);
  const selected = useMemo(
    () => all.find((option) => option.value === value) ?? null,
    [all, value],
  );

  const close = useCallback(() => setOpen(false), []);

  // Open: focus the search box and lock page scroll. State resets happen in the
  // trigger handler, not here, so this effect only touches external systems.
  const openSheet = useCallback(() => {
    setQuery("");
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 60);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      // Always restore, even if the screen is being destroyed.
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  // Close: hand focus back to the field that opened the sheet.
  useEffect(() => {
    if (open) return;
    triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  const choose = (option: CountryOption) => {
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-zinc-300">
        {label}
      </label>

      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onClick={openSheet}
        className={`flex h-[52px] w-full items-center gap-3 rounded-2xl border bg-white/[0.06] px-4 text-left text-base text-white outline-none transition focus:ring-4 focus:ring-primary-500/15 ${
          selected
            ? "border-white/10 focus:border-primary-500/70 focus:bg-white/[0.09]"
            : invalid
              ? "border-rose-500/60 bg-rose-500/[0.06]"
              : "border-white/10 hover:border-white/20"
        }`}
      >
        <span className="pointer-events-none shrink-0 text-zinc-500">
          <GlobeIcon />
        </span>
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {selected.code && (
              <span aria-hidden className="text-lg leading-none">
                {countryFlagEmoji(selected.code)}
              </span>
            )}
            <span className="min-w-0 truncate font-medium">{selected.label}</span>
          </span>
        ) : (
          <span className={`min-w-0 flex-1 truncate ${invalid ? "text-rose-200" : "text-zinc-500"}`}>
            {placeholder}
          </span>
        )}
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/70 backdrop-blur-sm"
          role="presentation"
          onClick={close}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            className="mt-auto flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-ink-900 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-2.5" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-3">
              <h2 className="text-lg font-black tracking-tight text-white">{label}</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-zinc-300 transition hover:bg-white/[0.12] hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-5">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                  </svg>
                </span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-controls={listId}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-11 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-primary-500/70 focus:ring-4 focus:ring-primary-500/15"
                />
              </div>
            </div>

            {/* A–Z quick index (hidden while searching) */}
            {!query && (
              <div className="mt-3 flex flex-wrap gap-1 px-5">
                {letters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => {
                      const target = document.getElementById(`${listId}-${letter}`);
                      target?.scrollIntoView({ block: "start", behavior: "smooth" });
                    }}
                    className="h-7 min-w-7 rounded-lg bg-white/[0.05] px-1.5 text-[11px] font-bold text-zinc-400 transition hover:bg-white/[0.12] hover:text-white"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
            >
              {results.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-zinc-500">
                  No country matches “{query}”.
                </p>
              ) : (
                grouped.map(([letter, group]) => (
                  <div key={letter}>
                    <p
                      id={`${listId}-${letter}`}
                      className="sticky top-0 z-10 bg-ink-900/95 px-3 py-1.5 text-[11px] font-black tracking-widest text-zinc-500 backdrop-blur"
                    >
                      {letter}
                    </p>
                    {group.map((option) => {
                      const isSelected = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => choose(option)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] ${
                            isSelected ? "bg-primary-600/15" : "hover:bg-white/[0.06]"
                          }`}
                        >
                          {option.code ? (
                            <span aria-hidden className="w-7 shrink-0 text-xl leading-none">
                              {countryFlagEmoji(option.code)}
                            </span>
                          ) : (
                            <span aria-hidden className="w-7 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-[15px] ${isSelected ? "font-bold text-white" : "text-zinc-200"}`}
                            >
                              {option.label}
                            </span>
                            {option.label !== option.value && (
                              <span className="block truncate text-[12px] text-zinc-500">
                                {option.value}
                              </span>
                            )}
                          </span>
                          {isSelected && (
                            <svg
                              className="h-5 w-5 shrink-0 text-primary-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              aria-hidden
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <p className="px-5 pt-1 text-center text-[11px] text-zinc-600">
              {results.length} of {all.length} countries
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
