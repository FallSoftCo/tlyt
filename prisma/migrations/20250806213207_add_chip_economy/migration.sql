-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('PURCHASE', 'ANALYSIS_SPEND', 'ADMIN_CREDIT', 'ADMIN_DEBIT');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "chip_balance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."chip_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "chip_amount" INTEGER NOT NULL,
    "price_usd" INTEGER NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chip_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "chip_amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "stripe_session_id" TEXT,
    "video_id" TEXT,
    "package_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chip_packages_stripe_price_id_key" ON "public"."chip_packages"("stripe_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_stripe_session_id_key" ON "public"."transactions"("stripe_session_id");

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."chip_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
