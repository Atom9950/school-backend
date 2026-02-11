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
      return res.json(null);
    }
    
    // Get session from better-auth using the token
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (session?.session) {
      // Return session with the token included
      return res.json({
        user: session.user,
        session: {
          ...session.session,
          token: token
        }
      });
    }
    
    return res.json(null);
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

app.get('/', (req, res) => {
  res.send('Hello, welcome to the Classroom API!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
