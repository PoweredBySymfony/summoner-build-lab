-- CreateEnum
CREATE TYPE "UserAuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'BOTH');

-- DropForeignKey
ALTER TABLE "AuthProviderAccount" DROP CONSTRAINT "AuthProviderAccount_userId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authProvider" "UserAuthProvider" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- DropTable
DROP TABLE "AuthProviderAccount";

-- DropEnum
DROP TYPE "AuthProvider";

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");
