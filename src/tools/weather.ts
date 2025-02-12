import { tool } from "@langchain/core/tools";
import { z } from "zod";
export const weatherTool = tool(
    async ({ query }) => {
        console.log("getting weather....");
        try {
            // This is a placeholder for the actual implementation
            if (
                query.toLowerCase().includes("sf") ||
                query.toLowerCase().includes("san francisco")
            ) {
                return "It's 60 degrees and foggy.";
            }
            return "It's 90 degrees and sunny.";
        } catch (e) {
            return `error getting weather: ${e}`;
        }
    },
    {
        name: "weather",
        description: "Call to get the current weather for a location.",
        schema: z.object({
            query: z.string().describe("The query to use in your search."),
        }),
    }
);


