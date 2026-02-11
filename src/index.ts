import AgentAPI from 'apminsight';
AgentAPI.config()

import express from 'express';
import cors from "cors"
import subjectsRouter from './routes/subjects.js';
import departmentsRouter from './routes/departments.js';
import usersRouter from './routes/users.js';
import classesRouter from './routes/classes.js';
import studentsRouter from './routes/students.js';
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';

const app = express();
const PORT = 8000;

if(!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is not set in env file")
}

// In your Express/Fastify/Hono server setup
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // CRITICAL: Allow credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());
app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/users', usersRouter)
app.use('/api/classes', classesRouter)
app.use('/api/students', studentsRouter)

app.get('/', (req, res) => {
  res.send('Hello, welcome to the Classroom API!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
