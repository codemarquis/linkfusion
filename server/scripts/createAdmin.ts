/**
 * Make an account an administrator, creating it if needed:
 *   npm run create-admin -- you@example.com
 * A new account gets a random password that is printed once.
 */
import { randomBytes } from "node:crypto";
import { loadConfig } from "../config";
import { createDatabase } from "../db";
import { createUserRepository } from "../repositories/userRepository";
import { hashPassword } from "../services/passwords";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run create-admin -- you@example.com");
  process.exit(1);
}

const { db, pool } = createDatabase(loadConfig().databaseUrl);
const users = createUserRepository(db);
let user = await users.findByEmail(email);
if (!user) {
  const password = randomBytes(18).toString("base64url");
  user = await users.create({ email, firstName: "Admin", lastName: null, passwordHash: await hashPassword(password) });
  console.log(`Created ${email} with password: ${password}\nSign in and change it under Profile.`);
}
await users.setAdmin(user.id, true);
console.log(`${email} is now an administrator.`);
await pool.end();
