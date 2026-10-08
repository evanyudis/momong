import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button as AriaButton, Menu, MenuItem, Popover } from "react-aria-components";
import { kinds, type Kind } from "./newborn";
import { NewbornSheet } from "./screens/Log";
export default function NewbornAdd() {
 const addButton = useRef<HTMLButtonElement>(null);
 const [choosing,setChoosing] = useState(false);
 const [kind,setKind] = useState<Kind|null>(null);
 return <><AriaButton ref={addButton} className="add-log liquid-glass" aria-haspopup="menu" aria-expanded={choosing} aria-controls={choosing?"newborn-add-menu":undefined} onPress={()=>setChoosing(v=>!v)} onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setChoosing(true);}}} aria-label={choosing?"Tutup menu catatan":"Tambah catatan"}><Plus className="add-symbol" size={28} strokeWidth={1.75}/></AriaButton><Popover triggerRef={addButton} isOpen={choosing} onOpenChange={setChoosing} className="newborn-add-popover" placement="top end" offset={14} isNonModal shouldCloseOnInteractOutside={element=>!element.closest(".add-log")}><Menu id="newborn-add-menu" autoFocus="first" className="newborn-add-menu" aria-label="Tambah catatan">{kinds.map(({kind,label,Icon})=><MenuItem key={kind} id={kind} textValue={label} onAction={()=>{addButton.current?.focus({preventScroll:true});setChoosing(false);setKind(kind);}} className="newborn-add-option liquid-glass"><Icon size={21} strokeWidth={1.75} aria-hidden="true"/><span>{label}</span></MenuItem>)}</Menu></Popover><NewbornSheet kind={kind} record={null} onClose={() => setKind(null)} /></>;
}
