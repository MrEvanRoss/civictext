"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function Topbar() {
  const { data: session } = useSession();

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {session?.user?.name && (
            <span>
              {session.user.name} &middot;{" "}
              <span className="capitalize">
                {session.user.role?.toLowerCase()}
              </span>
            </span>
          )}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
