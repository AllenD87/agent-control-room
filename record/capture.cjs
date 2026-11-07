const puppeteer = require('/tmp/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/home/user/Doubao/chats/38451464215436802/agent-control-room-v2/recordings';
const FRAMES_DIR = path.join(OUT_DIR, 'frames');
fs.mkdirSync(FRAMES_DIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 5000));

  // Record 36 seconds at 10fps = 360 frames
  const DURATION_MS = 36000;
  const FPS = 10;
  const FRAME_MS = 1000 / FPS;
  const totalFrames = Math.floor(DURATION_MS / FRAME_MS);

  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath });
    await new Promise(r => setTimeout(r, FRAME_MS));
    if (i % 30 === 0) console.log(`Captured frame ${i}/${totalFrames}`);
  }

  await browser.close();
  console.log('Done capturing frames');
})();
