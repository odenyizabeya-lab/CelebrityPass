-- AddName: index on Celebrity.name to accelerate prefix ("startsWith") and
-- ordered-name lookups for live homepage autocomplete search.
CREATE INDEX "Celebrity_name_idx" ON "Celebrity"("name");