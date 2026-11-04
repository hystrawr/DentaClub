/**
 * Starter data: the appointment types (services), one clinic, two chairs, and
 * two dentists working Mon–Sat 08:00–12:00 and 13:00–17:00.
 *
 * Safe to run twice: each part is skipped if its data already exists.
 *
 *   npm run db:seed
 */
import { prisma } from "../src/lib/prisma.js";

async function main() {
  await seedScheduling();
}

/** The starter services: name, minutes, color, block time. */
const APPOINTMENT_TYPES: ReadonlyArray<[string, number, string, boolean]> = [
  ["Recall / Cleaning", 45, "#10B981", false],
  ["New Patient Exam", 60, "#3B82F6", false],
  ["Restorative", 60, "#F59E0B", false],
  ["Root Canal", 90, "#EF4444", false],
  ["Extraction", 45, "#8B5CF6", false],
  ["Ortho Adjustment", 30, "#EC4899", false],
  ["Emergency", 30, "#DC2626", false],
  ["Lunch Break", 60, "#9CA3AF", true],
];

// `@db.Time` columns are stored as a time on 1970-01-01 UTC.
const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

async function seedScheduling() {
  if ((await prisma.location.count()) > 0) {
    console.log("Scheduling data already exists — skipped.");
    return;
  }

  for (const [name, durationMinutes, colorHex, isBlockTime] of APPOINTMENT_TYPES) {
    await prisma.appointmentType.create({
      data: { name, durationMinutes, colorHex, isBlockTime },
    });
  }

  const clinic = await prisma.location.create({ data: { name: "Main Clinic" } });

  await prisma.operatory.createMany({
    data: [
      { locationId: clinic.id, name: "Chair 1", color: "#3B82F6", sortOrder: 0 },
      { locationId: clinic.id, name: "Chair 2", color: "#10B981", sortOrder: 1 },
    ],
  });

  const dentists = [
    { name: "Dr. Alex Reyes", colorHex: "#3B82F6", specializations: { create: [{ name: "General Dentistry" }] } },
    { name: "Dr. Sam Cruz", colorHex: "#EC4899", specializations: { create: [{ name: "Orthodontics" }] } },
  ];

  for (const dentist of dentists) {
    const provider = await prisma.providerProfile.create({ data: dentist });
    // Monday (1) to Saturday (6), with a lunch break.
    for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
      await prisma.providerAvailability.createMany({
        data: [
          { providerProfileId: provider.id, locationId: clinic.id, dayOfWeek, startTime: time("08:00"), endTime: time("12:00") },
          { providerProfileId: provider.id, locationId: clinic.id, dayOfWeek, startTime: time("13:00"), endTime: time("17:00") },
        ],
      });
    }
  }

  console.log(`Seeded ${APPOINTMENT_TYPES.length} appointment types, 1 clinic, 2 chairs and 2 dentists (Mon–Sat 8–12, 1–5).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
