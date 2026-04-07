import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Sidebar() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const NAV_ITEMS = [
    { to: "/", label: t("nav.dashboard"), icon: "⬡" },
    { to: "/resources", label: t("nav.resources"), icon: "📦" },
    { to: "/resources/batch", label: t("nav.batchImport"), icon: "📥" },
    { to: "/resources/conflicts", label: t("nav.conflicts"), icon: "⚠" },
    { to: "/series", label: t("nav.series"), icon: "📚" },
    { to: "/p2p", label: t("nav.p2p"), icon: "🔗" },
    { to: "/settings", label: t("nav.settings"), icon: "⚙" },
  ];

  return (
    <aside className="w-56 h-full bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3 overflow-y-auto flex-shrink-0">
      <div className="mb-8 px-3">
        <span className="text-lg font-bold text-purple-400 tracking-tight">res-mgr</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const active =
            to === "/"
              ? pathname === "/"
              : to === "/resources"
              ? pathname === "/resources" ||
                (pathname.startsWith("/resources/") &&
                  !pathname.startsWith("/resources/conflicts") &&
                  !pathname.startsWith("/resources/batch") &&
                  /^\/resources\/[a-z]+\/\d+/.test(pathname))
              : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
