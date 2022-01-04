import NextAuth, { CookieOption } from "next-auth";
import Providers from "next-auth/providers";
import { authenticator } from "otplib";

import { ErrorCode, Session, verifyPassword } from "@lib/auth";
import { NEXTAUTH_URL } from "@lib/config/constants";
import { symmetricDecrypt } from "@lib/crypto";
import prisma from "@lib/prisma";

const useSecureCookies = NEXTAUTH_URL.startsWith("https://");
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const hostName = new URL(NEXTAUTH_URL).hostname;
const cookieOptions: CookieOption["options"] = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: useSecureCookies,
  domain: process.env.NEXTAUTH_COOKIE_DOMAIN || hostName,
};

export default NextAuth({
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: cookieOptions,
    },
    callbackUrl: {
      name: `__Secure-next-auth.callback-url`,
      options: { ...cookieOptions, httpOnly: false, secure: true },
    },
    csrfToken: {
      name: `__Host-next-auth.csrf-token`,
      options: { ...cookieOptions, secure: true },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: cookieOptions,
    },
  },
  session: {
    jwt: true,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error", // Error code passed in query string as ?error=
  },
  providers: [
    Providers.Credentials({
      name: "Cal.com",
      credentials: {
        email: { label: "Email Address", type: "email", placeholder: "john.doe@example.com" },
        password: { label: "Password", type: "password", placeholder: "Your super secure password" },
        totpCode: { label: "Two-factor Code", type: "input", placeholder: "Code from authenticator app" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.toLowerCase(),
          },
        });

        if (!user) {
          throw new Error(ErrorCode.UserNotFound);
        }

        if (!user.password) {
          throw new Error(ErrorCode.UserMissingPassword);
        }

        const isCorrectPassword = await verifyPassword(credentials.password, user.password);
        if (!isCorrectPassword) {
          throw new Error(ErrorCode.IncorrectPassword);
        }

        if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            throw new Error(ErrorCode.SecondFactorRequired);
          }

          if (!user.twoFactorSecret) {
            console.error(`Two factor is enabled for user ${user.id} but they have no secret`);
            throw new Error(ErrorCode.InternalServerError);
          }

          if (!process.env.CALENDSO_ENCRYPTION_KEY) {
            console.error(`"Missing encryption key; cannot proceed with two factor login."`);
            throw new Error(ErrorCode.InternalServerError);
          }

          const secret = symmetricDecrypt(user.twoFactorSecret, process.env.CALENDSO_ENCRYPTION_KEY);
          if (secret.length !== 32) {
            console.error(
              `Two factor secret decryption failed. Expected key with length 32 but got ${secret.length}`
            );
            throw new Error(ErrorCode.InternalServerError);
          }

          const isValidToken = authenticator.check(credentials.totpCode, secret);
          if (!isValidToken) {
            throw new Error(ErrorCode.IncorrectTwoFactorCode);
          }
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt(token, user) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session(session, token) {
      const calendsoSession: Session = {
        ...session,
        user: {
          ...session.user,
          id: token.id as number,
          username: token.username as string,
        },
      };
      return calendsoSession;
    },
  },
});
