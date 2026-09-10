-- Add duplicate-prevention columns + unique constraints.
-- nameKey is backfilled with the exact JS normalization used by
-- src/lib/dedupe.ts so the column and the application always agree.

ALTER TABLE "Celebrity" ADD COLUMN "nameKey" TEXT;
ALTER TABLE "Celebrity" ADD COLUMN "profileImageHash" TEXT;
ALTER TABLE "Celebrity" ADD COLUMN "coverImageHash" TEXT;

UPDATE "Celebrity" SET "nameKey" = CASE "id"
  WHEN 'cmts7jjzm0011to88d6d6wdsc' THEN 'cristianoronaldo'
  WHEN 'cmts7rjtg005xtoxwa381dzva' THEN 'johnnydepp'
  WHEN 'cmts7nq7f000stoxw1ivddszs' THEN 'viratkohli'
  WHEN 'cmts7kcbq0022to88st02v551' THEN 'beyonce'
  WHEN 'cmts7ogx6001ttoxwwekfswys' THEN 'dwaynejohnson'
  WHEN 'cmts7paxo002utoxwl5qn0wyq' THEN 'selenagomez'
  WHEN 'cmts7gsgw0000to88dchaim8u' THEN 'taylorswift'
  WHEN 'cmts7pzp7003vtoxwscn75g1a' THEN 'lionelmessi'
  WHEN 'cmts7qv1e004wtoxw6ba8w1wb' THEN 'billieeilish'
  WHEN 'cmtv58gf40000le048paferjr' THEN 'tomcruise'
  WHEN 'cmtv8o4990000ky04rq5w2bil' THEN 'pierobarone'
  WHEN 'cmtv8ri8l000zky041e2hcke2' THEN 'jasonstatham'
  ELSE "nameKey" END
WHERE "nameKey" IS NULL;

ALTER TABLE "Celebrity" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX "Celebrity_nameKey_key" ON "Celebrity"("nameKey");
CREATE UNIQUE INDEX "Celebrity_profileImageHash_key" ON "Celebrity"("profileImageHash");
CREATE UNIQUE INDEX "Celebrity_coverImageHash_key" ON "Celebrity"("coverImageHash");

-- A fan can hold at most one card per celebrity community.
CREATE UNIQUE INDEX "FanCard_fanId_celebrityId_key" ON "FanCard"("fanId","celebrityId");

-- A gateway charge reference can never settle more than one payment/order.
CREATE UNIQUE INDEX "Payment_gatewayRef_key" ON "Payment"("gatewayRef");
CREATE UNIQUE INDEX "TicketOrder_paymentRef_key" ON "TicketOrder"("paymentRef");
