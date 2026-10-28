const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateSettings,adminService}=require('../functions/site-admin.cjs');
const defaults=require('../src/data/site-settings.json');
const {DB}=require('./helpers/memory-db.cjs'),{repository}=require('./helpers/site-repository.cjs');
const ads={enabled:true,publisherId:'ca-pub-1234567890123456',homeEnabled:false,articleEnabled:false,sidebarEnabled:false,feedEnabled:true,feedSlot:'1234567890',feedLayoutKey:'-ab+1c-2d',feedLayout:'image-top'};
const code=`<script>throw new Error('never execute pasted scripts')</script><ins class="adsbygoogle" data-ad-format="fluid" data-ad-client="${ads.publisherId}" data-ad-slot="${ads.feedSlot}" data-ad-layout-key="${ads.feedLayoutKey}" data-ad-layout="image-top"></ins>`;
test('pasted in-feed code imports only identifiers and rejects display units and multiple ads',async()=>{
 const {readInFeedCode}=await import('../public/admin/js/ad-code.mjs');
 assert.deepEqual(readInFeedCode(code),{publisherId:ads.publisherId,feedSlot:ads.feedSlot,feedLayoutKey:ads.feedLayoutKey,feedLayout:'image-top'});
 for(const input of [code+code,code.replace('fluid','auto'),code.replace(ads.feedLayoutKey,'<script>'),code.replace(ads.feedSlot,'not-a-slot'),'x'.repeat(20001)])assert.throws(()=>readInFeedCode(input));
 assert.equal(readInFeedCode(code.replaceAll('"',"'")).feedSlot,ads.feedSlot);
});
test('settings support a standalone feed ad, preserve legacy placement switches and reject incomplete activation',()=>{
 const value=validateSettings({...defaults,ads});assert.equal(value.ads.feedSlot,ads.feedSlot);assert.equal(value.ads.feedLayoutKey,ads.feedLayoutKey);assert.equal(value.ads.homeEnabled,false);
 const legacy=validateSettings({...defaults,ads:{enabled:true,publisherId:ads.publisherId,homeSlot:'123456'}});assert.equal(legacy.ads.homeEnabled,true);assert.equal(legacy.ads.feedEnabled,false);
 for(const change of [{feedSlot:''},{feedLayoutKey:''},{feedLayoutKey:'"><script>'},{feedEnabled:'true'},{feedLayout:'image-top" onclick="bad'},{feedEnabled:false}])assert.throws(()=>validateSettings({...defaults,ads:{...ads,...change}}),{status:400});
 assert.doesNotThrow(()=>validateSettings({...defaults,ads:{...ads,enabled:false,feedEnabled:false}}));
});
test('grid placement requires three real stories and a completely linked active feed unit',async()=>{
 const {showInFeedInGrid,adPlacementEnabled}=await import('../src/utils/ad-placements.mjs');
 assert.equal(showInFeedInGrid(ads,2),false);assert.equal(showInFeedInGrid(ads,3),true);
 for(const change of [{enabled:false},{feedEnabled:false},{feedLayoutKey:''},{feedSlot:''},{publisherId:'invalid'}])assert.equal(showInFeedInGrid({...ads,...change},9),false);
 assert.equal(adPlacementEnabled({...ads,homeSlot:'123456'},'home'),false);
 assert.equal(adPlacementEnabled({enabled:true,publisherId:ads.publisherId,homeSlot:'123456'},'home'),true);
});
test('feed configuration survives save and one atomic settings publication',async()=>{
 const repo=repository({'src/data/site-settings.json':JSON.stringify(defaults)});
 const api=adminService({db:new DB(),repository:repo.repository});const loaded=await api.load();
 await api.saveDraft({settings:{...defaults,ads},version:0,baseSha:loaded.publishedSha});assert.equal(repo.calls.filter(c=>c.method!=='GET').length,0);
 await api.publish({version:1});const saved=JSON.parse(repo.files.get('src/data/site-settings.json').content);
 assert.equal(saved.ads.feedEnabled,true);assert.equal(saved.ads.feedSlot,ads.feedSlot);assert.equal(saved.ads.feedLayoutKey,ads.feedLayoutKey);assert.equal(saved.ads.homeEnabled,false);
 assert.equal(repo.calls.filter(c=>c.method==='PATCH').length,1);
});
