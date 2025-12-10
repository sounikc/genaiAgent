import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import fs from "fs";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. Initialize LangChain Gemini Model
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash", // You can use other models also
  temperature: 0.2,
});

const getWeatherData = async (city) => {
  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.OPEN_WEATHER_API_KEY}`
  );
  const responseData = await response.json();

  return {
    city: responseData.name,
    temp: responseData.main.temp,
    feels: responseData.main.feels_like,
    desc: responseData.weather[0].description,
  };
};

// 2. Manual input (NO prompt templates)
app.post("/chat", async (req, res) => {
  try {
    const userInput = req.query.input;

    const aiInvokeContent = [
      {
        role: "user",
        content: `Pick city name from the below sentence
        ${userInput}`,
      },
    ];

    // Send raw input to LangChain LLM
    const aiResponse1 = await model.invoke(aiInvokeContent);
    const cityName = aiResponse1.content;

    const weather = await getWeatherData(cityName);

    const aiResponse2 = await model.invoke([
      {
        role: "user",
        content: `format this nicely and add some imoji also
        Temperature: ${weather.temp}
        Feels like: ${weather.feels}
        Description: ${weather.desc}`,
      },
    ]);

    res.json({ reply: aiResponse2.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const upload = multer({ dest: "uploads/" });

app.post("/extractPolicy", upload.single("file"), async (req, res) => {
  try {
    const {prompt} = req.body;
    if (!req.file) res.status(400).json({ message: "pdf file not uploaded" });

    const pdfBuffer = fs.readFileSync(req.file.path);
    const parser = new PDFParse({ data: pdfBuffer });

    const result = await parser.getText();

    const aiPrompt = `${prompt} from the extracted text: ${result.text}`;

    const aiResponse = await model.invoke([
      {
        role: 'user',
        content: `${aiPrompt}`
      }
    ]);

    // Delete file (optional)
    fs.unlinkSync(req.file.path);

    res.json({ message: aiResponse.content });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on", process.env.PORT || 3000);
});
