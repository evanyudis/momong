import { Baby, ChartNoAxesColumn, House, Users } from "lucide-react";
import { type CSSProperties, useLayoutEffect } from "react";
import { afterNavigate } from "./motion";
import { useRoute } from "./route";
import { Bag } from "./screens/Bag";
import { Home } from "./screens/Home";
import { Insight } from "./screens/Insight";
import { Log } from "./screens/Log";
import { JoinLanding, MagicLanding, Partner } from "./screens/Partner";
import { Report } from "./screens/Report";
import { Settings } from "./screens/Settings";
import { Welcome } from "./screens/Welcome";
import { Wishlist } from "./screens/Wishlist";
import { settings, useDB } from "./store";
import { Toaster } from "./ui";

const TABS = [
  { href: "#/", path: "/", label: "Beranda", Icon: House },
  { href: "#/log", path: "/log", label: "Log", Icon: Baby },
  { href: "#/insight", path: "/insight", label: "Insight", Icon: ChartNoAxesColumn },
  { href: "#/pasangan", path: "/pasangan", label: "Pasangan", Icon: Users },
];

export function App() {
  useDB();
  const { path, params } = useRoute();
  const s = settings();
  const ready = s.birthMode === "postpartum" ? true : !!s.hpl;

  // Account routes work before onboarding so an invited partner can join first.
  const accountRoute = path === "/masuk" || path === "/gabung" || path === "/pasangan";
  let screen;
  if (path === "/masuk") screen = <MagicLanding token={params.get("token")} />;
  else if (path === "/gabung") screen = <JoinLanding invite={params.get("invite")} />;
  else if (!ready && !accountRoute) screen = <Welcome />;
  else if (path === "/log") screen = <Log />;
  else if (path === "/insight") screen = <Insight />;
  else if (path === "/pasangan") screen = <Partner />;
  else if (path === "/pengaturan") screen = <Settings />;
  else if (path === "/tas") screen = <Bag />;
  else if (path === "/laporan") screen = <Report />;
  else if (path === "/kado") screen = <Wishlist />;
  else screen = <Home />;

  const showTabs = ready && TABS.some((t) => t.path === path);
  useLayoutEffect(() => afterNavigate(), [path]);
  return (
    <>
      <div className="page-wash" aria-hidden="true" />
      <main className="app">{screen}</main>
      {showTabs && (
        <nav className="tabbar" aria-label="Navigasi utama" style={{ "--tab": TABS.findIndex((t) => t.path === path) } as CSSProperties}>
          {TABS.map(({ href, path: p, label, Icon }) => (
            <a key={p} href={href} aria-current={p === path ? "page" : undefined}>
              <Icon size={24} strokeWidth={1.75} />
              {label}
            </a>
          ))}
        </nav>
      )}
      <Toaster />
    </>
  );
}
