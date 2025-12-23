'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

type Step = 'auth' | 'input' | 'converting' | 'results';

interface AuthStatus {
  youtube: boolean;
  spotify: boolean;
}

export function ConversionFlow() {
  const [step, setStep] = useState<Step>('auth');
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ youtube: false, spotify: false });
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [progress, setProgress] = useState(0);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Listen for OAuth popup callbacks
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'youtube-auth-success' || event.data.type === 'spotify-auth-success') {
        checkAuthStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check auth status
  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthStatus(data);

      // If both authenticated, move to input step
      if (data.youtube && data.spotify) {
        setStep('input');
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  };

  // Connect to YouTube
  const connectYouTube = () => {
    const popup = window.open('/api/auth/youtube', '_blank', 'width=600,height=700');
    if (!popup) {
      // Popup blocked, use same-window redirect as fallback
      window.location.href = '/api/auth/youtube';
    }
  };

  // Connect to Spotify
  const connectSpotify = () => {
    const popup = window.open('/api/auth/spotify', '_blank', 'width=600,height=700');
    if (!popup) {
      // Popup blocked, use same-window redirect as fallback
      window.location.href = '/api/auth/spotify';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-rose-50 dark:from-stone-950 dark:to-rose-950 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
            YouTube → Spotify
          </h1>
          <p className="text-muted-foreground">
            Convert your YouTube playlists to Spotify in seconds
          </p>
        </div>

        {/* Step 1: Authentication */}
        {step === 'auth' && (
          <Card className="border-rose-200 dark:border-rose-900">
            <CardHeader>
              <CardTitle>Step 1: Connect Your Accounts</CardTitle>
              <CardDescription>
                Authorize access to your YouTube and Spotify accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={connectYouTube}
                variant={authStatus.youtube ? "default" : "outline"}
                className="w-full"
                size="lg"
              >
                {authStatus.youtube ? '✓' : '🎬'} {authStatus.youtube ? 'YouTube Connected' : 'Connect YouTube'}
              </Button>

              <Button
                onClick={connectSpotify}
                variant={authStatus.spotify ? "default" : "outline"}
                className="w-full"
                size="lg"
              >
                {authStatus.spotify ? '✓' : '🎵'} {authStatus.spotify ? 'Spotify Connected' : 'Connect Spotify'}
              </Button>

              <Button
                onClick={checkAuthStatus}
                variant="secondary"
                className="w-full"
              >
                Check Connection Status
              </Button>

              {authStatus.youtube && authStatus.spotify && (
                <Button
                  onClick={() => setStep('input')}
                  className="w-full"
                >
                  Continue →
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Playlist Input */}
        {step === 'input' && (
          <Card className="border-rose-200 dark:border-rose-900">
            <CardHeader>
              <CardTitle>Step 2: Enter YouTube Playlist</CardTitle>
              <CardDescription>
                Paste the URL of the YouTube playlist you want to convert
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="https://www.youtube.com/playlist?list=..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
              />

              <div className="flex gap-2">
                <Button
                  onClick={() => setStep('auth')}
                  variant="outline"
                  className="flex-1"
                >
                  ← Back
                </Button>
                <Button
                  onClick={() => {
                    setStep('converting');
                    // Simulate progress for now
                    let p = 0;
                    const interval = setInterval(() => {
                      p += 5;
                      setProgress(p);
                      if (p >= 100) {
                        clearInterval(interval);
                        setTimeout(() => setStep('results'), 500);
                      }
                    }, 200);
                  }}
                  className="flex-1"
                  disabled={!playlistUrl}
                >
                  Convert to Spotify
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Converting */}
        {step === 'converting' && (
          <Card className="border-rose-200 dark:border-rose-900">
            <CardHeader>
              <CardTitle>Converting Playlist...</CardTitle>
              <CardDescription>
                Finding your songs on Spotify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-muted-foreground">
                {progress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {step === 'results' && (
          <Card className="border-rose-200 dark:border-rose-900">
            <CardHeader>
              <CardTitle>Conversion Complete! 🎉</CardTitle>
              <CardDescription>
                Your playlist has been created on Spotify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-4xl font-bold text-green-600">65</div>
                    <div className="text-sm text-muted-foreground">Songs Found</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="text-4xl font-bold text-orange-600">6</div>
                    <div className="text-sm text-muted-foreground">Not Found</div>
                  </CardContent>
                </Card>
              </div>

              <Button className="w-full" size="lg">
                Open in Spotify
              </Button>

              <Button
                onClick={() => {
                  setStep('input');
                  setPlaylistUrl('');
                  setProgress(0);
                }}
                variant="outline"
                className="w-full"
              >
                Convert Another Playlist
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Made with ♥ using Next.js & shadcn/ui
        </p>
      </div>
    </div>
  );
}
