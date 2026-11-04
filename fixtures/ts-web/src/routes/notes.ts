import type { Request, Response } from 'express';
import { db } from '../db';

export async function listNotes(req: Request, res: Response) {
  const notes = await db.note.findMany({ where: { ownerId: req.user?.id } });
  res.json(notes);
}

export async function createNote(req: Request, res: Response) {
  const note = await db.note.create({ data: { title: req.body.title, ownerId: req.user!.id } });
  res.status(201).json(note);
}
