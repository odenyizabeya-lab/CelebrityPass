-- Add per-fan interface language preference.
-- NULL means "automatic / device language". A manual choice is never
-- overwritten by auto detection; it only seeds new devices on first sign-in.
ALTER TABLE "Fan" ADD COLUMN "preferredLocale" TEXT;
