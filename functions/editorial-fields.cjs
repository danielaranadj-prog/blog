const types=['experiencia','opinion','guia','comparativa','seleccion','entrevista'];
const budgets=['gratis','economico','intermedio','premium','mixto'];
function editorialFields(input={}) {
 const text=(key,max)=>String(input[key]||'').trim().slice(0,max);
 const result={seoTitle:text('seoTitle',180),editorialType:types.includes(input.editorialType)?input.editorialType:'',destination:text('destination',120),budgetLevel:budgets.includes(input.budgetLevel)?input.budgetLevel:'',focusQuestion:text('focusQuestion',500),urlSlug:text('urlSlug',100),modifiedDate:text('modifiedDate',10)};
 if(result.urlSlug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.urlSlug)) {const e=Error('La dirección admite letras minúsculas sin acentos, números y guiones, hasta 100 caracteres.');e.status=400;throw e;}
 if(result.modifiedDate){const d=new Date(result.modifiedDate+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(result.modifiedDate)||Number.isNaN(d.valueOf())||d.toISOString().slice(0,10)!==result.modifiedDate){const e=Error('Fecha de actualización inválida.');e.status=400;throw e;}}
 return result;
}
module.exports={editorialFields,types,budgets};
