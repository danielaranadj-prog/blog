const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('production output contains every public admin/editor asset byte for byte',()=>{
 for(const name of ['admin','editor']){
  function check(relative){
   const source=path.join('public',relative),target=path.join('dist',relative);
   for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    const file=path.join(relative,entry.name);
    if(entry.isDirectory())check(file);
    else if(entry.isFile())assert.deepEqual(fs.readFileSync(path.join('dist',file)),fs.readFileSync(path.join('public',file)),`Asset missing or changed: ${file}`);
   }
  }
  check(name);
 }
});
test('final build hook restores admin/editor ESM files lost during Astro cleanup and preserves generated pages',async()=>{
 const {default:publicTools}=await import('../src/integrations/public-tools.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'instante-public-build-'));
 try{
  for(const dir of ['public/admin/js','public/editor','dist'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  const files={'admin/index.html':'admin document','admin/js/ad-code.mjs':'export const linked = true;','editor/index.html':'editor document','editor/short-links.mjs':'export const shortLink = true;'};
  for(const [name,content] of Object.entries(files))fs.writeFileSync(path.join(root,'public',name),content);
  fs.writeFileSync(path.join(root,'dist/index.html'),'generated home');
  const integration=publicTools();integration.hooks['astro:config:done']({config:{publicDir:pathToFileURL(path.join(root,'public')+path.sep)}});
  integration.hooks['astro:build:done']({dir:pathToFileURL(path.join(root,'dist')+path.sep)});
  for(const [name,content] of Object.entries(files))assert.equal(fs.readFileSync(path.join(root,'dist',name),'utf8'),content);
  assert.equal(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),'generated home');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
