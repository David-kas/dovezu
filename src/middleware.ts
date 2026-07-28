import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ADMIN", "OPERATOR"];
const PURCHASER_ROLES = ["PURCHASER", "ADMIN", "OPERATOR"];

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role as string | undefined;

    if (path.startsWith("/admin") && role && !ADMIN_ROLES.includes(role)) {
      if (role === "PURCHASER") return NextResponse.redirect(new URL("/purchaser", req.url));
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/purchaser") && role && !PURCHASER_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (path.startsWith("/courier") && role !== "COURIER") {
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
    "/purchaser/:path*",
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
    "/api/returns/:path*",
    "/api/audit-log/:path*",
    "/api/warehouses/:path*",
    "/api/suppliers/:path*",
    "/api/documents/:path*",
    "/api/barcodes/:path*",
    "/api/purchaser/:path*",
    "/api/operator/:path*",
  ],
};
