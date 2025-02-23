import { signUpSchema } from "@/lib/zod";
import { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

const prisma = new PrismaClient();

interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const data: SignUpRequest = await req.json();

    const { name, email, password } = await signUpSchema.parseAsync(data);
    const mail = email.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: mail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user: User = await prisma.user.create({
      data: { name, email: mail, password: hashedPassword },
    });

    return NextResponse.json(
      { message: "User registered successfully", user },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid Creadentials" },
        { status: 400 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "An unexpected error occurred" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
