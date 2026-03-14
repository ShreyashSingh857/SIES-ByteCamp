import dotenv from "dotenv";
import app from "./app.js";
// import connectDB from "./src/config/db.js"; // You can uncomment this after defining your DB connection logic

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // await connectDB(); // Ensure DB connects before starting server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port: ${PORT}`);
      console.log(`🌐 Application URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
};

startServer();
