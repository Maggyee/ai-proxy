-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthEmailCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "themeMode" TEXT NOT NULL DEFAULT 'system',
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "selectedSourceBaseUrl" TEXT,
    "sourceMode" TEXT NOT NULL DEFAULT 'single',
    "selectedGroupId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSourceGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserSourceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSourceGroupMember" (
    "groupId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserSourceGroupMember_pkey" PRIMARY KEY ("groupId","sourceId")
);

-- CreateTable
CREATE TABLE "UserSavedPost" (
    "userId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserSavedPost_pkey" PRIMARY KEY ("userId","sourceBaseUrl","postId")
);

-- CreateTable
CREATE TABLE "UserLikedPost" (
    "userId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserLikedPost_pkey" PRIMARY KEY ("userId","sourceBaseUrl","postId")
);

-- CreateTable
CREATE TABLE "UserReadingProgress" (
    "userId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserReadingProgress_pkey" PRIMARY KEY ("userId","sourceBaseUrl","postId")
);

-- CreateTable
CREATE TABLE "UserAiSummary" (
    "userId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPointsJson" TEXT NOT NULL,
    "keywordsJson" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserAiSummary_pkey" PRIMARY KEY ("userId","sourceBaseUrl","postId")
);

-- CreateTable
CREATE TABLE "UserAiThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceBaseUrl" TEXT NOT NULL,
    "postId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserAiThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAiMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserAiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncChangeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "version" BIGSERIAL NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthEmailCode_email_createdAt_idx" ON "AuthEmailCode"("email", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key" ON "AuthRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthRefreshToken_userId_createdAt_idx" ON "AuthRefreshToken"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserSource_userId_updatedAt_idx" ON "UserSource"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSource_userId_baseUrl_key" ON "UserSource"("userId", "baseUrl");

-- CreateIndex
CREATE INDEX "UserSourceGroup_userId_updatedAt_idx" ON "UserSourceGroup"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserSavedPost_userId_updatedAt_idx" ON "UserSavedPost"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserLikedPost_userId_updatedAt_idx" ON "UserLikedPost"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserReadingProgress_userId_updatedAt_idx" ON "UserReadingProgress"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserAiSummary_userId_updatedAt_idx" ON "UserAiSummary"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserAiThread_userId_updatedAt_idx" ON "UserAiThread"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserAiMessage_threadId_createdAt_idx" ON "UserAiMessage"("threadId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SyncChangeLog_userId_version_idx" ON "SyncChangeLog"("userId", "version" DESC);

-- AddForeignKey
ALTER TABLE "AuthRefreshToken" ADD CONSTRAINT "AuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSource" ADD CONSTRAINT "UserSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSourceGroup" ADD CONSTRAINT "UserSourceGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSourceGroupMember" ADD CONSTRAINT "UserSourceGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserSourceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSourceGroupMember" ADD CONSTRAINT "UserSourceGroupMember_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "UserSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSavedPost" ADD CONSTRAINT "UserSavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLikedPost" ADD CONSTRAINT "UserLikedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReadingProgress" ADD CONSTRAINT "UserReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAiSummary" ADD CONSTRAINT "UserAiSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAiThread" ADD CONSTRAINT "UserAiThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAiMessage" ADD CONSTRAINT "UserAiMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "UserAiThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncChangeLog" ADD CONSTRAINT "SyncChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

