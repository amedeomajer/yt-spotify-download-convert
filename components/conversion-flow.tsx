'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { YouTubePlaylist } from '@/types/youtube';

type Step = 'auth' | 'input' | 'converting' | 'results';

interface AuthStatus {
  youtube: boolean;
  spotify: boolean;
}

export function ConversionFlow() {
  const [step, setStep] = useState<Step>('auth');
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ youtube: false, spotify: false });
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
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

  // Fetch playlists when entering input step
  useEffect(() => {
    if (step === 'input' && playlists.length === 0) {
      fetchPlaylists();
    }
  }, [step]);

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

  // Fetch YouTube playlists
  const fetchPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const res = await fetch('/api/youtube/playlists');
      const data = await res.json();

      if (data.error) {
        console.error('Failed to fetch playlists:', data.error);
        return;
      }

      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
    } finally {
      setLoadingPlaylists(false);
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

        {/* Step 2: Playlist Selection */}
        {step === 'input' && (
          <Card className="border-rose-200 dark:border-rose-900">
            <CardHeader>
              <CardTitle>Step 2: Select YouTube Playlist</CardTitle>
              <CardDescription>
                Choose a playlist to convert to Spotify
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPlaylists ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading your playlists...</div>
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">No playlists found</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => setSelectedPlaylist(playlist)}
                      className={`
                        flex gap-3 p-3 rounded-lg border-2 transition-all text-left
                        ${selectedPlaylist?.id === playlist.id
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950'
                          : 'border-stone-200 dark:border-stone-800 hover:border-rose-300'
                        }
                      `}
                    >
                      {playlist.thumbnail && (
                        <img
                          src={playlist.thumbnail}
                          alt={playlist.title}
                          className="w-20 h-20 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{playlist.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {playlist.itemCount} songs
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

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
                  disabled={!selectedPlaylist}
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
                  setSelectedPlaylist(null);
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
