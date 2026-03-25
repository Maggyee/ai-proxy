-- Migration: 0002_user_source_rss_fields
-- 在 UserSource 表新增 sourceType、feedUrl、siteUrl 三个字段
-- 纯新增列，不修改主键/索引/约束，完全向后兼容

-- sourceType：来源类型，默认 wordpress，历史数据自动回填
ALTER TABLE "UserSource" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'wordpress';

-- feedUrl：RSS Feed 地址，可为空（WordPress 源不需要）
ALTER TABLE "UserSource" ADD COLUMN "feedUrl" TEXT;

-- siteUrl：站点主页地址，可为空（供 UI 展示用）
ALTER TABLE "UserSource" ADD COLUMN "siteUrl" TEXT;
