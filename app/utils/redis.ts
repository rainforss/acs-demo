import { Redis } from "ioredis";

declare global {
  var redisClient: Redis;
}

if (!global.redisClient) {
  global.redisClient = new Redis(
    "redis://default:b7tA6vMnf4GPckK85BvIyCPFeqze8zQJ@redis-14401.c92.us-east-1-3.ec2.redns.redis-cloud.com:14401"
  );
  console.log(global.redisClient);
}

export default global.redisClient;

global.redisClient.on("error", (error) => {
  if (error.name === "ECONNRESET") {
    console.log("Connection to Redis Session Store timed out.");
  } else if (error.name === "ECONNREFUSED") {
    console.log("Connection to Redis Session Store refused!");
  } else console.log(error);
});

// Listen to 'reconnecting' event to Redis
global.redisClient.on("reconnecting", () => {
  if (global.redisClient.status === "reconnecting")
    console.log("Reconnecting to Redis Session Store...");
  else console.log("Error reconnecting to Redis Session Store.");
});

// Listen to the 'connect' event to Redis
global.redisClient.on("connect", (err: any) => {
  if (!err) console.log("Connected to Redis Session Store!");
});

export const getCalleeDetail = async (serverCallId: string) => {
  const callDetail = await global.redisClient.get(serverCallId);
  return callDetail;
};

export const setCalleeDetail = async (
  serverCallId: string,
  callDetail: object
) => {
  try {
    const detail = JSON.stringify(callDetail);
    await global.redisClient.set(serverCallId, detail);
  } catch (error) {
    console.log(error);
  }
};
