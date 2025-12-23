export interface YouTubePlaylist {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  itemCount: number;
  channelTitle?: string;
}

export interface PlaylistsResponse {
  playlists: YouTubePlaylist[];
}
