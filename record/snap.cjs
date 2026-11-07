const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1280, height: 800 } });
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: '/home/user/Doubao/chats/38451464215436802/agent-control-room-v2/recordings/v2_3d_screenshot.png' });
  console.log('done');
  await browser.close();
})();
