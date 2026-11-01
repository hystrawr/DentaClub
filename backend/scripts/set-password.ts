/**
 * Create an account, or change an account's password or role.
 *
 *   npm run set-password
 *
 * Asks for the username (Enter for "admin"), the role (admin or staff), and
 * the password twice without showing it, then saves only its hash. Changing
 * a password signs out every device that was signed in with the old one.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

const DEFAULT_USERNAME = "admin";
const MIN_LENGTH = 8;
const ROLES = ["admin", "staff"] as const;

/** Read a line from the terminal, shown as it is typed. */
function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Read a line from the terminal without echoing what is typed. */
function askHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const username = (await ask(`Username (Enter for "${DEFAULT_USERNAME}"): `)) || DEFAULT_USERNAME;
  if (!/^[a-z0-9._-]{3,30}$/i.test(username)) {
    console.error("A username is 3 to 30 letters, numbers, dots, dashes or underscores. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  const suggested = existing?.role ?? (username === DEFAULT_USERNAME ? "admin" : "staff");
  const roleAnswer = (await ask(`Role, admin or staff (Enter for "${suggested}"): `)).toLowerCase() || suggested;
  const role = ROLES.find((r) => r === roleAnswer);
  if (!role) {
    console.error('The role must be "admin" or "staff". Nothing was changed.');
    process.exitCode = 1;
    return;
  }

  const password = await askHidden(`New password for "${username}": `);
  if (password.length < MIN_LENGTH) {
    console.error(`The password must be at least ${MIN_LENGTH} characters. Nothing was changed.`);
    process.exitCode = 1;
    return;
  }
  if ((await askHidden("Type it again: ")) !== password) {
    console.error("The two passwords did not match. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash, role },
    update: { passwordHash, role },
  });
  console.log(`${existing ? "Updated" : "Created"} "${username}" (${role}). Sign in with the new password.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
