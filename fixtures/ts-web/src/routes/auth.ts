import type { Request, Response } from 'express';
import { db } from '../db';
import { createSession } from '../session';

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const session = await createSession(user.id);
  res.cookie('session', session.id, { httpOnly: true });
  return res.json({ ok: true });
}
