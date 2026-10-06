import { Baby, ChartNoAxesColumn, House, UserRound } from "lucide-react";
import { type CSSProperties, useEffect, useLayoutEffect } from "react";
import { afterNavigate } from "./motion";
import { onboardingStep } from "./onboarding";
import { useRoute } from "./route";
import { Bag } from "./screens/Bag";
import { Home } from "./screens/Home";
import { Insight } from "./screens/Insight";
import { Log } from "./screens/Log";
import { JoinLanding, MagicLanding, Partner } from "./screens/Partner";
import { Plus } from "./screens/Plus";
import { Profil } from "./screens/Profil";
import { Reminders } from "./screens/Reminders";
import { Report } from "./screens/Report";
import { SignIn } from "./screens/SignIn";
import { Welcome } from "./screens/Welcome";
import { SharedWishlist, Wishlist } from "./screens/Wishlist";
import { activeBabyId, getPrefs, settings, useDB } from "./store";
import { useAccount } from "./sync";
import { Toaster } from "./ui";

const TABS = [
  { href: "#/", path: "/", label: "Beranda", Icon: House },
  { href: "#/log", path: "/log", label: "Log", Icon: Baby },
  { href: "#/insight", path: "/insight", label: "Insight", Icon: ChartNoAxesColumn },
  { href: "#/profil", path: "/profil", label: "Profil", Icon: UserRound },
];

export function App() {
  useDB();
  const { path, params } = useRoute();
  const s = settings();
  const acc = useAccount();
  const step = onboardingStep(s, acc, getPrefs().guest);
  const ready = step === "ready";
  const babyKey = activeBabyId();

  useEffect(() => {
    if (path === "/plus" && !acc.token) sessionStorage.setItem("bb_auth_return", "#/plus");
  }, [path, acc.token]);
  let screen;
  if (path === "/masuk") screen = <MagicLanding token={params.get("token")} />;
  else if (path === "/gabung") screen = <JoinLanding invite={params.get("invite")} />;
  else if (path === "/kado-bersama") screen = <SharedWishlist key={params.get("token")} token={params.get("token")} />;
  else if (path === "/pasangan") screen = <Partner />;
  else if (path === "/plus") {
    screen = acc.checking ? <p role="status">Memeriksa sesi…</p> : acc.token ? <Plus /> : <SignIn plus />;
  }
  else if (path === "/masuk-akun") screen = <SignIn />;
  else if (step === "signin") screen = <SignIn onboarding />;
  else if (step === "setup") screen = <Welcome key={babyKey} user={acc.me?.user} />;
  else if (path === "/log") screen = <Log key={babyKey} />;
  else if (path === "/insight") screen = <Insight key={babyKey} />;
  else if (path === "/profil") screen = <Profil />;
  else if (path === "/tas") screen = <Bag />;
  else if (path === "/pengingat") screen = <Reminders key={babyKey} />;
  else if (path === "/laporan") screen = <Report key={babyKey} />;
  else if (path === "/kado") screen = <Wishlist key={`${acc.me?.household.id}:${babyKey}`} />;
  else screen = <Home key={babyKey} />;

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
