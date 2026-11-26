export type Ingredient={id:string;name:string;unit:string;stock:number};
export type Purchase={id:string;ingredientId:string;quantity:number;received:number;supplier:string};
export type Movement={id:string;date:string;kind:string;name:string;location:string;buckets:number;quantity:number;unit:string;reason:string;reference:string};
export type Planning={ingredients:Ingredient[];purchases:Purchase[];movements:Movement[];minimums:Record<string,number>;commands:string[]};
export type Command={type:string;commandId:string;name?:string;unit?:string;ingredientId?:string;quantity?:string;reason?:string;supplier?:string;purchaseId?:string;flavorId?:string;minimum?:string};
export const shortage=(minimum:number,available:number)=>Math.max(0,minimum-available);
const num=(v:unknown,positive=false,integer=false)=>{const n=Number(v);if(!Number.isFinite(n)||(positive?n<=0:n<0)||(integer&&!Number.isInteger(n)))throw new Error('Cantidad inválida.');return n;};
const label=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>200)throw new Error('Completá el nombre o motivo.');return v.trim();};
const id=()=>crypto.randomUUID();
export function apply(s:Planning,c:Command,flavorIds:number[]){
 if (s.commands.includes(c.commandId)) return;
 const ingredient=()=>{const i=s.ingredients.find(x=>x.id===c.ingredientId);if(!i)throw new Error('Seleccioná una materia prima válida.');return i;};
 const move=(kind:string,name:string,location:string,buckets:number,quantity:number,unit:string,reason='',reference='')=>s.movements.push({id:id(),date:new Date().toISOString(),kind,name,location,buckets,quantity,unit,reason,reference});
 switch(c.type){
 case 'minimum': {
  const flavor=Number(c.flavorId);
  if(!flavorIds.includes(flavor)) throw new Error('Seleccioná un sabor activo.');
  s.minimums[String(flavor)]=num(c.minimum,false,true);
  break;
 }
 case 'ingredient':{const name=label(c.name);if(!['kg','L','u'].includes(c.unit ?? ''))throw new Error('Unidad inválida.');if(s.ingredients.some(i=>i.name.toLowerCase()===name.toLowerCase()))throw new Error('Esa materia prima ya existe.');s.ingredients.push({id:id(),name,unit:c.unit!,stock:0});break;}
 case 'ingredientMove': {const i=ingredient(),q=Number(c.quantity);if(!Number.isFinite(q)||q===0)throw new Error('Cantidad inválida.');if(i.stock+q<0)throw new Error('El ajuste dejaría stock negativo.');const reason=label(c.reason);i.stock+=q;move('Ajuste de materia prima',i.name,'Almacén',0,q,i.unit,reason);break;}
 case 'purchase':{const i=ingredient();s.purchases.push({id:id(),ingredientId:i.id,quantity:num(c.quantity,true),received:0,supplier:label(c.supplier)});break;}
 case 'purchaseReceive':{const po=s.purchases.find(p=>p.id===c.purchaseId);if(!po)throw new Error('Compra no encontrada.');const q=num(c.quantity,true);if(q>po.quantity-po.received+1e-8)throw new Error('La recepción supera el pendiente.');const i=s.ingredients.find(i=>i.id===po.ingredientId)!;po.received+=q;i.stock+=q;move('Recepción de compra',i.name,'Almacén',0,q,i.unit,po.supplier,po.id);break;}
 default:throw new Error('Operación desconocida.');
 }
 s.commands.push(c.commandId);
}
