import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// Prisma 7 talks to PostgreSQL through the `pg` driver via this adapter.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// One shared client for the whole app — every route imports this.
export const prisma = new PrismaClient({ adapter });
