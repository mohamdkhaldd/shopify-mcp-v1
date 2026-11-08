const { chromium } = require('playwright');
const call = (p, fn, args={}) => p.evaluate(async ([fn,args]) => { const r = await window.api.invoke('core:call',{fn,args}); if(!r.ok) throw new Error(fn+': '+r.message); return r.value; }, [fn,args]);
(async()=>{
  const b=await chromium.launch();
  const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,locale:'ar-EG'});
  const p=await c.newPage(); p.on('pageerror',e=>console.log('PE',e.message.slice(0,200)));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(2500);
  await p.screenshot({path:'shots/01-lock.png'});
  await p.fill('input','1234'); await p.screenshot({path:'shots/02-lock-typed.png'});
  await p.click('text=دخول'); await p.waitForTimeout(3000);
  const P = 100; // piasters per pound
  // main example
  const c1 = await call(p,'newContract',{ client:{kind:'company',name:'شركة البناء',vatApplies:true,tax5Applies:true}, equipment:{name:'مان لفت ٣٦', supplier:{name:'الحاج محمد'}}, unit:'day', clientRatePt:4500*P, supplierRatePt:3500*P, startDate:'2026-10-01', siteName:'التجمع الخامس'});
  const c2 = await call(p,'newContract',{ client:{kind:'company',name:'شركة النيل للمقاولات',vatApplies:true,tax5Applies:true}, equipment:{name:'لودر ٩٥٠', supplier:{name:'الحاج سعيد'}}, unit:'day', clientRatePt:5200*P, supplierRatePt:4200*P, startDate:'2026-10-01', siteName:'العاصمة الإدارية'});
  const c3 = await call(p,'newContract',{ client:{kind:'company',name:'شركة الأمل',vatApplies:true,tax5Applies:true}, equipment:{name:'كرين ٥٠ طن', supplier:{name:'المعلم رضا'}}, unit:'day', clientRatePt:9000*P, supplierRatePt:7500*P, startDate:'2026-10-05', siteName:'٦ أكتوبر'});
  for (const [id,from] of [[c1,'2026-10-01'],[c2,'2026-10-01'],[c3,'2026-10-05']]) {
    await call(p,'fillRange',{contractId:id,from,to:'2026-11-07'});
  }
  console.log('contracts',c1,c2,c3);
  const opts = await call(p,'contractOptions'); console.log(JSON.stringify(opts).slice(0,400));
  await call(p,'clientPayment',{clientId:1,date:'2026-11-03',amountPt:100000*P,note:'تحويل بنكي',forMonth:'2026-10'});
  await call(p,'clientPayment',{clientId:2,date:'2026-11-04',amountPt:150000*P,forMonth:'2026-10'});
  await call(p,'supplierPayment',{supplierId:1,date:'2026-11-05',amountPt:60000*P,forMonth:'2026-10',confirmNegative:true});
  await call(p,'supplierDeduction',{supplierId:1,date:'2026-10-20',amountPt:4000*P,note:'سولار',paidFromTreasury:true,confirmNegative:true});
  await call(p,'supplierPayment',{supplierId:2,date:'2026-11-05',amountPt:90000*P,forMonth:'2026-10',confirmNegative:true});
  const go = async (label, file, full=false) => {
    await p.click('[aria-label="القايمة"]'); await p.waitForTimeout(500);
    await p.locator('nav, aside').getByText(label, {exact:true}).first().click(); await p.waitForTimeout(1800);
    await p.screenshot({path:'shots/'+file+'.png', fullPage:full});
    const w = await p.evaluate(()=>[document.documentElement.scrollWidth, document.documentElement.clientWidth]); console.log('WIDTH', label, w.join('/'));
  };
  await p.waitForTimeout(2500); await p.reload(); await p.waitForTimeout(2500);
  await p.fill('input','1234'); await p.click('text=دخول'); await p.waitForTimeout(3000);
  await p.screenshot({path:'shots/03-home-hidden.png'});
  await p.getByText('اظهر الأرقام').first().click(); await p.waitForTimeout(800);
  await go('الرئيسية','10-home'); await go('الرئيسية','10-home-full',true);
  await go('السركي','20-sarki'); await go('السركي','20-sarki-full',true);
  await p.locator('select').first().selectOption({label: (await p.locator('select').first().locator('option',{hasText:'مان لفت'}).first().textContent())}); await p.waitForTimeout(1500);
  await p.screenshot({path:'shots/21-sarki-c1-full.png', fullPage:true});
  await go('أصحاب المعدات','30-suppliers-full',true);
  await go('الشركات والأفراد','40-clients-full',true);
  await p.getByText('شركة البناء').first().click(); await p.waitForTimeout(1500);
  await p.screenshot({path:'shots/41-clients-bina-full.png', fullPage:true});
  console.log('WIDTH clients-detail', (await p.evaluate(()=>[document.documentElement.scrollWidth, document.documentElement.clientWidth])).join('/'));
  await p.getByText('الفواتير',{exact:true}).first().click(); await p.waitForTimeout(1000);
  await p.screenshot({path:'shots/42-clients-bina-invoices-full.png', fullPage:true});
  await go('الخزنة','50-treasury-full',true);
  await go('الإدارة','70-management-full',true); await go('المستثمرين','80-investors-full',true); await go('سجل التعديلات','90-activity-full',true); await go('الإعدادات','95-settings-full',true);
  await go('الملف الضريبي','60-tax'); await go('الملف الضريبي','60-tax-full',true);
  await b.close();
})();
