'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function DebugPage() {
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testTitle = async () => {
    if (!youtubeTitle.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/debug/test-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeTitle })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-rose-50 dark:from-stone-950 dark:to-rose-950 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
            Debug Tool
          </h1>
          <p className="text-muted-foreground">
            Test title parsing and Spotify matching
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test YouTube Title</CardTitle>
            <CardDescription>
              Enter a YouTube video title to see how it's parsed and matched
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Daughter - Medicine (Sound Remedy Remix)"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && testTitle()}
                className="flex-1"
              />
              <Button onClick={testTitle} disabled={loading || !youtubeTitle.trim()}>
                {loading ? 'Testing...' : 'Test'}
              </Button>
            </div>

            {result && (
              <div className="space-y-4 mt-6">
                {/* Parsing Results */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Parsed Title</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="font-semibold">Artist:</div>
                      <div>{result.parsed.artist || 'N/A'}</div>

                      <div className="font-semibold">Title:</div>
                      <div>{result.parsed.title}</div>

                      <div className="font-semibold">Version:</div>
                      <div>{result.parsed.version || 'N/A'}</div>

                      <div className="font-semibold">Features:</div>
                      <div>{result.parsed.features.length > 0 ? result.parsed.features.join(', ') : 'N/A'}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Search Results */}
                {result.searchResult && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Spotify Search Result</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="font-semibold">Original Confidence:</div>
                        <div>{(result.searchResult.confidence * 100).toFixed(0)}%</div>

                        <div className="font-semibold">Adjusted Confidence:</div>
                        <div className={result.adjustedConfidence < result.searchResult.confidence ? 'text-orange-600 font-semibold' : ''}>
                          {(result.adjustedConfidence * 100).toFixed(0)}%
                        </div>
                      </div>

                      {result.adjustmentReason && (
                        <div className="mt-3 p-3 bg-muted rounded-lg text-xs">
                          <div className="font-semibold mb-1">Adjustment Details:</div>
                          <div className={
                            result.adjustmentReason.includes('mismatch') ? 'text-orange-600' :
                            result.adjustmentReason.includes('match') ? 'text-green-600' :
                            'text-muted-foreground'
                          }>
                            {result.adjustmentReason}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-3">

                        <div className="font-semibold">Match Tier:</div>
                        <div>Tier {result.searchResult.matchTier}</div>

                        <div className="font-semibold">Category:</div>
                        <div className={
                          result.category === 'matched' ? 'text-green-600 font-semibold' :
                          result.category === 'lowConfidence' ? 'text-orange-600 font-semibold' :
                          'text-red-600 font-semibold'
                        }>
                          {result.category === 'matched' ? 'High Confidence (Auto-Added)' :
                           result.category === 'lowConfidence' ? 'Low Confidence (Manual Review)' :
                           'Not Found'}
                        </div>
                      </div>

                      {result.searchResult.track && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="font-semibold mb-2">Best Match:</div>
                          <div className="bg-background p-3 rounded-lg">
                            <div className="font-medium">{result.searchResult.track.name}</div>
                            <div className="text-muted-foreground">
                              {result.searchResult.track.artists.map((a: any) => a.name).join(', ')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {result.searchResult.track.album.name}
                            </div>
                          </div>
                        </div>
                      )}

                      {result.searchResult.alternatives && result.searchResult.alternatives.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="font-semibold mb-2">Alternative Matches ({result.searchResult.alternatives.length}):</div>
                          <div className="space-y-2">
                            {result.searchResult.alternatives.slice(0, 5).map((alt: any) => (
                              <div key={alt.id} className="bg-background p-2 rounded text-xs">
                                <div className="font-medium">{alt.name}</div>
                                <div className="text-muted-foreground">
                                  {alt.artists.map((a: any) => a.name).join(', ')} • {alt.album.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            ← Back to Converter
          </Button>
        </div>
      </div>
    </div>
  );
}
