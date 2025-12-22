import { Router } from 'express';

const router = Router();

// Get YouTube playlist details - to be implemented
router.get('/:playlistId', (req, res) => {
  res.json({ message: 'Playlist fetching - coming soon', playlistId: req.params.playlistId });
});

export { router as playlistsRouter };
