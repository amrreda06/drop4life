import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.resolve(__dirname, '..');
const publicDir = path.join(frontendDir, 'public');
const staticDir = path.join(rootDir, 'static');

const envPath = path.join(frontendDir, '.env.production');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const apiMatch = envText.match(/^VITE_API_URL=(.+)$/m);
const apiUrl = (apiMatch?.[1] || '/api').trim();

const sourceHtml = path.join(rootDir, 'drop4life.html');
const apiClientSource = path.join(staticDir, 'js', 'api-client.js');
const chartSource = path.join(frontendDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js');

let html = fs.readFileSync(sourceHtml, 'utf8');
html = html.replace(/^\{% load static %\}\s*\n/m, '');
html = html.replace(
  /<script src="\{% static 'js\/chart\.umd\.min\.js' %\}"><\/script>\n?/,
  '<script src="./js/chart.umd.min.js"></script>\n',
);
html = html.replace(
  /<script src="\{% static 'js\/api-client\.js' %\}"><\/script>/,
  `<script src="./js/api-client.js"></script>`,
);

fs.mkdirSync(path.join(publicDir, 'js'), { recursive: true });
fs.writeFileSync(path.join(publicDir, 'app.html'), html, 'utf8');
fs.copyFileSync(apiClientSource, path.join(publicDir, 'js', 'api-client.js'));

if (fs.existsSync(chartSource)) {
  fs.copyFileSync(chartSource, path.join(publicDir, 'js', 'chart.umd.min.js'));
  fs.copyFileSync(chartSource, path.join(staticDir, 'js', 'chart.umd.min.js'));
  console.log('Copied local Chart.js');
} else {
  console.warn('Chart.js not found — run: cd frontend && npm install');
}

console.log(`Prepared legacy app (API: ${apiUrl})`);
