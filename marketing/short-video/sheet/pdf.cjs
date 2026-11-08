const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+__dirname+'/sheet.html');await p.evaluate(()=>document.fonts.ready);
await p.pdf({path:process.argv[2],format:'A4',printBackground:true});
await p.screenshot({path:__dirname+'/preview.png',fullPage:true});await b.close();})();
