import { getAuth } from "firebase-admin/auth";
import { PrismaClient } from "@prisma/client";

export async function post({ request }) {
  const prisma = new PrismaClient();
  const token  = request.headers.get("authorization")?.split("Bearer ")[1] ?? "";
  const decoded = await getAuth().verifyIdToken(token);
  const uid = decoded.uid;
  await prisma.user.upsert({
    where: { id: uid },
    update: {},
    create: { id: uid, email: decoded.email ?? "" },
  });

  const body = await request.json();
  await prisma.book.create({
    data: { title: body.title, author: body.author, userId: uid }
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}