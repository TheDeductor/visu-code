import { randomUUID } from 'node:crypto';
import { db } from './db';

export async function createSession(userId: string) {
  const session = await db.session.create({
    data: { id: randomUUID(), userId, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });
  return session;
}

export async function getSession(id: string) {
  return db.session.findUnique({ where: { id } });
}
