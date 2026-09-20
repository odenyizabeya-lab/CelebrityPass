import { prisma } from "@/lib/db";

export const ATM_INSTRUCTIONS_SETTING = "invest.atm.instructions";
export const ATM_REF_PREFIX = "INVATM";

/** Default ATM deposit instructions shown to investors (override from admin). */
export const DEFAULT_ATM_INSTRUCTIONS =
  "1. Use any ATM machine to deposit cash (or a cheque) into the bank account shown below. " +
  "2. Choose 'Cash deposit (no card)' and enter the account number exactly. " +
  "3. Keep the ATM receipt — it shows your ATM transaction/reference number. " +
  "4. Enter that reference below and upload a photo of the ATM slip. " +
  "Your deposit is credited only after our team verifies the ATM transaction.";

/** Admin-configured ATM deposit instructions for the investor flow. */
export async function getAtmInstructions(): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: ATM_INSTRUCTIONS_SETTING } });
  return row?.value?.trim() || DEFAULT_ATM_INSTRUCTIONS;
}

/** Update the admin-configured ATM deposit instructions (empty = default). */
export async function setAtmInstructions(value: string): Promise<void> {
  const v = value.trim();
  if (!v || v === DEFAULT_ATM_INSTRUCTIONS) {
    await prisma.appSetting.deleteMany({ where: { key: ATM_INSTRUCTIONS_SETTING } });
    return;
  }
  await prisma.appSetting.upsert({
    where: { key: ATM_INSTRUCTIONS_SETTING },
    create: { key: ATM_INSTRUCTIONS_SETTING, value: v },
    update: { value: v },
  });
}