import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedPrivateKey: string | null = null;

// Prefers JWT_PRIVATE_KEY (set as an env var in deployment) over the local
// keys/private-key.pem file, which only exists for local dev and is
// gitignored — it must never be committed or bundled into a deployment.
export const getPrivateKey = (): string => {
  if (cachedPrivateKey) return cachedPrivateKey;

  const fromEnv = process.env.JWT_PRIVATE_KEY;
  // TEMP DIAGNOSTIC — remove once JWT_PRIVATE_KEY resolution is confirmed working in prod.
  console.log(
    `[getPrivateKey] JWT_PRIVATE_KEY present: ${!!fromEnv}, length: ${fromEnv?.length ?? 0}, starts: ${JSON.stringify(fromEnv?.slice(0, 15))}`
  );
  if (fromEnv) {
    cachedPrivateKey = fromEnv.includes('\\n') ? fromEnv.replace(/\\n/g, '\n') : fromEnv;
    return cachedPrivateKey;
  }

  cachedPrivateKey = fs.readFileSync(path.resolve(__dirname, '../keys/private-key.pem'), 'utf-8');
  return cachedPrivateKey;
};
