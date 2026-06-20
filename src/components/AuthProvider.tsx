"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Permissions } from "@/lib/permissions";

interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE";
  roleName: string;
  roleId: string;
  isSystemAdmin: boolean;
  permissions: Permissions;
  mustResetPassword: boolean;
  employeeId: string | null;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchUser();
  }, []);

  // Global safety net: if any API call returns 403 { tosRequired: true } (e.g. a
  // grandfathered user whose token changed mid-session), send them to accept the
  // Terms. Page navigations are already redirected server-side by the proxy.
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 403 && typeof window !== "undefined" && window.location.pathname !== "/accept-terms") {
        const clone = res.clone();
        clone
          .json()
          .then((body) => {
            if (body?.tosRequired) window.location.href = "/accept-terms";
          })
          .catch(() => {});
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function usePermissions() {
  const { user } = useAuth();
  return {
    permissions: user?.permissions ?? null,
    roleName: user?.roleName ?? "",
    isSystemAdmin: user?.isSystemAdmin ?? false,
  };
}
