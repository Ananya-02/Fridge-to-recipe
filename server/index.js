import 'dotenv/config';
import { createApp } from './app.js';
import { callModel } from './callModel.js';

const port = process.env.PORT || 8787;
createApp(callModel).listen(port, () => console.log(`API on http://localhost:${port}`));
