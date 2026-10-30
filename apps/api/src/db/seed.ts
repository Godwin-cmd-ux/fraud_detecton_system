import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type { Db } from './client';
import { createDb } from './client';
import { admins, securityQuestions, users } from './schema';

export const SEED_QUESTIONS = [
  { key: 'mother_maiden', text: "What is your mother's maiden name?" },
  { key: 'first_school', text: 'What was the name of your first school?' },
  { key: 'birth_city', text: 'In which city were you born?' },
  { key: 'first_pet', text: "What was your first pet's name?" },
  { key: 'favorite_teacher', text: 'Who was your favourite teacher?' },
  { key: 'childhood_nickname', text: 'What was your childhood nickname?' },
] as const;

const DEMO_PASSWORD = 'User@123';
const DEMO_ANSWER = 'test';

const DEMO_USERS = [
  { fullName: 'Amina Hassan', email: 'amina@example.com', phone: '+255700000001', cardNumber: '4400000000000001', balance: 5_000_000 },
  { fullName: 'Juma Mwangi', email: 'juma@example.com', phone: '+255700000002', cardNumber: '4400000000000002', balance: 2_500_000 },
  { fullName: 'Neema Joseph', email: 'neema@example.com', phone: '+255700000003', cardNumber: '4400000000000003', balance: 12_000_000 },
  { fullName: 'Baraka Mushi', email: 'baraka@example.com', phone: '+255700000004', cardNumber: '4400000000000004', balance: 800_000 },
];

export interface SeedResult {
  adminUsername: string;
  adminPassword: string;
  users: { email: string; password: string; balance: number }[];
}

export async function seed(db: Db): Promise<SeedResult> {
  const adminUsername = 'admin';
  const adminPassword = 'Admin@123';

  await db
    .insert(securityQuestions)
    .values(SEED_QUESTIONS.map((q) => ({ questionKey: q.key, questionText: q.text })))
    .onConflictDoNothing();

  await db
    .insert(admins)
    .values({
      username: adminUsername,
      email: 'admin@example.com',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      fullName: 'System Administrator',
      // Lets the seeded administrator open the USSD dashboard after dialling the service code.
      phone: '+255700000000',
    })
    .onConflictDoNothing();

  const answerHash = await bcrypt.hash(DEMO_ANSWER, 10);
  const userHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db
    .insert(users)
    .values(
      DEMO_USERS.map((u) => ({
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        cardNumber: u.cardNumber,
        cardExpiry: '12/29',
        cardCvc: '123',
        passwordHash: userHash,
        balance: u.balance.toFixed(2),
        securityAnswers: {
          mother_maiden: answerHash,
          first_school: answerHash,
          birth_city: answerHash,
        },
        isApproved: true,
        isActive: true,
        lastKnownLocation: 'Dar es Salaam',
      })),
    )
    .onConflictDoNothing();

  return {
    adminUsername,
    adminPassword,
    users: DEMO_USERS.map((u) => ({ email: u.email, password: DEMO_PASSWORD, balance: u.balance })),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { env } = await import('../config/env');
  const { db, pool } = createDb(env.DATABASE_URL);
  try {
    const result = await seed(db);
    console.log('Seed complete.');
    console.log(`Admin: ${result.adminUsername} / ${result.adminPassword}`);
    for (const u of result.users) {
      console.log(`User: ${u.email} / ${u.password} (balance TSh ${u.balance.toLocaleString('en-US')})`);
    }
    console.log(`Security answers for demo users: "${DEMO_ANSWER}"`);
  } finally {
    await pool.end();
  }
}
