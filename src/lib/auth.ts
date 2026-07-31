import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "default-expense-tracker-secret-key-change-in-prod",
  providers: [
    CredentialsProvider({
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = creds?.email?.trim().toLowerCase();
        const password = creds?.password ?? "";
        if (!email || !password) return null;
        try {
          const { ensureSchema } = await import("@/lib/db/migrate");
          await ensureSchema();
          const user = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();
          if (!user) return null;
          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;
          return { id: user.id, email: user.email, name: user.name };
        } catch (err) {
          console.error("Auth error:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export const handler = NextAuth(authOptions);
