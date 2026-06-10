import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword, normalizePhone, normalizeTelegram } from "./password";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: {
            login: credentials.login,
            role: "ADMIN",
          },
        });

        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.login,
          role: user.role,
        };
      },
    }),
    CredentialsProvider({
      id: "courier-credentials",
      name: "Courier",
      credentials: {
        identifier: { label: "Phone or Telegram", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const identifier = credentials.identifier.trim();
        const normalizedPhone = normalizePhone(identifier);
        const normalizedTelegram = normalizeTelegram(identifier);

        const user = await prisma.user.findFirst({
          where: {
            role: "COURIER",
            courierStatus: "ACTIVE",
            OR: [
              { login: identifier },
              { phone: { contains: normalizedPhone.slice(-10) } },
              { telegram: normalizedTelegram },
            ],
          },
        });

        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { isOnline: true, lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.login,
          role: user.role,
        };
      },
    }),
    CredentialsProvider({
      id: "qr-token",
      name: "QR",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const user = await prisma.user.findFirst({
          where: {
            qrToken: credentials.token,
            role: "COURIER",
            courierStatus: "ACTIVE",
          },
        });

        if (!user) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { isOnline: true, lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.login,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
