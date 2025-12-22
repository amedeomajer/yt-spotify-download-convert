import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { playlistsRouter } from './routes/playlists';
import { convertRouter } from './routes/convert';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server
  credentials: true // Allow cookies/session
}));

app.use(express.json());

// Session management
app.use(session({
  secret: 'ytb-to-spotify-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/auth', authRouter);
app.use('/playlists', playlistsRouter);
app.use('/convert', convertRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend expected at http://localhost:5173`);
});
