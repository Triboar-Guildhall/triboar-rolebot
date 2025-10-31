import express from 'express';
import { handleWebhook } from './bot.js';
import logger from './logger.js';

const app = express();
app.use(express.json());

/**
 * Webhook endpoint to receive events from backend
 * Backend calls: POST /webhooks/rolebot
 */
app.post('/webhooks/rolebot', async (req, res) => {
  try {
    const event = req.body;

    if (!event.type) {
      logger.warn('Webhook received without event type');
      return res.status(400).json({ error: 'Event type required' });
    }

    logger.info({ eventType: event.type }, 'Received webhook from backend');

    // Process the event
    await handleWebhook(event);

    res.json({ ok: true });

  } catch (err) {
    logger.error({ err }, 'Webhook handler error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
