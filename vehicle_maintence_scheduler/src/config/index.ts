import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  accessToken: process.env.ACCESS_TOKEN || "",
  baseURL: process.env.BASE_URL || "http://20.207.122.201",
};
