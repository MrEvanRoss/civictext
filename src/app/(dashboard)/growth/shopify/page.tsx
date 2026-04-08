"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ShoppingBag, Construction } from "lucide-react";

export default function ShopifyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Shopify Integration
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect your Shopify store to capture customer phone numbers.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
              <Construction className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Shopify Integration — Coming Soon
              </CardTitle>
              <CardDescription>
                This feature is under development.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Soon you will be able to connect your Shopify store and automatically
            add customers who opt in at checkout to your CivicText contact list.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Planned features:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>One-click Shopify store connection</li>
              <li>Automatic checkout opt-in capture</li>
              <li>Sync customer data (name, email, purchase history)</li>
              <li>Post-purchase text message automation</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
