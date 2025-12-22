import 'express-session';

declare module 'express-session' {
  interface SessionData {
    youtubeToken?: any;
    spotifyToken?: any;
  }
}
