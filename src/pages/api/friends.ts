import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  const privateKey = (import.meta.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY) as string | undefined;

  if (privateKey && privateKey.trim() !== "") {
    const serviceAccount = {
      project_id:
        import.meta.env.FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        process.env.PUBLIC_FIREBASE_PROJECT_ID ||
        import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
      client_email: import.meta.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey.replace(/\\n/g, "\n"),
    } as const;

    initializeApp({
      credential: cert(serviceAccount as any),
    });
  } else {
    initializeApp();
  }
}

const prisma = new PrismaClient();

function generateFriendCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function authenticateUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const token = authHeader.split("Bearer ")[1];
  const decodedToken = await getAuth().verifyIdToken(token);
  return { userId: decodedToken.uid, decodedToken };
}

export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    if (action === "resolve-username") {
      const username = url.searchParams.get("username");
      if (!username) {
        return new Response(JSON.stringify({ error: "Username required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await prisma.user.findUnique({
        where: { username },
        select: { email: true },
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "Username not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ email: user.email }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { userId, decodedToken } = await authenticateUser(request);

    if (action === "my-code") {
      let user = await prisma.user.findUnique({
        where: { id: userId },
        select: { friendCode: true, displayName: true, email: true },
      });

      if (!user || !user.friendCode) {
        let friendCode;
        let isUnique = false;

        while (!isUnique) {
          friendCode = generateFriendCode();
          const existingUser = await prisma.user.findUnique({
            where: { friendCode },
          });
          if (!existingUser) {
            isUnique = true;
          }
        }

        user = await prisma.user.upsert({
          where: { id: userId },
          update: {
            friendCode: friendCode!,
            displayName: user?.displayName || decodedToken.name || decodedToken.email?.split("@")[0],
          },
          create: {
            id: userId,
            email: decodedToken.email || "",
            friendCode: friendCode!,
            displayName: decodedToken.name || decodedToken.email?.split("@")[0] || "Anonymous",
          },
          select: { friendCode: true, displayName: true, email: true },
        });
      }

      return new Response(
        JSON.stringify({
          friendCode: user.friendCode,
          displayName: user.displayName,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (action === "my-profile") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          username: true,
          bio: true,
          profilePic: true,
          friendCode: true,
        },
      });

      return new Response(JSON.stringify({ user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "check-profile-completion") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          username: true,
          name: true,
          displayName: true,
        },
      });
      const isComplete = !!(user?.username && user?.username.trim() !== "");
      return new Response(
        JSON.stringify({
          isComplete,
          hasUsername: !!user?.username,
          hasName: !!user?.name || !!user?.displayName,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (action === "user-profile") {
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "User ID required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const friendship = await prisma.friendship.findUnique({
        where: {
          userId_friendId: {
            userId: userId,
            friendId: targetUserId,
          },
        },
      });

      if (!friendship && targetUserId !== userId) {
        return new Response(JSON.stringify({ error: "You can only view friends' profiles" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          displayName: true,
          username: true,
          bio: true,
          profilePic: true,
          friendCode: true,
        },
      });

      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const books = await prisma.book.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: "desc" },
      });

      const userBooks = books.map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        notes: book.notes,
        favourite: book.favourite,
        started: book.started,
        finished: book.finished,
        cover_url: null,
      }));

      return new Response(JSON.stringify({ user, books: userBooks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "feed") {
      const friendships = await prisma.friendship.findMany({
        where: { userId: userId },
        select: { friendId: true },
      });

      const friendIds = friendships.map((f: { friendId: string }) => f.friendId);

      if (friendIds.length === 0) {
        return new Response(JSON.stringify({ books: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const books = await prisma.book.findMany({
        where: {
          userId: { in: friendIds },
        },
        include: {
          user: {
            select: {
              name: true,
              displayName: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const feedBooks = books.map((book: any) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        notes: book.notes,
        favourite: book.favourite,
        started: book.started,
        finished: book.finished,
        friend_name: book.user.username || book.user.displayName,
        friend_full_name: book.user.name,
        cover_url: null,
      }));

      return new Response(JSON.stringify({ books: feedBooks }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const friendships = await prisma.friendship.findMany({
      where: { userId: userId },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            displayName: true,
            username: true,
            email: true,
            friendCode: true,
          },
        },
      },
    });

    const friends = friendships.map((friendship: any) => ({
      id: friendship.friend.id,
      name: friendship.friend.name,
      displayName: friendship.friend.displayName,
      username: friendship.friend.username,
      email: friendship.friend.email,
      friendCode: friendship.friend.friendCode,
      createdAt: friendship.createdAt,
    }));

    return new Response(JSON.stringify({ friends }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET /api/friends error:", error);
    return new Response(JSON.stringify({ error: "Request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const { userId, decodedToken } = await authenticateUser(request);
    const body = await request.json();

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "update-profile") {
      const { name, displayName, username, bio, profilePic } = body;

      if (username) {
        const existingUser = await prisma.user.findUnique({
          where: { username },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== userId) {
          return new Response(JSON.stringify({ error: "Username is already taken" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      let friendCode;
      let isUnique = false;
      while (!isUnique) {
        friendCode = generateFriendCode();
        const existingUser = await prisma.user.findUnique({
          where: { friendCode },
        });
        if (!existingUser) {
          isUnique = true;
        }
      }

      const updatedUser = await prisma.user.upsert({
        where: { id: userId },
        update: {
          name: name || undefined,
          displayName: displayName || undefined,
          username: username || undefined,
          bio: bio || undefined,
          profilePic: profilePic || undefined,
        },
        create: {
          id: userId,
          email: decodedToken.email || "",
          friendCode: friendCode!,
          name: name || decodedToken.name || undefined,
          displayName: displayName || decodedToken.name || decodedToken.email?.split("@")[0] || undefined,
          username: username || undefined,
          bio: bio || undefined,
          profilePic: profilePic || undefined,
        },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          username: true,
          bio: true,
          profilePic: true,
          friendCode: true,
        },
      });

      return new Response(
        JSON.stringify({
          message: "Profile updated successfully",
          user: updatedUser,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (action === "save-book") {
      const { title, author, notes, started, finished } = body;

      if (!title) {
        return new Response(JSON.stringify({ error: "Title is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const existing = await prisma.book.findFirst({
        where: {
          userId,
          title: { equals: title, mode: "insensitive" },
          ...(author ? { author: { equals: author, mode: "insensitive" } } : { author: null }),
        },
      });

      if (existing) {
        return new Response(JSON.stringify({ error: "Book already exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      const book = await prisma.book.create({
        data: {
          title: title,
          author: author || null,
          notes: notes || null,
          started: started ? new Date(started) : null,
          finished: finished ? new Date(finished) : null,
          userId: userId,
        },
      });

      return new Response(
        JSON.stringify({
          message: "Book saved successfully",
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { friendCode } = body;

    if (!friendCode || friendCode.length !== 6) {
      return new Response(JSON.stringify({ error: "Invalid friend code" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const friend = await prisma.user.findUnique({
      where: { friendCode },
    });

    if (!friend) {
      return new Response(JSON.stringify({ error: "Friend not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (friend.id === userId) {
      return new Response(JSON.stringify({ error: "Cannot add yourself as a friend" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existingFriendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: {
          userId: userId,
          friendId: friend.id,
        },
      },
    });

    if (existingFriendship) {
      return new Response(JSON.stringify({ error: "Already friends" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await prisma.$transaction([
      prisma.friendship.create({
        data: {
          userId: userId,
          friendId: friend.id,
        },
      }),
      prisma.friendship.create({
        data: {
          userId: friend.id,
          friendId: userId,
        },
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: "Friend added successfully",
        friend: {
          displayName: friend.displayName,
          email: friend.email,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("POST /api/friends error:", error);
    return new Response(JSON.stringify({ error: "Failed to add friend" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE({ request }: { request: Request }) {
  try {
    const { userId } = await authenticateUser(request);
    const body = await request.json();
    const { friendId } = body;

    if (!friendId) {
      return new Response(JSON.stringify({ error: "Friend ID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: {
          userId: userId,
          friendId: friendId,
        },
      }),
      prisma.friendship.deleteMany({
        where: {
          userId: friendId,
          friendId: userId,
        },
      }),
    ]);

    return new Response(
      JSON.stringify({
        message: "Friend removed successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("DELETE /api/friends error:", error);
    return new Response(JSON.stringify({ error: "Failed to remove friend" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
