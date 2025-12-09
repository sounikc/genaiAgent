import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const app = express();
app.use(bodyParser.json());

// 1. Initialize LangChain Gemini Model
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash", // You can use other models also
  temperature: 0.2,
});


const getWeatherData = async (city)=> {
  const response = await fetch(`http://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${process.env.OPEN_WEATHER_API_KEY}`);
  const responseData = await response.json();

  return {
    city: responseData.name,
    temp: responseData.main.temp,
    feels: responseData.main.feels_like,
    desc: responseData.weather[0].description
  }
}

// 2. Manual input (NO prompt templates)
app.post("/chat", async (req, res) => {
  try {
    const userInput = req.query.input;

    const aiInvokeContent = [
      {
        role: 'user',
        content: `Pick city name from the below sentence
        ${userInput}`
      }
    ]

    // Send raw input to LangChain LLM
    const aiResponse1 = await model.invoke(aiInvokeContent);
    const cityName = aiResponse1.content;

    const weather = await getWeatherData(cityName);

    const aiResponse2 = await model.invoke([
      {
        role: 'user',
        content: `format this nicely and add some imoji also
        Temperature: ${weather.temp}
        Feels like: ${weather.feels}
        Description: ${weather.desc}`
      }
    ])

    res.json({ reply: aiResponse2.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running on", process.env.PORT || 3000);
});
