const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {transformSync}=require('esbuild');
const {validateSettings}=require('../functions/site-admin.cjs');
const defaults=require('../src/data/site-settings.json');
test('explicit destinations win; incidental substring AVE cannot classify Patagonia as Spain',async()=>{
 const {buildCountryHubs}=await import('../src/utils/country-hubs.mjs');
 const post=(title,tags=[],destination='')=>({url:'/posts/test',frontmatter:{title,tags,destination}});
 const hubs=buildCountryHubs([post('Claves para una aventura en Ushuaia',['Argentina','Aventura']),post('Recuerdos de Madrid',['España'],'Buenos Aires, Argentina'),post('Comer en Segovia',['España'])]);
 assert.equal(hubs.find(h=>h.slug==='argentina').count,2);assert.equal(hubs.find(h=>h.slug==='espana').count,1);
 assert.equal(buildCountryHubs([post('Viaje general',['Aventura'])]).length,0);
 assert.equal(buildCountryHubs([post('Una nueva ruta',[],'México')])[0].slug,'mexico');
});
test('saved routes tolerate corrupt storage, reject unsafe URLs and deduplicate records',async()=>{
 const {readSavedRoutes,writeSavedRoutes}=await import('../src/utils/saved-routes.mjs');
 const storage={value:'{broken',getItem(){return this.value},setItem(k,v){this.value=v}};
 assert.deepEqual(readSavedRoutes(storage),[]);storage.value='{"title":"bad"}';assert.deepEqual(readSavedRoutes(storage),[]);
 storage.value=JSON.stringify([{url:'javascript:alert(1)',title:'x'},{url:'//evil.test/x'},{url:'/admin'},{url:'/posts/ushuaia/',title:'<img src=x onerror=alert(1)>'},{url:'/posts/ushuaia',title:'duplicate'}]);
 const list=readSavedRoutes(storage);assert.equal(list.length,1);assert.equal(list[0].url,'/posts/ushuaia');assert.equal(list[0].title,'<img src=x onerror=alert(1)>');
 assert.equal(writeSavedRoutes({setItem(){throw Error('QuotaExceeded')}},list),false);
});
test('shared aliases remain stable after a title edit and match every existing generated redirect',async()=>{
 const {getShortUrl,smartShortSlug}=await import('../public/editor/short-links.mjs');
 assert.equal(getShortUrl({filename:'comida-buenos-aires.md',title:'Uno'}),getShortUrl({filename:'comida-buenos-aires.md',title:'Otro título'}));
 assert(smartShortSlug('Un titulo extremadamente largo de viaje',{maxWords:3,maxLength:12}).length<=12);
 const matter=require('gray-matter');
 for(const file of fs.readdirSync('src/pages/posts').filter(name=>name.endsWith('.md'))){
  const {data}=matter(fs.readFileSync('src/pages/posts/'+file,'utf8'));const alias=new URL(getShortUrl({filename:file,title:data.title})).pathname;
  const html=fs.readFileSync('dist'+alias+'/index.html','utf8');assert(html.includes('/posts/'+encodeURI(file.slice(0,-3))),file);
 }
});
test('newsletter refuses circular placeholders and only accepts a genuine HTTPS destination',async()=>{
 const {getNewsletterUrl}=await import('../src/utils/newsletter.mjs');
 for(const url of ['', 'https://www.instantetrips.com/recursos#descargas','https://instantetrips.com/','javascript:alert(1)','https://user:password@example.com'])assert.equal(getNewsletterUrl(url),'');
 assert.equal(getNewsletterUrl('https://newsletter.example.com/signup'),'https://newsletter.example.com/signup');
 assert.throws(()=>validateSettings({...defaults,audience:{newsletterUrl:'https://www.instantetrips.com/recursos#descargas'}}));
});
test('admin preserves tool switches; older drafts keep tools enabled and invalid values are rejected',()=>{
 const settings=validateSettings({...defaults,tools:{savedRoutes:false}});assert.deepEqual(settings.tools,{savedRoutes:false});
 assert.deepEqual(validateSettings({...defaults,tools:undefined}).tools,{savedRoutes:true});
 assert.throws(()=>validateSettings({...defaults,tools:{savedRoutes:'false'}}));
});
test('measurement sends nothing until opt-in, honours opt-out and Do Not Track',()=>{
 const source=transformSync(fs.readFileSync('src/components/Analytics.astro','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],{loader:'ts'}).code;
 function fixture(choice,dnt='0'){
  const requests=[],handlers={};const panel={hidden:true},status={textContent:''};
  const document={querySelector(selector){if(selector==='#measurement-choice')return panel;if(selector==='#measurement-status')return status;return {addEventListener:(event,fn)=>handlers[selector]=fn};},addEventListener(){}};
  vm.runInNewContext(source,{document,navigator:{doNotTrack:dnt,webdriver:false},localStorage:{getItem:()=>choice,setItem(){}},crypto:{randomUUID:()=> 'id'},fetch:(path,options)=>{requests.push(JSON.parse(options.body));return Promise.resolve({ok:true});},location:{pathname:'/recursos/'}});
  return {requests,handlers};
 }
 const fresh=fixture(null);assert.equal(fresh.requests.length,0);fresh.handlers['#measurement-yes']();assert.equal(fresh.requests.length,1);
 assert.equal(fixture('no').requests.length,0);assert.equal(fixture('yes','1').requests.length,0);assert.equal(fixture('yes').requests.length,1);
});
test('public build has no fake download form, offline guarantee or unconfigured ads',()=>{
 const resources=fs.readFileSync('dist/recursos/index.html','utf8'),route=fs.readFileSync('dist/mi-ruta/index.html','utf8');
 assert(!resources.includes('calculadora-'));assert(!resources.includes('transport-form'));assert(!resources.includes('budget-form'));assert(!resources.includes('data-lead-form'));assert(!resources.includes('id="descargas"'));assert(!resources.includes('adsbygoogle'));assert(route.includes('noindex, follow'));assert(!route.includes('DISPONIBLE OFFLINE'));
 const arg=fs.readFileSync('dist/destinos/argentina/index.html','utf8');assert(!arg.includes('data-catalog-id="omio-trenes-europa"'));
});
