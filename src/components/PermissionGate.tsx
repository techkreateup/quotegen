"use client";

import { usePermissions } from "@/components/AuthProvider";
import { hasPermission, type Module, type Action } from "@/lib/permissions";
import type { ReactNode } from "react";

interface PermissionGateProps {
  module: Module;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGate({ module, action, children, fallback = null }: PermissionGateProps) {
  const { permissions, isSystemAdmin } = usePermissions();

  if (isSystemAdmin) return <>{children}</>;
  if (hasPermission(permissions, module, action)) return <>{children}</>;
  return <>{fallback}</>;
}
