import { useId, useState, type CSSProperties } from "react";

export default function Segmented({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:[string,string][]}) {
 const name=useId(),[keyboard,setKeyboard]=useState(false);
 const index=options.findIndex(([v])=>v===value);
 return <fieldset className="segment-field"><legend>{label}</legend><div className="segmented choice-segmented" data-empty={index<0||undefined} data-keyboard={keyboard||undefined} style={{"--n":options.length,"--i":Math.max(0,index)} as CSSProperties} onKeyDown={()=>setKeyboard(true)} onPointerDown={()=>setKeyboard(false)}>{options.map(([v,text])=><label key={v}><input className="visually-hidden" type="radio" name={name} value={v} checked={value===v} onChange={()=>onChange(v)}/><span>{text}</span></label>)}</div></fieldset>;
}
