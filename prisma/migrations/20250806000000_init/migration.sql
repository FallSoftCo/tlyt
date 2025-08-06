-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "workos_id" TEXT,
    "email" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."videos" (
    "id" TEXT NOT NULL,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "channel_id" TEXT NOT NULL,
    "channel_title" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "duration" TEXT NOT NULL,
    "tags" TEXT[],
    "category_id" TEXT,
    "default_language" TEXT,
    "default_audio_language" TEXT,
    "dimension" TEXT,
    "definition" TEXT,
    "view_count" BIGINT,
    "like_count" BIGINT,
    "comment_count" BIGINT,
    "privacy_status" TEXT,
    "licensed_content" BOOLEAN,
    "chip_cost" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tldr" TEXT NOT NULL,
    "timestamp_seconds" INTEGER[],
    "timestamp_descriptions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_prompt" TEXT,
    "analysis_ids" TEXT[],
    "video_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_ids" TEXT[],
    "request_ids" TEXT[],
    "analysis_ids" TEXT[],
    "is_expanded" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "view_ids" TEXT[],
    "current_position_index" INTEGER NOT NULL DEFAULT 0,
    "page_size" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_workos_id_key" ON "public"."users"("workos_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "videos_youtube_id_key" ON "public"."videos"("youtube_id");

