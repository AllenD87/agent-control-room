const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const FRAMES_DIR = '/home/user/Doubao/chats/38451464215436802/agent-control-room-v2/recordings/frames3d';
fs.mkdirSync(FRAMES_DIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 5000));

  const FPS = 10;
  const FRAME_MS = 1000 / FPS;
  const totalFrames = 360; // 36 seconds

  for (let i = 0; i < totalFrames; i++) {
    await page.screenshot({ path: path.join(FRAMES_DIR, `f_${String(i).padStart(4, '0')}.png`) });
    await new Promise(r => setTimeout(r, FRAME_MS));
    if (i % 60 === 0) console.log(`frame ${i}/${totalFrames}`);
  }
  await browser.close();
  console.log('done');
})();
