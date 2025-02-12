import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import express, { Request, Response, NextFunction } from "express";
import { reactGraph } from "../agent/agent.js";
import { generateJWT, verifyJWT } from "../utils/utils.js";
import { ChatOpenAI } from "@langchain/openai";


const agentRouter = express.Router();
agentRouter.post(
  "/chat",
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { message, token } = req.body;
      if (!verifyJWT(token)) {
        return res.status(401).json({ error: "user unauthorized" });
      }
      console.log("received a request", message);
      if (!message) {
        return res.status(400).json({ error: "Message content is required" });
      }
      let imgData = "";
      if (message.imageUrl) {
        const openai = new ChatOpenAI({ model: "gpt-4o-mini" });
        const response = await openai.invoke([
          new SystemMessage("analyze the image and give a concise description"),
          new HumanMessage({
            content: [
              { type: "text", text: message.text },
              {
                type: "image_url",
                image_url: { url: message.imageUrl },
              },
            ],
          }),
        ]);

        imgData = response.content.toString(); // Return AI's analysis
      }
      const inputMessages = [
        new HumanMessage(
          String(imgData + message.text + `userId is ${token.userId}`)
        ),
      ];
      const config = {
        configurable: { thread_id: token.threadId, userId: token.userId },
        recursionLimit: 50,
      };
      const output = await reactGraph.invoke(
        { messages: inputMessages },
        config
      );

      return res.json(output);
    } catch (error) {
      next(error);
    }
  }
);

agentRouter.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the Sahaai browser API!" });
});


agentRouter.post("/authenticate", (req: Request, res: Response) => {
  const { userId, threadId, sessionId } = req.body;
  console.log("authenticating..", userId, threadId);
  const token = generateJWT(userId, threadId, sessionId);
  res.status(200).json({ token: token });
});


export default agentRouter;
