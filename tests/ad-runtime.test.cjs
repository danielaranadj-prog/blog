const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {transformSync}=require('esbuild');
const source=transformSync(fs.readFileSync('src/components/SiteRuntime.astro','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],{loader:'ts'}).code;
function fixture(preference=null,count=1){
 const handlers={},scripts=[],observers=[],slot={dataset:{},getBoundingClientRect:()=>({width:300})},frame={hidden:true,querySelector:()=>slot};
 const box={hidden:true,dataset:{publisher:'ca-pub-1234567890123456'},querySelector:s=>({addEventListener:(event,fn)=>handlers[s]=fn})};
 const window={addEventListener(){}};
 const document={querySelector:s=>s==='#site-ad-preferences'?box:scripts[0],querySelectorAll:()=>count?[frame]:[],createElement:()=>({dataset:{}}),head:{append:s=>scripts.push(s)}};
 class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.closed=true;}}
 vm.runInNewContext(source,{window,document,navigator:{},MutationObserver:Observer,requestAnimationFrame:fn=>fn(),sessionStorage:{getItem:()=>preference,setItem:(k,v)=>{preference=v;}}});
 return {handlers,scripts,frame,slot,box,window,observers};
}
test('Google is not requested before consent; a slot is visible before it enters the ad queue',()=>{const f=fixture();assert.equal(f.scripts.length,0);assert.equal(f.frame.hidden,true);f.handlers['[data-ads-accept]']();assert.equal(f.scripts.length,1);assert.equal(f.frame.hidden,true);f.scripts[0].onload();assert.equal(f.frame.hidden,false);assert.equal(f.window.adsbygoogle.length,1);});
test('refusal, load failures and unfilled slots collapse their frames',()=>{const rejected=fixture('no');assert.equal(rejected.scripts.length,0);assert.equal(rejected.frame.hidden,true);const f=fixture('yes');f.scripts[0].onload();f.slot.dataset.adStatus='unfilled';f.observers[0].fn();assert.equal(f.frame.hidden,true);const failed=fixture('yes');failed.scripts[0].onerror();assert.equal(failed.frame.hidden,true);});
test('pages without configured slots never load Google or display the consent prompt',()=>{const f=fixture('yes',0);assert.equal(f.scripts.length,0);assert.equal(f.box.hidden,true);});
