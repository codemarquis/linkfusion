import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/hooks/useAuth";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const items = [
    { href: "/", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/qr-codes", label: "QR Codes" },
    { href: "/profile", label: "Profile" },
    ...(user?.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const initial = (user?.firstName?.[0] ?? user?.email[0] ?? "U").toUpperCase();

  return (
    <nav className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              LinkFusion
            </Link>
            <div className="hidden md:flex md:gap-2">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={location === item.href ? "page" : undefined}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    location === item.href
                      ? "text-gray-900 dark:text-white border-primary"
                      : "text-gray-500 border-transparent hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden md:block">
              {user?.firstName || user?.email.split("@")[0]}
            </span>
            {user?.profileImageUrl ? (
              <img
                className="h-8 w-8 rounded-full object-cover border border-gray-200"
                src={user.profileImageUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm"
                aria-hidden="true"
              >
                {initial}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={signOut} className="hidden md:inline-flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <div className="md:hidden pb-3 space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  location === item.href ? "bg-gray-100 dark:bg-gray-800" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button onClick={signOut} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50">
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
