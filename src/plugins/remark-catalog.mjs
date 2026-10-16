import fs from 'node:fs';
import {visit} from 'unist-util-visit';
import presentation from '../../functions/catalog-presentation.cjs';
export function remarkCatalog(){
 const settings=JSON.parse(fs.readFileSync(new URL('../data/site-settings.json',import.meta.url),'utf8'));
 return tree=>visit(tree,'html',node=>{if(node.value.includes('data-catalog-id'))node.value=presentation.resolveCatalogHtml(node.value,settings.catalog||[]);});
}
