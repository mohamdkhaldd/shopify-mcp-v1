// Launches the built app with the demo data and screenshots the dashboard (light, dark, print).
// Needs: npm run build, npm run rebuild:electron, playwright, a display (xvfb-run on Linux).
// Usage: SHOT_DIR=/tmp/shots xvfb-run -a node scripts/screenshot.cjs
const { _electron } = require('playwright');
const path = require('path');
(async () => {
  const appDir = require('path').join(__dirname, '..');
  const app = await _electron.launch({
    executablePath: path.join(appDir, 'node_modules/electron/dist/electron'),
    args: [appDir, '--no-sandbox'],
    env: { ...process.env, RENTAL_DEMO: '1', RENTAL_TODAY: '2026-10-31', RENTAL_USER_DATA: process.env.SHOT_DIR + '/userdata' },
  });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', e => errs.push(e.message)); win.on('console', m => m.type()==='error' && errs.push(m.text()));
  await win.setViewportSize({ width: 1440, height: 1000 });
  await win.waitForSelector('text=رصيد الخزنة', { timeout: 20000 });
  await win.waitForTimeout(800);
  await win.screenshot({ path: require('path').join(process.env.SHOT_DIR, 'final-home.png'), fullPage: true });
  await win.evaluate(() => document.documentElement.classList.add('dark'));
  await win.waitForTimeout(300);
  await win.screenshot({ path: require('path').join(process.env.SHOT_DIR, 'final-home-dark.png'), fullPage: true });
  const pdfLen = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.printToPDF({ pageSize: 'A4', printBackground: true })).length);
  console.log('pdf bytes', pdfLen);
  await win.evaluate(() => document.documentElement.classList.remove('dark'));
  await win.emulateMedia({ media: 'print' });
  await win.setViewportSize({ width: 794, height: 1123 });
  await win.waitForTimeout(300);
  await win.screenshot({ path: require('path').join(process.env.SHOT_DIR, 'final-home-print.png'), fullPage: true });
  console.log('backups', require('fs').readdirSync(process.env.SHOT_DIR + '/userdata/backups'));
  console.log('errors:', errs);
  await app.close();
})().catch(e => { console.error(e); process.exit(1); });
