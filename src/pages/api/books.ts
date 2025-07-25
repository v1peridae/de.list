import { getAuth } from "firebase-admin/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function authenticateUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await getAuth().verifyIdToken(token);
  return { userId: decodedToken.uid, decodedToken };
}

export async function POST({ request }: { request: Request }) {
  try {
    const { userId } = await authenticateUser(request);
    const body = await request.json();

    const { title, author, coverUrl, started, finished, notes, favourite } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const book = await prisma.book.create({
      data: {
        title,
        author: author || null,
        coverUrl: coverUrl || null,
        started: started ? new Date(started) : null,
        finished: finished ? new Date(finished) : null,
        notes: notes || null,
        favourite: favourite || null,
        userId,
      },
    });

    return new Response(
      JSON.stringify({
        message: "Book saved successfully",
        book,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error saving book:", error);
    return new Response(JSON.stringify({ error: "Failed to save book" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET({ request }: { request: Request }) {
  try {
    const { userId } = await authenticateUser(request);

    const books = await prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ books }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch books" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT({ request }: { request: Request }) {
  try {
    const { userId } = await authenticateUser(request);
    const body = await request.json();

    const { bookId, title, author, coverUrl, started, finished, notes, favourite } = body;

    if (!bookId) {
      return new Response(JSON.stringify({ error: "Book ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existingBook = await prisma.book.findFirst({
      where: { id: parseInt(bookId), userId },
    });

    if (!existingBook) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (author !== undefined) updateData.author = author;
    if (coverUrl !== undefined) updateData.coverUrl = coverUrl;
    if (started !== undefined) updateData.started = started ? new Date(started) : null;
    if (finished !== undefined) updateData.finished = finished ? new Date(finished) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (favourite !== undefined) updateData.favourite = favourite;

    const updatedBook = await prisma.book.update({
      where: { id: parseInt(bookId) },
      data: updateData,
    });

    return new Response(
      JSON.stringify({
        message: "Book updated successfully",
        book: updatedBook,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error updating book:", error);
    return new Response(JSON.stringify({ error: "Failed to update book" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE({ request }: { request: Request }) {
  try {
    const { userId } = await authenticateUser(request);
    const body = await request.json();

    const { bookId } = body;

    if (!bookId) {
      return new Response(JSON.stringify({ error: "Book ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existingBook = await prisma.book.findFirst({
      where: { id: parseInt(bookId), userId },
    });

    if (!existingBook) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await prisma.book.delete({
      where: { id: parseInt(bookId) },
    });

    return new Response(
      JSON.stringify({
        message: "Book deleted successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error deleting book:", error);
    return new Response(JSON.stringify({ error: "Failed to delete book" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
