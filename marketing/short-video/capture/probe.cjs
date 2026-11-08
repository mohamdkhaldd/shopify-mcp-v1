const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'ar-EG'});
const p=await c.newPage(); p.on('response',r=>r.status()>=400&&console.log('404',r.url()));p.on('pageerror',e=>console.log('PE',e.message.slice(0,300)));p.on('console',m=>m.type()==='error'&&console.log('ERR',m.text().slice(0,200)));
await p.goto('http://localhost:4173/');await p.waitForTimeout(3000);
await p.screenshot({path:'probe1.png'});
console.log((await p.locator('body').innerText()).slice(0,500));
await b.close();})();
