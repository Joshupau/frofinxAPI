import dns from "node:dns"

dns.setServers(['1.1.1.1', '8.8.8.8']);

import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cookieParser from 'cookie-parser';
import type { RequestHandler } from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";

// Load environment variables FIRST, before importing anything that uses them
dotenv.config();

import passport from "./config/passport.js";
import globalErrorHandler from "./middleware/errorHandler.js";
import routers from "./routes/index.js";
import { initialize } from "./initialization/initialize.js";

const app = express();

const CORS_ALLOWED = process.env.ALLOWED_CORS || "";

const corsConfig = {
    origin: CORS_ALLOWED.split(" "),
    methods: ["GET", "POST", "PUT", "DELETE"], // List only` available methods
    credentials: true, // Must be set to true
    allowedHeaders: ["Origin", "Content-Type", "X-Requested-With", "Accept", "Authorization"],
};

app.use(cors(corsConfig));

// Trust proxy to get real client IP from headers
app.set('trust proxy', true);

const server = http.createServer(app);

mongoose
  .connect(process.env.DATABASE_URL || "")
  .then(() => {
    //  Uncomment when you created initialize function for the server
    initialize();
    console.log("MongoDB Connected");
  })
  .catch((err) => console.log(err));
  

app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false, parameterLimit: 50000 }))
app.use(cookieParser() as RequestHandler);
app.use(passport.initialize());
app.use(morgan('dev'));

routers(app);

app.use(globalErrorHandler);
const port = process.env.PORT || 5009; // Dynamic port for deployment
server.listen(port, () => console.log(`Server is running on port: ${port}`));