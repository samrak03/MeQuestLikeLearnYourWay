
import { config } from './config/index.js';
import app from './app.js';

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`✅ (server.js) Server running on http://localhost:${PORT}`);
});
