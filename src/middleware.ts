import { withAuth } from "next-auth/middleware";

/**
 * Protect all routes except public auth pages, the API auth endpoints, and
 * static assets. The matcher narrows this so we don't run middleware on every
 * asset request.
 */
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico|login|signup|$).*)",
  ],
};
