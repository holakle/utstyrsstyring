ALTER TABLE "Asset"
ADD COLUMN "barcode" TEXT;

CREATE UNIQUE INDEX "Asset_barcode_key" ON "Asset"("barcode");
