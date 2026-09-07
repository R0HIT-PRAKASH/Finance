import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Import from "./pages/Import";
import Transactions from "./pages/Transactions";
import Rules from "./pages/Rules";
import Portfolio from "./pages/Portfolio";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";

const navSections: { heading: string | null; items: NavItem[] }[] = [
  { heading: null, items: [{ to: "/", label: "Dashboard", icon: "◈" }] },
  {
    heading: "Banking",
    items: [
      { to: "/accounts", label: "Accounts", icon: "◉" },
      { to: "/transactions", label: "Transactions", icon: "◎" },
      { to: "/import", label: "Import", icon: "↧" },
      { to: "/rules", label: "Rules", icon: "◇" },
    ],
  },
  {
    heading: "Investments",
    items: [{ to: "/portfolio", label: "Portfolio", icon: "◭" }],
  },
];

type NavItem = { to: string; label: string; icon: string };

function AppContent() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-52 shrink-0 bg-muted border-r border-border flex flex-col py-6">
        <div className="px-5 pb-6 border-b border-border mb-4">
          <h1 className="text-sm font-semibold tracking-widest text-primary font-mono">
            FINTRACK
          </h1>
          <span className="text-xs text-muted-foreground font-mono">
            // personal finance
          </span>
        </div>
        <nav>
          {navSections.map((section, i) => (
            <div key={section.heading ?? "root"} className={i > 0 ? "mt-5" : ""}>
              {section.heading && (
                <div className="px-5 pb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest text-muted-foreground/60">
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
                        ? "text-primary border-primary bg-primary/10"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
                    }`
                  }
                >
                  <span>{item.icon}</span>
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
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
