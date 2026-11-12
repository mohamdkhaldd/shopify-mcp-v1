/* ===== Language layer: translates visible English text to Egyptian Arabic, live ===== */
let LANG = (()=>{ if(location.hash==="#ar") return "ar"; if(location.hash==="#en") return "en"; try{ return localStorage.getItem("ma.lang")||"en"; }catch(e){ return "en"; } })();
const NUMRE = /[−-]?\$?\d[\d,]*(?:\.\d+)?/g;
function trCore(s){
  const c = s.replace(/\s+/g," ");
  const nums = []; const key = c.replace(NUMRE, x=>{ nums.push(x); return "#"; });
  if(AR[key]!=null){ let i=0; return AR[key].replace(/#/g, ()=> nums[i++] ?? "#"); }
  for(const [re,f] of AR_PATTERNS){ const m=c.match(re); if(m){ const out=f(m); if(out!=null) return out; } }
  if(c.includes(" · ")){ const parts=c.split(" · "); const t=parts.map(p=>trCore(p)??p); if(t.some((x,i)=>x!==parts[i])) return t.join(" · "); }
  const sents=c.split(/(?<=[.!?…])\s+/); if(sents.length>1){ const t=sents.map(p=>trCore(p)??p); if(t.some((x,i)=>x!==sents[i])) return t.join(" "); }
  return null;
}
function tr(s){
  if(LANG!=="ar"||!s) return s; const core=s.trim(); if(!core||!/[A-Za-z]/.test(core)) return s;
  const r=trCore(core); if(r==null) return s;
  return s.match(/^\s*/)[0]+r+s.match(/\s*$/)[0];
}
function trText(n){
  if(n.parentNode && n.parentNode.closest && n.parentNode.closest("script,style,.notr")) return;
  if(n.__ar!==undefined && n.nodeValue===n.__ar) return;
  n.__en = n.nodeValue; const t = tr(n.__en); n.__ar = t; if(t!==n.nodeValue) n.nodeValue = t;
}
function trTree(root){
  if(root.nodeType===3) return trText(root);
  if(root.nodeType!==1) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); let x; while((x=w.nextNode())) trText(x);
  root.querySelectorAll && root.querySelectorAll("[placeholder],[aria-label]").forEach(el=>{ ["placeholder","aria-label"].forEach(a=>{ const v=el.getAttribute(a); if(!v) return; el["__en_"+a]=el["__en_"+a]||v; el.setAttribute(a,tr(el["__en_"+a])); }); });
}
function untrTree(root){ const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); let x; while((x=w.nextNode())){ if(x.__en!==undefined && x.nodeValue===x.__ar){ x.nodeValue=x.__en; x.__ar=undefined; } } }
const trObserver = new MutationObserver(muts=>{ if(LANG!=="ar") return; for(const m of muts){ if(m.type==="characterData") trText(m.target); else m.addedNodes.forEach(trTree); } });
function applyLang(){
  const html=document.documentElement; html.lang = LANG==="ar"?"ar":"en"; html.dir = LANG==="ar"?"rtl":"ltr";
  if(LANG==="ar"){ trTree(document.body); trObserver.observe(document.body,{childList:true,subtree:true,characterData:true}); }
  else { trObserver.disconnect(); untrTree(document.body); }
}
function setLang(l){ LANG=l; try{ localStorage.setItem("ma.lang",l); }catch(e){} applyLang(); }
