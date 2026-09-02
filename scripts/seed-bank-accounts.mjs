// Seeds the initial admin-managed bank accounts (one per supported currency).
// All of these are KENNETH CHIDERA ODENYI / Citibank accounts. The admin can
// later add/edit/remove them all from the admin panel — this is only the initial
// seed. Re-running is idempotent.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ACCOUNTS = [
  {
    currency: "USD",
    countryName: "United States",
    countryFlag: "🇺🇸",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank",
    accountType: "Checking",
    accountNumber: "20000126899627",
    swift: "CITIUS33",
    bic: "CITIUS33",
    routing: "021000089",
    transferType: "Local transfer (ACH / Wire)",
    bankAddress: "388 Greenwich Street, New York, NY 10013, United States",
  },
  {
    currency: "EUR",
    countryName: "United Kingdom (EUR clearing)",
    countryFlag: "🇬🇧",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank London",
    accountType: "Checking",
    iban: "GB33CITI18500820000126899624",
    bic: "CITIGB2L",
    swift: "CITIGB2L",
    sortCode: "18-50-08",
    transferType: "SEPA / SWIFT",
    bankAddress: "1 Canada Square, London E14 5LB, United Kingdom",
  },
  {
    currency: "GBP",
    countryName: "United Kingdom",
    countryFlag: "🇬🇧",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank London",
    accountType: "Current",
    accountNumber: "20000126899624",
    bic: "CITIGB2L",
    swift: "CITIGB2L",
    sortCode: "18-50-08",
    transferType: "UK Faster Payments / SWIFT",
    bankAddress: "1 Canada Square, London E14 5LB, United Kingdom",
  },
  {
    currency: "CAD",
    countryName: "Canada",
    countryFlag: "🇨🇦",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank Canada",
    accountType: "Chequing",
    accountNumber: "20000126899623",
    swift: "CITICATT",
    bic: "CITICATT",
    institutionNumber: "010",
    transitNumber: "20384",
    transferType: "Domestic wire / SWIFT",
    bankAddress: "1 Toronto Street, 12th Floor, Toronto, ON M5C 2W3, Canada",
  },
  {
    currency: "AUD",
    countryName: "Australia",
    countryFlag: "🇦🇺",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank Australia",
    accountType: "Everyday",
    accountNumber: "20000126899622",
    swift: "CITIAU2X",
    bic: "CITIAU2X",
    branchCode: "242-000",
    transferType: "Domestic transfer / SWIFT",
    bankAddress: "2 Park Street, Sydney NSW 2000, Australia",
  },
  {
    currency: "JPY",
    countryName: "Japan",
    countryFlag: "🇯🇵",
    beneficiary: "ペイオニア ジヤパン(カ",
    bankName: "MUFG Bank",
    accountType: null,
    accountNumber: "20000126899625",
    swift: "CITIJPJT",
    bic: "CITIJPJT",
    branchCode: "251",
    transferType: "Domestic / SWIFT",
    bankAddress: "7-1 Marunouchi 2-chome, Chiyoda-ku, Tokyo 100-8330, Japan",
  },
  {
    currency: "SGD",
    countryName: "Singapore",
    countryFlag: "🇸🇬",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank Singapore",
    accountType: null,
    accountNumber: "20000126899626",
    swift: "CITISGSG",
    bic: "CITISGSG",
    bankCode: "7214",
    branchCode: "001",
    transferType: "FAST / SWIFT",
    bankAddress: "Marina Bay Financial Centre, 8 Marina Boulevard, Singapore 018981",
  },
  {
    currency: "IDR",
    countryName: "Indonesia",
    countryFlag: "🇮🇩",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank Indonesia",
    accountType: null,
    accountNumber: "20000126899621",
    swift: "CITIIDJX",
    bic: "CITIIDJX",
    transferType: "Local transfer / SWIFT",
    bankAddress: "Citibank Tower, Pacific Place, Jl. Jend. Sudirman Kav 52-53, Jakarta 12190, Indonesia",
  },
  {
    currency: "MXN",
    countryName: "Mexico",
    countryFlag: "🇲🇽",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibanamex",
    accountType: null,
    accountNumber: "20000126899620",
    swift: "CITIMXMX",
    bic: "CITIMXMX",
    branchCode: "1966",
    transferType: "SPEI / SWIFT",
    bankAddress: "San Jerónimo 194, C.P. 01040 Ciudad de México, Mexico",
  },
];

async function main() {
  for (const a of ACCOUNTS) {
    const { currency, ...data } = a;
    await prisma.bankAccount.upsert({
      where: { currency },
      create: { currency, displayOrder: 0, ...data },
      update: data,
    });
  }
  const count = await prisma.bankAccount.count();
  console.log(`Seeded ${ACCOUNTS.length} bank accounts. Total in DB: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());