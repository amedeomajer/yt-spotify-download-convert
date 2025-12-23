'use client';

import { useEffect } from 'react';

export default function YouTubeCallback() {
  useEffect(() => {
    // Close popup and notify parent
    if (window.opener) {
      window.opener.postMessage({ type: 'youtube-auth-success' }, window.location.origin);
      window.close();
    } else {
      // If not in popup, redirect to home
      window.location.href = '/';
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="text-6xl">✓</div>
        <h1 className="text-2xl font-bold">YouTube Authentication Successful!</h1>
        <p className="text-muted-foreground">Closing window...</p>
      </div>
    </div>
  );
}
