import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DeleteButton, PlusSheet, Sheet } from "../src/ui";
import { NewbornSheet } from "../src/screens/Log";
import { RestoreSheet } from "../src/screens/Restore";
import { InstallSheet } from "../src/screens/Install";
import { setPrefs, saveSettings } from "../src/store";
import "../src/styles.css";

setPrefs({ guest: true, name: "Sheet test", theme: "light" });
saveSettings({ birthMode: "postpartum", babyName: "Si kecil", babyBirth: "2026-10-01" });
function Check() {
  const [open, setOpen] = useState(false), [plus, setPlus] = useState(false);
  const [breast, setBreast] = useState(false), [restore, setRestore] = useState(false), [install, setInstall] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return <main className="app"><h1 tabIndex={-1}>Sheet verification</h1><div className="stack">
    <button className="btn" onClick={() => setOpen(true)}>Open form</button>
    <button className="btn" onClick={() => setPlus(true)}>Open Plus</button>
    <button className="btn" onClick={() => setBreast(true)}>Open timer</button>
    <button className="btn" onClick={() => setRestore(true)}>Open restore</button>
    <button className="btn" onClick={() => setInstall(true)}>Open install</button>
    <p role="status">{deleted ? "Deleted" : "Preserved"}</p>
    {Array.from({ length: 20 }, (_, i) => <p key={i}>Background {i}</p>)}
  </div>
    <Sheet open={open} onOpenChange={setOpen} title="Long form">
      <form className="stack" onSubmit={e => { e.preventDefault(); setOpen(false); }}>
        {Array.from({ length: 15 }, (_, i) => <label className="field" key={i}><span>Field {i + 1}</span><input className="input" /></label>)}
        <DeleteButton className="btn" label="fixture" onDelete={() => { setDeleted(true); setOpen(false); }}>Delete fixture</DeleteButton>
        <button type="submit" className="btn">Save fixture</button>
      </form>
    </Sheet>
    <PlusSheet variant={plus ? "overview" : null} onClose={() => setPlus(false)} />
    <NewbornSheet kind={breast ? "breast" : null} record={null} onClose={() => setBreast(false)} />
    <RestoreSheet open={restore} onOpenChange={setRestore} />
    <InstallSheet open={install} onOpenChange={setInstall} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Check />);
