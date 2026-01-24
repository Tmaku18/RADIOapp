import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/AuthGuard";
import DashboardLayout from "./components/DashboardLayout";

export const metadata: Metadata = {
  title: "Radio App Admin",
  description: "Admin dashboard for Radio Streaming Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <AuthProvider>
          <AuthGuard>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
