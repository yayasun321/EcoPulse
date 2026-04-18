import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/shopping", async (req, res) => {
  try {
    const response = await fetch("https://google.serper.dev/shopping", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("running"));