const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
  });

  const result = await model.generateContent("Hello");
  console.log(result.response.text());
}

run();