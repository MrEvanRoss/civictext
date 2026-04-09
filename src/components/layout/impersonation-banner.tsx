"use client";

import { useEffect, useState } from "react";
import { getImpersonationInfo } from "@/server/actions/auth";
import { Shield, X } from "lucide-react";

export function ImpersonationBanner() {
  const [info, setInfo] = useState<{ isImpersonating: boolean; orgName?: string } | null>(null);

  useEffect(() => {
    checkImpersonation();
  }, []);

  async function checkImpersonation() {
    try {
      const data = await getImpersonationInfo();
      setInfo(data);
    } catch {
      // Not impersonating or not admin
    }
  }

  if (!info?.isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span>Admin view: You are viewing this account as a client.</span>
      </div>
      <button
        onClick={() => { window.location.href = "/api/admin/stop-impersonate"; }}
        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
      >
        <X className="h-3 w-3" />
        Exit & Return to Admin
      </button>
    </div>
  );
}
