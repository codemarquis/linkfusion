import { QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { Redirect, Route, Switch } from "wouter";
import Navigation from "@/components/ui/navigation";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import Admin from "@/pages/admin";
import Analytics from "@/pages/analytics";
import SignIn from "@/pages/auth/signin";
import SignUp from "@/pages/auth/signup";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Privacy from "@/pages/legal/privacy";
import Terms from "@/pages/legal/terms";
import NotFound from "@/pages/not-found";
import Profile from "@/pages/profile";
import QrCodes from "@/pages/qr-codes";
import ApiDocs from "@/pages/support/docs";
import Support from "@/pages/support/help";

function Private({ component: Page, admin = false }: { component: ComponentType; admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/signin" />;
  if (admin && !user.isAdmin) return <NotFound />;
  return (
    <>
      <Navigation />
      <main>
        <Page />
      </main>
    </>
  );
}

function Router() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/signin">{isAuthenticated ? <Redirect to="/" /> : <SignIn />}</Route>
      <Route path="/signup">{isAuthenticated ? <Redirect to="/" /> : <SignUp />}</Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/docs" component={ApiDocs} />
      <Route path="/support" component={Support} />
      <Route path="/">{isAuthenticated ? <Private component={Home} /> : <Landing />}</Route>
      <Route path="/analytics">
        <Private component={Analytics} />
      </Route>
      <Route path="/qr-codes">
        <Private component={QrCodes} />
      </Route>
      <Route path="/profile">
        <Private component={Profile} />
      </Route>
      <Route path="/admin">
        <Private component={Admin} admin />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
