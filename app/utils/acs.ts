import { CallAutomationClient } from "@azure/communication-call-automation";

const connectionString = process.env.CONNECTION_STRING || "";
const acsClient = new CallAutomationClient(connectionString);
console.log("Initialized ACS Client.");

export default acsClient;
