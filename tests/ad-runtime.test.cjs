const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {transformSync}=require('esbuild');
const source=transformSync(fs.readFileSync('src/components/SiteRuntime.astro','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],{loader:'ts'}).code;
function fixture(preference=null,count=1,{width=300,feed=false,visible=true,defer=false}={}){
 const handlers={},events={},frames=[],scripts=[],observers=[],slot={dataset:{},getBoundingClientRect:()=>({width})},frame={hidden:true,dataset:feed?{adPlacement:'feed',feedVisible:String(visible)}:{},querySelector:()=>slot};
 const box={hidden:true,dataset:{publisher:'ca-pub-1234567890123456'},querySelector:s=>({addEventListener:(event,fn)=>handlers[s]=fn})};
 const window={addEventListener:(name,fn)=>{events[name]=fn;}};
 const document={querySelector:s=>s==='#site-ad-preferences'?box:scripts[0],querySelectorAll:()=>count?[frame]:[],createElement:()=>({dataset:{}}),head:{append:s=>scripts.push(s)}};
 class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.closed=true;}}
 vm.runInNewContext(source,{window,document,navigator:{},MutationObserver:Observer,requestAnimationFrame:fn=>defer?frames.push(fn):fn(),sessionStorage:{getItem:()=>preference,setItem:(k,v)=>{preference=v;}}});
 return {handlers,events,scripts,frame,slot,box,window,observers,flush:()=>{while(frames.length)frames.shift()();},setWidth:value=>{width=value;}};
}
test('Google is not requested before consent; a slot is visible before it enters the ad queue',()=>{const f=fixture();assert.equal(f.scripts.length,0);assert.equal(f.frame.hidden,true);f.handlers['[data-ads-accept]']();assert.equal(f.scripts.length,1);assert.equal(f.frame.hidden,true);f.scripts[0].onload();assert.equal(f.frame.hidden,false);assert.equal(f.window.adsbygoogle.length,1);});
test('refusal, load failures and unfilled slots collapse their frames',()=>{const rejected=fixture('no');assert.equal(rejected.scripts.length,0);assert.equal(rejected.frame.hidden,true);const f=fixture('yes');f.scripts[0].onload();f.slot.dataset.adStatus='unfilled';f.observers[0].fn();assert.equal(f.frame.hidden,true);const failed=fixture('yes');failed.scripts[0].onerror();assert.equal(failed.frame.hidden,true);});
test('pages without configured slots never load Google or display the consent prompt',()=>{const f=fixture('yes',0);assert.equal(f.scripts.length,0);assert.equal(f.box.hidden,true);});
test('filtering hides the same feed ad and restoring the feed never requests it twice',()=>{
 const f=fixture('yes',1,{feed:true});f.scripts[0].onload();assert.equal(f.window.adsbygoogle.length,1);
 f.frame.dataset.feedVisible='false';f.events['instante-feed-visibility']();assert.equal(f.frame.hidden,true);
 f.frame.dataset.feedVisible='true';f.events['instante-feed-visibility']();assert.equal(f.frame.hidden,false);assert.equal(f.window.adsbygoogle.length,1);
 f.slot.dataset.adStatus='unfilled';f.observers[0].fn();f.events['instante-feed-visibility']();assert.equal(f.frame.hidden,true);
});
test('feed ads wait for a visible feed and 250px of width, including a resize after consent',()=>{
 const f=fixture('yes',1,{feed:true,visible:false,width:249});f.scripts[0].onload();assert.equal(f.window.adsbygoogle,undefined);
 f.frame.dataset.feedVisible='true';f.events['instante-feed-visibility']();assert.equal(f.window.adsbygoogle,undefined);assert.equal(f.frame.hidden,true);
 f.setWidth(250);f.events.resize();assert.equal(f.window.adsbygoogle.length,1);assert.equal(f.frame.hidden,false);
});
test('rapid layout events before the next frame still request only one ad',()=>{
 const f=fixture('yes',1,{feed:true,defer:true});f.scripts[0].onload();f.events.resize();f.events['instante-feed-visibility']();f.flush();assert.equal(f.window.adsbygoogle.length,1);
});
