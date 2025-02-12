
import { z } from "zod";
import {
  StateGraph,
  END,
  Annotation,
  messagesStateReducer,
  START,
} from "@langchain/langgraph";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { v4 as uuidv4 } from "uuid";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import {
  CacheClient,
  Configurations,
  CredentialProvider,
} from "@gomomento/sdk";
import { MomentoCache } from "@langchain/community/caches/momento";
import { tool } from "@langchain/core/tools";
import { weatherTool } from "../tools/weather.js";

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    // `messagesStateReducer` function defines how `messages` state key should be updated
    // (in this case it appends new messages to the list and overwrites messages with the same ID)
    reducer: messagesStateReducer,
  }),
});

//Checkpointer for thread persistence
const checkpointer = PostgresSaver.fromConnString(
  process.env.POSTGRES_DB_URI as string
);

// NOTE: you need to call .setup() the first time you're using your checkpointer
await checkpointer.setup();

//cache for response caching
// See https://github.com/momentohq/client-sdk-javascript for connection options
const client = new CacheClient({
  configuration: Configurations.Laptop.v1().withClientTimeoutMillis(10000),
  credentialProvider: CredentialProvider.fromEnvironmentVariable({
    environmentVariableName: "MOMENTO_API_KEY",
  }),
  defaultTtlSeconds: 60 * 60 * 24,
});

export const cache = await MomentoCache.fromProps({
  client,
  cacheName: "langchain",
});

/*const createPostgresStore = async (): Promise<PostgresStore> => {
  const store = await InMemoryStore.fromConnString(globals.getPostgresDbUri(), {
    index: {
      dims: 1536,
      embed: { model: "llama3" },
    },
  });
  await store.setup();
  return store;
};

const postgresStore = await createPostgresStore();*/

const prettyPrint = (message: BaseMessage) => {
  let txt = `[${message._getType()}]: ${message.content}`;
  if (
    (isAIMessage(message) && (message as AIMessage)?.tool_calls?.length) ||
    0 > 0
  ) {
    const tool_calls = (message as AIMessage)?.tool_calls
      ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
      .join("\n");
    txt += ` \nTools: \n${tool_calls}`;
  }
  console.log(txt);
};

const sysMsg = new SystemMessage({
  content: `You are an agent capable of efficiently answering the user queries`,
});

export const ActionTakenSchema = z.object({
  helperText: z.string(),
  completeResponse: z.string(),
  nextSteps: z.array(z.string()),
});

export const finalResponseSchema = z.object({
  finalResponse: ActionTakenSchema,
});

const tools = [weatherTool];
const model = new ChatOpenAI({ model: "gpt-4o-mini", cache: cache }).bindTools(
  tools,
  { parallel_tool_calls: false }
);

const toolNode = new ToolNode(tools);

const assistant = async (state: typeof StateAnnotation.State) => {
  console.log(
    "assistant processing message:",
    state.messages[state.messages.length - 1]
  );
  const messages = state.messages;
  //console.log(JSON.stringify(messages));
  //const html = await getPageHTML();

  const response = await model.invoke([sysMsg, ...messages]);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
};

const respond = async (state: typeof StateAnnotation.State) => {
  console.log("responding");
  console.log("all messages are:", JSON.stringify(state.messages));
  const response = await model.invoke([
    new HumanMessage(state.messages.slice(-1)[0].content as string),
  ]);

  return {
    finalResponse: response,
  };
};

const shouldContinue = (state: typeof StateAnnotation.State) => {
  console.log("continuing");
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const last2Message = state.messages[state.messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;
  const toolContent = last2Message.content as string;
  console.log(content);
  if (content.includes("error") || toolContent.includes("error"))
    return "respond";
  return lastMessage.tool_calls?.length ? "continue" : "respond";
};

//const llmWithTools = model.bindTools(tools);
//const structuredLLM = model.withStructuredOutput(ActionTaken);

const builder = new StateGraph(StateAnnotation)
  .addNode("assistant", assistant)
  .addNode("tools", toolNode)
  .addNode("respond", respond)
  .addEdge(START, "assistant")
  .addConditionalEdges("assistant", shouldContinue, {
    continue: "tools",
    respond: "respond",
  })
  .addEdge("tools", "assistant")
  .addEdge("respond", END);

export const reactGraph = builder.compile({ checkpointer });
