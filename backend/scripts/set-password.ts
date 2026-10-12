/**
 * Set (or change) the admin password.
 *
 *   npm run set-password
 *
 * Asks for the password twice without showing it, then saves only its hash.
 * Changing it signs out every device that was signed in with the old one.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

const USERNAME = "admin";
const MIN_LENGTH = 8;

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
  const password = await askHidden(`New password for "${USERNAME}": `);
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
    where: { username: USERNAME },
    create: { username: USERNAME, passwordHash },
    update: { passwordHash },
  });
  console.log(`Password saved. Sign in as "${USERNAME}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
