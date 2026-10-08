import { Milk, ChevronRight } from "lucide-react";
import { kinds } from "./newborn";

export default function NewbornActivity({ values, onToday }: { values: number[]; onToday?:()=>void }) {
  return <section className={"card today-stamp stamp-layout-rows"}><div className="spread activity-heading"><h2>Aktivitas hari ini</h2>{onToday&&<button className="link-btn" onClick={onToday}>Lihat hari ini <ChevronRight size={16}/></button>}</div><dl><div className="stamp-milk"><div><dt>Minum susu</dt><dd className="num">{values[0]}<small>ml diminum</small></dd></div><span className="milk-stamp" aria-hidden="true"><Milk size={40} strokeWidth={1.4}/><svg viewBox="0 0 100 100"><path d="M26 17l-3-7m14 4l3-6M76 77l6 3m-11 6l2 6"/></svg></span></div><div className="stamp-others">{kinds.slice(1).map(({kind,label,Icon},i)=><div key={kind}><span className={`stamp-icon stamp-${kind}`}><Icon size={23} strokeWidth={1.6} aria-hidden="true"/></span><dt>{label}</dt><dd className="num">{values[i+1]}<small>{i===1?"ml":"kali"}</small></dd></div>)}</div></dl></section>;
}
