ALTER TABLE "users"
  ADD CONSTRAINT "users_sent_url_bloom_bits_length_check"
  CHECK (
    "sent_url_bloom_bits" IS NULL
    OR char_length("sent_url_bloom_bits") <= 10924
  );
