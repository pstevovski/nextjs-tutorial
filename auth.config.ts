import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboardPage = nextUrl.pathname.startsWith("/dashboard");

      if (isOnDashboardPage) {
        // check if user is logged in and if so, allow access
        if (isLoggedIn) return true;

        // otherwise redirect the user to the login page
        return false;
      } else if (isLoggedIn) {
        // if user is logged allow access to protected dashboard pages
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
