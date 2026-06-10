import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/courier") && token?.role !== "COURIER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/login") || path.startsWith("/qr")) return true;
        if (path.startsWith("/api/auth") || path.startsWith("/api/health")) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/courier/:path*",
    "/api/products/:path*",
    "/api/couriers/:path*",
    "/api/orders/:path*",
    "/api/transfers/:path*",
    "/api/analytics/:path*",
    "/api/movements/:path*",
    "/api/export/:path*",
    "/api/location/:path*",
    "/api/push/:path*",
    "/api/dashboard/:path*",
    "/api/courier-stock/:path*",
  ],
};
