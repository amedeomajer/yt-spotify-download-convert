import { Router } from 'express';

const router = Router();

// Start conversion - to be implemented
router.post('/start', (req, res) => {
  res.json({ message: 'Conversion - coming soon', jobId: 'temp-job-id' });
});

// Check conversion status - to be implemented
router.get('/status/:jobId', (req, res) => {
  res.json({
    message: 'Status check - coming soon',
    jobId: req.params.jobId,
    status: 'pending'
  });
});

export { router as convertRouter };
