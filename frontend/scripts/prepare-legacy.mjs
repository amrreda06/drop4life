import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.resolve(__dirname, '..');
const publicDir = path.join(frontendDir, 'public');

const envPath = path.join(frontendDir, '.env.production');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const apiMatch = envText.match(/^VITE_API_URL=(.+)$/m);
const apiUrl = (apiMatch?.[1] || 'https://YOUR-RENDER-APP.onrender.com/api').trim();

const sourceHtml = path.join(rootDir, 'drop4life.html');
const apiClientSource = path.join(rootDir, 'static', 'js', 'api-client.js');

let html = fs.readFileSync(sourceHtml, 'utf8');
html = html.replace(/^\{% load static %\}\s*\n/m, '');
html = html.replace(
  /<script src="\{% static 'js\/api-client\.js' %\}"><\/script>/,
  `<script>window.__DROP4LIFE_API_URL__ = ${JSON.stringify(apiUrl)};</script>\n<script src="./js/api-client.js"></script>`,
);

fs.mkdirSync(path.join(publicDir, 'js'), { recursive: true });
fs.writeFileSync(path.join(publicDir, 'app.html'), html, 'utf8');
fs.copyFileSync(apiClientSource, path.join(publicDir, 'js', 'api-client.js'));

console.log(`Prepared legacy app with API URL: ${apiUrl}`);
