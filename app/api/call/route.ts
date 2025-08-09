import { NextRequest, NextResponse } from "next/server";
import { PhoneNumberIdentifier } from "@azure/communication-common";
import {} from "@azure/communication-common";
import {
  CallAutomationClient,
  CallConnection,
  CallMediaRecognizeChoiceOptions,
  RecognitionChoice,
  TextSource,
  CallInvite,
  CreateCallOptions,
  CallMedia,
  DtmfTone,
  CallResult,
} from "@azure/communication-call-automation";
import acsClient from "@/app/utils/acs";
import { setCalleeDetail } from "@/app/utils/redis";

let callee: PhoneNumberIdentifier;

async function createOutboundCall() {
  const callInvite: CallInvite = {
    targetParticipant: callee,
    sourceCallIdNumber: {
      phoneNumber: process.env.ACS_RESOURCE_PHONE_NUMBER || "",
    },
  };

  const options: CreateCallOptions = {
    callIntelligenceOptions: {
      cognitiveServicesEndpoint: process.env.COGNITIVE_SERVICES_ENDPOINT,
    },
  };
  console.log("Placing outbound call...");
  const result: CallResult = await acsClient.createCall(
    callInvite,
    (process.env.NODE_ENV === "development"
      ? process.env.CALLBACK_URI
      : process.env.PUBLIC_URL) + "api/callback",
    options
  );
  return result;
}

// To handle a POST request to /api
export async function POST(req: Request) {
  try {
    const { phoneNumber, firstName, lastName, topic } = await req.json();
    callee = {
      phoneNumber,
    };

    const result = await createOutboundCall();
    await setCalleeDetail(result.callConnectionProperties.serverCallId!, {
      firstName,
      lastName,
      topic,
    });
    return NextResponse.json(
      { data: result.callConnectionProperties },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
