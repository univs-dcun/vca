const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('text=DATA').first().click();
  await page.waitForTimeout(500);
  await page.locator('text=Smart Search').first().click();
  await page.waitForTimeout(500);
  const count = await page.locator('button:has-text("VEHICLE")').count();
  console.log('VEHICLE button count:', count);
  for (let i=0;i<count;i++){
    const box = await page.locator('button:has-text("VEHICLE")').nth(i).boundingBox();
    console.log(i, box);
  }
  await browser.close();
})();
