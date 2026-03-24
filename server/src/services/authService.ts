import { UserAuthProvider } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { slugify } from "../lib/slug.js";
import { userRepository } from "../repositories/userRepository.js";
import { HttpError } from "../utils/http.js";

type RegisterInput = {
  email: string;
  username: string;
  password: string;
};

type GoogleProfile = {
  googleId: string;
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
};

const toSessionUser = (user: {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  googleId?: string | null;
  authProvider: UserAuthProvider;
  passwordHash?: string | null;
}) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatarUrl: user.avatarUrl ?? null,
  authProvider: user.authProvider.toLowerCase(),
  hasPassword: Boolean(user.passwordHash),
  linkedGoogle: Boolean(user.googleId),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function ensureAvailableIdentity(email: string, username: string, ignoreUserId?: string) {
  const [emailUser, usernameUser] = await Promise.all([
    userRepository.findByEmail(email),
    userRepository.findByUsername(username),
  ]);

  if (emailUser && emailUser.id !== ignoreUserId) {
    throw new HttpError(409, "An account already exists for this email.");
  }

  if (usernameUser && usernameUser.id !== ignoreUserId) {
    throw new HttpError(409, "This username is already taken.");
  }
}

async function buildUniqueUsername(seed: string) {
  const base = slugify(seed || "summoner").slice(0, 18) || "summoner";
  let current = base;
  let suffix = 1;

  while (await userRepository.findByUsername(current)) {
    suffix += 1;
    current = `${base.slice(0, Math.max(6, 18 - String(suffix).length - 1))}-${suffix}`;
  }

  return current;
}

function mergeAuthProvider(current: UserAuthProvider, incoming: UserAuthProvider) {
  if (current === incoming) {
    return current;
  }

  return UserAuthProvider.BOTH;
}

export const authService = {
  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const username = input.username.trim();

    await ensureAvailableIdentity(email, username);
    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.createUser({
      email,
      username,
      passwordHash,
      authProvider: UserAuthProvider.EMAIL,
      globalProgress: { create: {} },
      emailPreference: { create: { dailyReminderEnabled: true } },
    });

    return toSessionUser(user);
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(normalizeEmail(email));
    if (!user?.passwordHash) {
      throw new HttpError(401, "Invalid email or password.");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new HttpError(401, "Invalid email or password.");
    }

    await userRepository.ensureUserScaffolding(user.id);
    return toSessionUser(user);
  },

  async getUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError(401, "Session is no longer valid.");
    }

    await userRepository.ensureUserScaffolding(user.id);
    return user;
  },

  async upsertGoogleUser(profile: GoogleProfile) {
    const email = normalizeEmail(profile.email);
    const existingGoogleUser = await userRepository.findByGoogleId(profile.googleId);
    if (existingGoogleUser) {
      const updatedUser = await userRepository.updateUser(existingGoogleUser.id, {
        email,
        avatarUrl: profile.avatarUrl ?? existingGoogleUser.avatarUrl,
        authProvider: mergeAuthProvider(existingGoogleUser.authProvider, UserAuthProvider.GOOGLE),
      });
      await userRepository.ensureUserScaffolding(updatedUser.id);
      return toSessionUser(updatedUser);
    }

    const existingEmailUser = await userRepository.findByEmail(email);
    if (existingEmailUser) {
      const linkedUser = await userRepository.updateUser(existingEmailUser.id, {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl ?? existingEmailUser.avatarUrl,
        authProvider: mergeAuthProvider(existingEmailUser.authProvider, UserAuthProvider.GOOGLE),
      });
      await userRepository.ensureUserScaffolding(linkedUser.id);
      return toSessionUser(linkedUser);
    }

    const user = await userRepository.createUser({
      email,
      username: await buildUniqueUsername(profile.username ?? email.split("@")[0] ?? "summoner"),
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      authProvider: UserAuthProvider.GOOGLE,
      globalProgress: { create: {} },
      emailPreference: { create: { dailyReminderEnabled: true } },
    });

    return toSessionUser(user);
  },
};
