import httpServer from "./api/index";
import dotenv from "dotenv";
dotenv.config();

httpServer.listen( { port: process.env.PORT });
console.log(`🚀 Server is running at ${process.env.PUBLIC_URL}:${process.env.PORT}`);
