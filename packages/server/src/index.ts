import mongoose from "mongoose";
import { env } from "./config/env";
import { createApp } from "./app";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  // eslint-disable-next-line no-console
  console.log("Connected to MongoDB");

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
