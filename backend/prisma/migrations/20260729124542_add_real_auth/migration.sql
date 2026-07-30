-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'EMAIL';

-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_userId_fkey";

-- AlterTable
ALTER TABLE "GameSession" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
