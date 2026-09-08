import { Routes, Route, NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  Download,
  Filter,
  LayoutDashboard,
  PieChart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Import from "./pages/Import";
import Transactions from "./pages/Transactions";
import Rules from "./pages/Rules";
import Portfolio from "./pages/Portfolio";
import Performance from "./pages/Performance";
import { ThemeToggle } from "./components/ThemeToggle";

type NavItem = { to: string; label: string; icon: LucideIcon };

const navSections: { heading: string | null; items: NavItem[] }[] = [
  {
    heading: null,
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Banking",
    items: [
      { to: "/accounts", label: "Accounts", icon: Wallet },
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/import", label: "Import", icon: Download },
      { to: "/rules", label: "Rules", icon: Filter },
    ],
  },
  {
    heading: "Investments",
    items: [
      { to: "/portfolio", label: "Portfolio", icon: PieChart },
      { to: "/performance", label: "Performance", icon: TrendingUp },
    ],
  },
];

export default function App() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-52 shrink-0 bg-surface border-r border-border flex flex-col py-6">
        <div className="px-5 pb-6 border-b border-border mb-4">
          <h1 className="text-base font-semibold text-foreground">FinTrack</h1>
          <span className="text-xs text-muted">Personal finance</span>
        </div>
        <nav>
          {navSections.map((section, i) => (
            <div key={section.heading ?? "root"} className={i > 0 ? "mt-5" : ""}>
              {section.heading && (
                <div className="px-5 pb-1.5 text-xs font-medium text-muted">
                  {section.heading}
                </div>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-5 py-2.5 text-sm transition-colors border-l-2 ${
                      isActive
                        ? "text-accent border-accent bg-accent-soft"
                        : "text-muted border-transparent hover:text-foreground hover:bg-surface-hover"
                    }`
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex justify-end items-center px-8 py-4 border-b border-border">
          <ThemeToggle />
        </div>
        <div className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/import" element={<Import />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/performance" element={<Performance />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
