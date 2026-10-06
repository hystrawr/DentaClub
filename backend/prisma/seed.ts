/**
 * Starter data, matching what DentalOS seeds:
 *  - consent & intake forms (same names, fields and packets as seed-rich.ts)
 *  - scheduling: appointment types (DentalOS's list), one clinic, two chairs,
 *    two dentists working Mon–Sat 08:00–12:00 and 13:00–17:00
 *
 * Safe to run twice: each part is skipped if its data already exists.
 *
 *   npm run db:seed
 */
import { prisma } from "../src/lib/prisma.js";

async function main() {
  await seedIntake();
  await seedScheduling();
}

async function seedIntake() {
  if ((await prisma.intakeTemplate.count()) > 0) {
    console.log("Intake templates already exist — skipped.");
    return;
  }

  const medicalV1 = await prisma.intakeTemplate.create({
    data: {
      name: "Medical History",
      version: 1,
      isActive: false,
      fieldsSchema: [
        { key: "allergies", label: "Do you have any allergies?", type: "textarea", required: true },
        { key: "medications", label: "Current medications", type: "textarea", required: false },
        { key: "pregnant", label: "Are you pregnant?", type: "boolean", required: false },
      ],
    },
  });

  // v2 supersedes v1 — exercises the version chain, exactly as DentalOS seeds it.
  const medical = await prisma.intakeTemplate.create({
    data: {
      name: "Medical History",
      version: 2,
      parentTemplateId: medicalV1.id,
      fieldsSchema: [
        { key: "allergies", label: "Do you have any allergies?", type: "textarea", required: true },
        { key: "medications", label: "Current medications", type: "textarea", required: false },
        {
          key: "conditions",
          label: "Existing medical conditions",
          type: "checkboxes",
          required: false,
          options: ["Hypertension", "Diabetes", "Asthma", "Heart disease"],
        },
        { key: "pregnant", label: "Are you pregnant?", type: "boolean", required: false },
      ],
    },
  });

  const treatment = await prisma.intakeTemplate.create({
    data: {
      name: "Treatment Consent",
      fieldsSchema: [
        { key: "acknowledge", label: "I consent to the proposed treatment.", type: "checkbox", required: true },
        { key: "signature", label: "Signature", type: "signature", required: true },
      ],
    },
  });

  const privacy = await prisma.intakeTemplate.create({
    data: {
      name: "Data Privacy Consent (RA 10173)",
      fieldsSchema: [
        { key: "acknowledge", label: "I consent to the processing of my personal data.", type: "checkbox", required: true },
        { key: "signature", label: "Signature", type: "signature", required: true },
      ],
    },
  });

  const packets: Array<[string, string, string[]]> = [
    ["New Patient Packet", "Completed before the first visit.", [medical.id, treatment.id, privacy.id]],
    ["Recall Update", "Short medical history refresh for returning patients.", [medical.id]],
  ];

  for (const [name, description, templateIds] of packets) {
    await prisma.intakePacket.create({
      data: {
        name,
        description,
        items: {
          create: templateIds.map((templateId, sortOrder) => ({ templateId, sortOrder, isRequired: true })),
        },
      },
    });
  }

  console.log("Seeded 4 intake templates (Medical History v1→v2, Treatment Consent, Data Privacy Consent) and 2 packets.");
}

/** DentalOS prisma/seed.ts APPOINTMENT_TYPES: name, minutes, color, block time, recall months. */
const APPOINTMENT_TYPES: ReadonlyArray<[string, number, string, boolean, number | null]> = [
  ["Recall / Cleaning", 45, "#10B981", false, 6],
  ["New Patient Exam", 60, "#3B82F6", false, null],
  ["Restorative", 60, "#F59E0B", false, null],
  ["Root Canal", 90, "#EF4444", false, null],
  ["Extraction", 45, "#8B5CF6", false, null],
  ["Ortho Adjustment", 30, "#EC4899", false, null],
  ["Emergency", 30, "#DC2626", false, null],
  ["Lunch Break", 60, "#9CA3AF", true, null],
];

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

async function seedScheduling() {
  if ((await prisma.location.count()) > 0) {
    console.log("Scheduling data already exists — skipped.");
    return;
  }

  for (const [name, durationMinutes, colorHex, isBlockTime, recallIntervalMonths] of APPOINTMENT_TYPES) {
    await prisma.appointmentType.create({
      data: { name, durationMinutes, colorHex, isBlockTime, recallIntervalMonths },
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
    { name: "Dr. Alex Reyes", colorHex: "#3B82F6", specializations: ["General Dentistry"] },
    { name: "Dr. Sam Cruz", colorHex: "#EC4899", specializations: ["Orthodontics"] },
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
