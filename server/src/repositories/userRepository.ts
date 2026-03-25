import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const userRepository = {
  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      include: {
        globalProgress: true,
        emailPreference: true,
        playerProfile: true,
      },
    }),
  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
      include: { globalProgress: true, emailPreference: true, playerProfile: true },
    }),
  findByUsername: (username: string) =>
    prisma.user.findUnique({
      where: { username },
      include: { globalProgress: true, emailPreference: true, playerProfile: true },
    }),
  findByGoogleId: (googleId: string) =>
    prisma.user.findUnique({
      where: { googleId },
      include: { globalProgress: true, emailPreference: true, playerProfile: true },
    }),
  createUser: (data: Prisma.UserCreateInput) =>
    prisma.user.create({
      data,
      include: {
        globalProgress: true,
        emailPreference: true,
        playerProfile: true,
      },
    }),
  updateUser: (id: string, data: Prisma.UserUpdateInput) =>
    prisma.user.update({
      where: { id },
      data,
      include: {
        globalProgress: true,
        emailPreference: true,
        playerProfile: true,
      },
    }),
  promoteToAdmin: (id: string) =>
    prisma.user.update({
      where: { id },
      data: { isAdmin: true },
      include: {
        globalProgress: true,
        emailPreference: true,
        playerProfile: true,
      },
    }),
  ensureUserScaffolding: async (userId: string) => {
    await prisma.userGlobalProgress.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    await prisma.emailReminderPreference.upsert({
      where: { userId },
      update: {},
      create: { userId, dailyReminderEnabled: true },
    });
  },
};
