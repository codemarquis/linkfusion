import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export const REPO_URL = "https://github.com/codemarquis/LinkFusion";

export function PublicPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to LinkFusion</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="prose prose-gray dark:prose-invert max-w-none">{children}</div>
      </div>
    </div>
  );
}
