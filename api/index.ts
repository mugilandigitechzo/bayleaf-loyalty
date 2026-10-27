import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../server/app.js';

const app = buildApp({ serveWeb: false });

export default function handler(req: IncomingMessage, res: ServerResponse) {
  app.emit('request', req, res);
}

