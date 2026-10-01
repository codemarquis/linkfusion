import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, BarChart, QrCode, User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function NotFound() {
  const { isAuthenticated, user } = useAuth();
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
              <p className="text-sm text-gray-600 mt-1">
                {isAuthenticated 
                  ? "The page you're looking for doesn't exist"
                  : "This page requires authentication"
                }
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-6">
            {isAuthenticated ? (
              <>
                <Link href="/">
                  <Button className="w-full justify-start" variant="outline">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button className="w-full justify-start" variant="outline">
                    <BarChart className="mr-2 h-4 w-4" />
                    Analytics
                  </Button>
                </Link>
                <Link href="/qr-codes">
                  <Button className="w-full justify-start" variant="outline">
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Codes
                  </Button>
                </Link>
                <Link href="/profile">
                  <Button className="w-full justify-start" variant="outline">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Button>
                </Link>
                {user?.isAdmin && (
                  <Link href="/admin">
                    <Button className="w-full justify-start" variant="outline">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Panel
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/signin">
                  <Button className="w-full">
                    Sign In to Continue
                  </Button>
                </Link>
                <Link href="/">
                  <Button className="w-full" variant="outline">
                    <Home className="mr-2 h-4 w-4" />
                    Go to Home
                  </Button>
                </Link>
              </>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
            <p><strong>Available routes:</strong></p>
            <p>• Dashboard: / (authenticated)</p>
            <p>• Analytics: /analytics (authenticated)</p>
            <p>• QR Codes: /qr-codes (authenticated)</p>
            <p>• Profile: /profile (authenticated)</p>
            <p>• Admin: /admin (admin only)</p>
            <p>• Sign In: /signin (public)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
