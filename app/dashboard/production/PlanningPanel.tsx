"use client";

import { useEffect, useState, type FormEvent } from "react";
import { shortage, type Planning } from "@/lib/factory/planning";
import styles from "./planning.module.css";

type Flavor = { id: number; name: string; available: number };
const fmt = (n:number) => n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
const tabs = ["Reposición", "Materias primas", "Compras", "Movimientos"];

export default function PlanningPanel() {
 const [state,setState]=useState<Planning|null>(null),[flavors,setFlavors]=useState<Flavor[]>([]);
 const [tab,setTab]=useState("Reposición"),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 async function load(signal?:AbortSignal){
  setLoading(true);
  setError("");
  try{
   const r=await fetch("/api/factory-planning",{signal});
   const d=await r.json();
   if(!r.ok) throw new Error(d.error);
   setState(d.state);
   setFlavors(d.flavors);
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"No se pudo cargar.");}
  finally{if(!signal?.aborted)setLoading(false);}
 }
 useEffect(()=>{const controller=new AbortController(); void load(controller.signal); return ()=>controller.abort();},[]);
 async function run(c:Record<string,unknown>){
  if(busy)return false;
  setBusy(true);setError("");setNotice("");
  try{
   const r=await fetch("/api/factory-planning",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...c,commandId:crypto.randomUUID()})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error);
   setState(d.state);setNotice("Registro guardado.");return true;
  }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");return false;}
  finally{setBusy(false);}
 }
 const s=state;
 function submit(type:string,extra:Record<string,unknown>={}){return async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form));if(await run({type,...data,...extra}))form.reset();};}
 const ingredientSelect=()=> <label>Materia prima<select name="ingredientId" required><option value="">Seleccionar ingrediente</option>{s?.ingredients.map(i=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></label>;
 const number=(name:string,text:string,min=0,step='any')=><label>{text}<input name={name} type="number" min={min} step={step} required/></label>;
 const save=(text='Guardar')=><button disabled={busy} className="primary" type="submit">{busy?'Guardando…':text}</button>;
 return <div className={styles.panel}>
  <h1>Producción de fábrica</h1>
  <p>Planificá la reposición con el inventario actual y controlá el almacén de materias primas.</p>
  <nav aria-label="Secciones de producción">
   {tabs.map(t=><button key={t} aria-pressed={tab===t} onClick={()=>{setTab(t);setError("");setNotice("");}}>{t}</button>)}
   <button disabled={loading||busy} onClick={()=>void load()}>Actualizar</button>
  </nav>
  {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  {loading ? <p>Cargando registros…</p> : s && <>
   {tab==="Reposición" && <section>
    <h2>Baldes que faltan para alcanzar el mínimo</h2>
    <p>Se cuentan los baldes en stock de fábrica. Cargá el helado terminado desde Inventario.</p>
    <div className="tableWrap"><table>
     <thead><tr><th>Sabor</th><th>Disponibles</th><th>Mínimo</th><th>Faltan</th></tr></thead>
     <tbody>{flavors.map(f=>{
      const minimum=s.minimums[f.id];
      return <tr key={f.id}><td>{f.name}</td><td>{f.available}</td><td>{minimum??"Sin definir"}</td><td>{minimum==null?"—":shortage(minimum,f.available)}</td></tr>;
     })}</tbody>
    </table></div>
    {flavors.length>0?<form onSubmit={submit("minimum")}>
     <label>Sabor<select name="flavorId" required><option value="">Elegí un sabor</option>{flavors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
     {number("minimum","Mínimo de baldes",0,"1")}{save("Guardar mínimo")}
    </form>:<p>No hay sabores activos.</p>}
   </section>}
 {tab==='Materias primas'&&<><section><h2>Almacén de ingredientes</h2>{s.ingredients.map(i=><div className="listRow" key={i.id}><b>{i.name}</b><strong>{fmt(i.stock)} {i.unit}</strong></div>)}{!s.ingredients.length&&<div className="empty">Agregá las materias primas que querés controlar.</div>}</section><div className="columns"><section><h2>Agregar materia prima</h2><form onSubmit={submit('ingredient')}><label>Nombre<input name="name" required/></label><label>Unidad de control<select name="unit"><option value="kg">Kilos</option><option value="L">Litros</option><option value="u">Unidades</option></select></label>{save('Agregar')}</form></section><section><h2>Ajustar existencias</h2><form onSubmit={submit('ingredientMove')}>{ingredientSelect()}<label>Cantidad (+ o −)<input name="quantity" type="number" step="any" required/></label><label>Motivo<input name="reason" required/></label>{save('Registrar ajuste')}</form><p className="note">Cargá cantidades en la unidad de control. Por ejemplo, dos bolsas de 25 kg equivalen a 50 kg.</p></section></div></>}
 {tab==='Compras'&&<div className="columns"><section><h2>Pedido de compra</h2><form onSubmit={submit('purchase')}>{ingredientSelect()}{number('quantity','Cantidad en unidad de control',0.001)}<label>Proveedor<input name="supplier" required/></label>{save('Registrar pedido')}</form><p className="note">El pedido no suma stock. Las cantidades se incorporan al confirmar su recepción.</p></section><section><h2>Compras y recepciones</h2>{s.purchases.map(p=>{const i=s.ingredients.find(i=>i.id===p.ingredientId)!;return <div className="order" key={p.id}><h3>{i.name}</h3><p>{p.supplier} · {fmt(p.received)} / {fmt(p.quantity)} {i.unit} recibidos</p>{p.received<p.quantity&&<form onSubmit={submit('purchaseReceive',{purchaseId:p.id})}>{number('quantity','Cantidad recibida',0.001)}{save('Confirmar recepción')}</form>}</div>;})}{!s.purchases.length&&<div className="empty">No hay compras registradas.</div>}</section></div>}
 {tab==='Movimientos'&&<section><div className="sectionHead"><h2>Historial de materias primas</h2><button onClick={()=>{const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='los-bambinos-registros.json';a.click();URL.revokeObjectURL(u);}}>Exportar registros</button></div><div className="tableWrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Lugar</th><th>Cantidad</th><th>Motivo</th></tr></thead><tbody>{s.movements.slice().reverse().map(m=><tr key={m.id}><td>{new Date(m.date).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</td><td>{m.kind}</td><td>{m.name}</td><td>{m.location}</td><td>{fmt(m.quantity)} {m.unit}</td><td>{m.reason}</td></tr>)}</tbody></table></div>{!s.movements.length&&<div className="empty">Sin movimientos registrados.</div>}</section>}
  </>}
 </div>;
}
