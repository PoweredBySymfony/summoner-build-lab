import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const hashPassword = (value: string) => bcrypt.hash(value, SALT_ROUNDS);

export const verifyPassword = (value: string, hash: string) => bcrypt.compare(value, hash);
