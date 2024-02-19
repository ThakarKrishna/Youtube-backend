import { app } from "./app.js";
import connectDB from "./db/index.js";
import dotenv from "dotenv";

dotenv.config({
  path: "./.env",
});

const port = process.env.PORT || 5050;

connectDB()
  .then(() => {
    app.listen(port, () => {
      `Server is listening on port ${port}`;
    });
  })
  .catch((err) => console.log("MongoDB Connection Failed !!", err));
