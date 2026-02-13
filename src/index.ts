import AgentAPI from 'apminsight';
AgentAPI.config()

import express from 'express';
import cors from "cors"
import { eq } from 'drizzle-orm';
import subjectsRouter from './routes/subjects.js';
import departmentsRouter from './routes/departments.js';
import usersRouter from './routes/users.js';
import classesRouter from './routes/classes.js';
import studentsRouter from './routes/students.js';
import attendanceRouter from './routes/attendance.js';
import securityMiddleware from './middleware/security.js';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth.js';
import { db } from './db/index.js';
import * as schema from './db/schema/auth.js';

const app = express();
const PORT = 8000;

if(!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is not set in env file")
}

// In your Express/Fastify/Hono server setup
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

// Custom endpoint to get session with token (for bearer token auth)
// MUST be placed BEFORE the generic /api/auth/* handler
app.get('/api/auth/get-session-with-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token in Authorization header');
      return res.json(null);
    }
    
    // Query the database directly for the session by token
    const sessionData = await db
      .select()
      .from(schema.adminSession)
      .where(eq(schema.adminSession.token, token))
      .limit(1);
    
    if (!sessionData || sessionData.length === 0) {
      console.log('Session not found for token:', token);
      return res.json(null);
    }
    
    const session = sessionData[0];
    
    if (!session) {
      console.log('Session is undefined');
      return res.json(null);
    }
    
    // Check if session is expired
    if (new Date() > session.expiresAt) {
      console.log('Session expired');
      return res.json(null);
    }
    
    // Get the associated user
    const userData = await db
      .select()
      .from(schema.adminUser)
      .where(eq(schema.adminUser.id, session.userId))
      .limit(1);
    
    const user = userData?.[0] || null;
    
    return res.json({
      user,
      session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.json(null);
  }
});

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());
app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/users', usersRouter)
app.use('/api/classes', classesRouter)
app.use('/api/students', studentsRouter)
app.use('/api/attendance', attendanceRouter)

app.get('/', (req, res) => {
  res.send('Hello, welcome to the Classroom API!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
