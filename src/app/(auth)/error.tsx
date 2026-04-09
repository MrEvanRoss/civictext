"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth error]", error);
  }, [error]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <CardTitle>Something went wrong</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">
          We ran into an issue loading this page. Please try again or return to
          the login page.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => (window.location.href = "/login")}>
          Back to Login
        </Button>
        <Button onClick={reset}>Try Again</Button>
      </CardFooter>
    </Card>
  );
}
