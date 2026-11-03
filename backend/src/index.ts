import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { Prisma } from "./generated/prisma/client.js";
import { patientsRouter } from "./routes/patients.js";
import { odontogramRouter } from "./routes/odontogram.js";
import { consentRouter } from "./routes/consent.js";
import { medicalHistoryRouter } from "./routes/medical-history.js";
import { treatmentRecordsRouter } from "./routes/treatment-records.js";
import { documentsRouter } from "./routes/documents.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { providersRouter } from "./routes/providers.js";
import { clinicStructureRouter } from "./routes/clinic-structure.js";
import { appointmentTypesRouter } from "./routes/appointment-types.js";
import { HttpError } from "./lib/http-error.js";
import { requireSignIn } from "./lib/auth.js";
import { authRouter } from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// Only the Next.js frontend may call this API from a browser.
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    // The sign-in cookie rides along with every request.
    credentials: true,
  }),
);
// Parse JSON bodies. 2 MB leaves room for signature images.
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);

// Everything below needs a signed-in user.
app.use("/api", requireSignIn);

app.use("/api/patients", patientsRouter);
app.use("/api/patients/:id/odontogram", odontogramRouter);
app.use("/api", consentRouter);
app.use("/api", medicalHistoryRouter);
app.use("/api", treatmentRecordsRouter);
app.use("/api", documentsRouter);
app.use("/api", appointmentsRouter);
app.use("/api", providersRouter);
app.use("/api", clinicStructureRouter);
app.use("/api/appointment-types", appointmentTypesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Express 5 sends errors thrown inside async routes here automatically.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.errors ? { errors: err.errors } : {}), ...err.extra });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Invalid input", issues: err.issues });
    return;
  }
  // P2025 = "record to update/delete does not exist"
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // P2002 = unique constraint violated
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: "That record already exists" });
    return;
  }
  // Body larger than the express.json limit (e.g. a huge signature image)
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  // Body that is not valid JSON
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
};
app.use(errorHandler);

// "localhost" only: the API is not reachable from other devices on the network.
app.listen(PORT, "localhost", () => {
  console.log(`API running at http://localhost:${PORT}`);
});
