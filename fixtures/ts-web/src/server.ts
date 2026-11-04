import express from 'express';
import { loginHandler } from './routes/auth';
import { listNotes, createNote } from './routes/notes';

const app = express();
app.use(express.json());

app.post('/api/login', loginHandler);
app.get('/api/notes', listNotes);
app.post('/api/notes', createNote);

app.listen(3000, () => {
  console.log('listening on http://localhost:3000');
});

export default app;
