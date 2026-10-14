import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "../auth/useAuth";

// The account circle shows the first letter of the email. Its menu holds
// the email and Sign out. Closes on outside click or Escape.
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user) return null;

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.email}`}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary font-sans text-base font-medium text-on-primary outline-none transition-colors active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/30"
      >
        {user.email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-hairline bg-canvas p-2"
        >
          <p className="truncate px-3 py-2 text-sm text-muted" title={user.email}>
            {user.email}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium text-ink outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-primary/30"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
