import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "⬡" },
  { to: "/resources", label: "Resources", icon: "📦" },
  { to: "/p2p", label: "P2P Rooms", icon: "🔗" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3">
      <div className="mb-8 px-3">
        <span className="text-lg font-bold text-purple-400 tracking-tight">res-mgr</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={[
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-purple-900/50 text-purple-300 font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800",
              ].join(" ")}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
