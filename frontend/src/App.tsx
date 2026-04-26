import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Import from "./pages/Import";

const navItems = [
  { to: "/", label: "Dashboard", icon: "◈" },
  { to: "/accounts", label: "Accounts", icon: "◉" },
  { to: "/import", label: "Import", icon: "◎" },
];

export default function App() {
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
          {navItems.map((item) => (
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
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/import" element={<Import />} />
        </Routes>
      </main>
    </div>
  );
}
