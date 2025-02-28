import { AuthError, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { signInSchema } from "@/lib/zod";
import { comparePassword } from "@/utils/password";
import prisma from "@/utils/db/prisma";
import { Resend } from "resend";
import emailHTML from "@/utils/emailHTML";
import jwt from "jsonwebtoken";

export default {
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    CredentialsProvider({
      credentials: {
        email: {
          label: "email",
          type: "text",
          placeholder: "address@gmail.com",
        },
        password: {
          label: "password",
          type: "password",
          placeholder: "********",
        },
      },
      authorize: async (credentials) => {
        let user: {
          id: string;
          name: string;
          password?: string | null;
          email: string;
          image?: string | null;
          emailVerified?: Date | null;
        } | null = null;

        const { email, password } = await signInSchema.parseAsync(credentials);

        user = await prisma.user.findFirst({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            image: true,
            emailVerified: true,
          },
        });
        if (!user) {
          throw new AuthError("User not found", { cause: "User not found" });
        }
        if (!user.password) {
          throw new AuthError(
            "Try Sign with Google. User password not found.",
            { cause: "Try Sign with Google. User password not found." },
          );
        }
        const isValid = await comparePassword(password, user.password);
        if (!isValid) {
          throw new AuthError("Invalid credentials.", {
            cause: "Invalid credentials.",
          });
        }

        if (!user.emailVerified) {
          const resend = new Resend(process.env.RESEND_API_KEY);

          const obj = {
            userId: user.id,
            token: Math.floor(Math.random() * 10000000000),
          };
          if (!process.env.AUTH_SECRET) {
            throw new AuthError("AUTH_SECRET is not defined", {
              cause: "AUTH_SECRET is not defined",
            });
          }
          const token = jwt.sign(obj, process.env.AUTH_SECRET, {
            expiresIn: "30m",
          });

          await prisma.user.update({
            where: { id: user.id },
            data: {
              verificationToken: token.toString(),
              verificationTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
            },
          });
          const { data, error } = await resend.emails.send({
            from: "verify-email@manojthapa.software",
            to: [user.email],
            subject: "Verify your email",
            html: emailHTML({
              name: user.name,
              link: `http://${process.env.BASE_URL}/verify-email/${token}`,
            }),
          });
          console.log(error);

          if (data?.id)
            throw new AuthError("Email not verified", {
              cause: "Check your email to verify first",
            });

          throw new AuthError("Email not verified", {
            cause: "Email not verified: ",
          });
        }

        if (isValid) return user;

        return null;
      },
    }),
  ],
} satisfies NextAuthConfig;
