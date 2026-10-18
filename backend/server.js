import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Db_query from "./routes/Db_query.js";
import Email from "./routes/email.js"
import Extract from "./routes/extract.js"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use("/api/db", Db_query);
app.use("/api/tool",Email)
app.use("/api/content",Extract)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});