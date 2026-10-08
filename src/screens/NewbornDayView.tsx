import { useLayoutEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Filter, Check } from "lucide-react";
import { Button, Select, SelectValue, Popover, ListBox, ListBoxItem } from "react-aria-components";
import { dayLabel, todayISO, midnight } from "../dates";
import { agendaTime, entriesOnDate, shiftDay, type Entry } from "../newborn";
import { description, kinds } from "../newborn";

function Activity({entry:e,edit}:{entry:Entry;edit?:()=>void}) {
 const {Icon,label}=kinds.find(k=>k.kind===e.kind)!;
 const content=<><span className={`stamp-icon stamp-${e.kind}`}><Icon size={22} aria-hidden="true"/></span><span className="agenda-copy"><span className="agenda-top"><strong>{label}</strong><time className="num">{agendaTime(e)}</time></span><span className="muted">{description(e)}{e.kind==="pump"&&e.minutes!=null?` · ${e.minutes} mnt`:""}</span></span>{edit&&<ChevronRight size={18} aria-hidden="true"/>}</>;
 return edit?<button className={`card agenda-activity ${e.kind}`} onClick={edit} aria-label={`Edit ${label.toLowerCase()} ${agendaTime(e)}`}>{content}</button>:<div className={`card agenda-activity ${e.kind}`}>{content}</div>;
}
export default function DayView({entries,now,selected,select,filter,setFilter,edit,add}:{entries:Entry[];now:number;selected:string|null;select:(date:string|null)=>void;filter:string;setFilter:(kind:string)=>void;edit:(e:Entry)=>void;add:()=>void}) {
 const today=todayISO(new Date(now)),date=selected??today;
 const days=Array.from({length:7},(_,i)=>shiftDay(date,i-3));
 const dayEntries=entriesOnDate(entries,date), visible=dayEntries.filter(e=>filter==="all"||e.kind===filter);
 const strip=useRef<HTMLDivElement>(null);
 const previous=useRef(date),direction=useRef(0),motion=useRef<Animation|null>(null);
 useLayoutEffect(()=>{
   const delta=direction.current; direction.current=0;
   if(date===previous.current)return;
   previous.current=date; motion.current?.cancel();
   if(delta&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&strip.current) {
     motion.current=strip.current.animate([{transform:`translateX(${delta*strip.current.clientWidth/7}px)`},{transform:"translateX(0)"}],{duration:220,easing:"cubic-bezier(.645,.045,.355,1)"});
   }
 },[date]);
 useLayoutEffect(()=>()=>motion.current?.cancel(),[]);
 function step(amount:number,keyboard:boolean){direction.current=keyboard?0:amount;select(shiftDay(date,amount));}
 return <section className="day-view"><div className="spread day-heading"><h2 className="card-title">{dayLabel(new Date(midnight(date)))}</h2><button className="btn btn-soft" onClick={()=>select(null)}>Hari ini</button></div><div className="week-control"><button className="icon-btn" aria-label="Tanggal sebelumnya" onClick={e=>step(-1,e.detail===0)}><ChevronLeft size={20}/></button><div className="date-viewport"><div ref={strip} className="day-strip" aria-label="Pilih tanggal">{days.map((d,i)=><button key={d} tabIndex={i===0||i===6?-1:undefined} disabled={d>today} aria-pressed={d===date} aria-label={dayLabel(new Date(midnight(d)))} onClick={e=>{direction.current=e.detail===0?0:d<date?-1:1;select(d);}}><span>{new Intl.DateTimeFormat("id-ID",{weekday:"short"}).format(new Date(midnight(d)))}</span><strong className="num">{Number(d.slice(-2))}</strong><i aria-hidden="true" data-has-entries={entriesOnDate(entries,d).length>0||undefined}/></button>)}</div></div><button className="icon-btn" aria-label="Tanggal berikutnya" disabled={date>=today} onClick={e=>step(1,e.detail===0)}><ChevronRight size={20}/></button></div><div className="spread agenda-heading"><h2 className="card-title">{filter==="all"?"Catatan":kinds.find(k=>k.kind===filter)!.label}</h2><Select aria-label="Filter jenis catatan" selectedKey={filter} onSelectionChange={key=>setFilter(String(key))}><Button className="icon-btn" aria-label="Filter jenis catatan" data-filtered={filter!=="all"||undefined}><Filter size={20}/><SelectValue className="visually-hidden"/></Button><Popover className="newborn-filter-popover" placement="bottom end" offset={8}><ListBox className="newborn-filter-list" aria-label="Jenis catatan">{[{kind:"all",label:"Semua catatan"},...kinds].map(({kind,label})=><ListBoxItem key={kind} id={kind} textValue={label} className="newborn-filter-option">{({isSelected})=><><span>{label}</span>{isSelected&&<Check size={18}/>}</>}</ListBoxItem>)}</ListBox></Popover></Select></div><div className="agenda-list">{visible.length?visible.map((e,i)=><div key={e.id}>{(i===0||Math.floor(new Date(visible[i-1].at).getHours()/6)!==Math.floor(new Date(e.at).getHours()/6))&&<h3 className="agenda-period">{["Dini hari","Pagi","Siang","Malam"][Math.floor(new Date(e.at).getHours()/6)]}</h3>}<Activity entry={e} edit={()=>edit(e)}/></div>):<div className="card empty"><strong>{dayEntries.length?"Tidak ada catatan jenis ini":"Belum ada catatan pada tanggal ini"}</strong><p className="muted">{dayEntries.length?"Pilih semua jenis untuk melihat aktivitas lainnya.":"Catatan susu, menyusu, pumping, dan popok akan tampil di sini."}</p><button className="btn btn-soft" onClick={dayEntries.length?()=>setFilter("all"):add}>{dayEntries.length?"Tampilkan semua":"Tambah catatan"}</button></div>}</div></section>;
}
