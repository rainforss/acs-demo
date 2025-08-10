import { NextRequest, NextResponse } from "next/server";
import {
  CommunicationIdentifier,
  PhoneNumberIdentifier,
} from "@azure/communication-common";
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
} from "@azure/communication-call-automation";
import acsClient from "@/app/utils/acs";
import { getCalleeDetail } from "@/app/utils/redis";

let callConnectionId: string;
let callConnection: CallConnection;
let serverCallId: string;

const confirmText = `Thank you for confirming, we are connecting you to a representative now.`;
const cancelText = `Thank you for your interest, we're looking forward to working with you in the future.`;
const customerQueryTimeout = `I’m sorry I didn’t receive a response, please try again.`;
const noResponse = `I didn't receive an input, we will try again later. Goodbye.`;
const invalidAudio = `I’m sorry, I didn’t understand your response, please try again.`;
const confirmLabel = `Confirm`;
const cancelLabel = `Cancel`;
const retryContext = `Retry`;

async function handlePlay(callConnectionMedia: CallMedia, textContent: string) {
  const play: TextSource = {
    text: textContent,
    voiceName: "en-US-NancyNeural",
    kind: "textSource",
  };
  await callConnectionMedia.playToAll([play]);
}

async function getChoices() {
  const choices: RecognitionChoice[] = [
    {
      label: confirmLabel,
      phrases: ["Confirm", "First", "One"],
      tone: DtmfTone.One,
    },
    {
      label: cancelLabel,
      phrases: ["Cancel", "Second", "Two"],
      tone: DtmfTone.Two,
    },
  ];

  return choices;
}

async function startRecognizing(
  callee: CommunicationIdentifier,
  callMedia: CallMedia,
  textToPlay: string,
  context: string
) {
  const playSource: TextSource = {
    text: textToPlay,
    voiceName: "en-US-NancyNeural",
    kind: "textSource",
  };

  const recognizeOptions: CallMediaRecognizeChoiceOptions = {
    choices: await getChoices(),
    interruptPrompt: false,
    initialSilenceTimeoutInSeconds: 10,
    playPrompt: playSource,
    operationContext: context,
    kind: "callMediaRecognizeChoiceOptions",
  };

  await callMedia.startRecognizing(callee, recognizeOptions);
}

async function hangUpCall() {
  callConnection.hangUp(true);
}

// To handle a POST request to /api
export async function POST(req: Request) {
  console.log("callback received");
  const data = await req.json();
  const event = data[0];
  const eventData = event.data;
  callConnectionId = eventData.callConnectionId;
  serverCallId = eventData.serverCallId;
  console.log(
    "Call back event received, callConnectionId=%s, serverCallId=%s, eventType=%s",
    callConnectionId,
    serverCallId,
    event.type
  );
  console.log(eventData);

  callConnection = acsClient.getCallConnection(callConnectionId);
  const callees = (await callConnection.listParticipants()).values;
  const callMedia = callConnection.getCallMedia();
  if (event.type === "Microsoft.Communication.CallConnected") {
    // (Optional) Add a Microsoft Teams user to the call.  Uncomment the below snippet to enable Teams Interop scenario.
    // await acsClient.getCallConnection(callConnectionId).addParticipant({
    //   targetParticipant: { phoneNumber: "+15879006508" },
    //   sourceDisplayName: "Jake (Contoso Tech Support)",
    //   sourceCallIdNumber: {
    //     phoneNumber: process.env.ACS_RESOURCE_PHONE_NUMBER,
    //   },
    // });

    console.log("Received CallConnected event");
    if (callees && callees.length > 0) {
      const calleeInfoString = await getCalleeDetail(callConnectionId);
      const calleeInfo = await JSON.parse(calleeInfoString!);
      const callText = `Hello ${calleeInfo.firstName} ${calleeInfo.lastName}, this is Bath Fitter, we’re calling to follow up with you regarding your interest in ${calleeInfo.topic}. Please say confirm if you want to be connected to our representative or say cancel if no longer need our service.`;
      await startRecognizing(callees[0].identifier!, callMedia, callText, "");
    }
  } else if (event.type === "Microsoft.Communication.RecognizeCompleted") {
    if (eventData.recognitionType === "choices") {
      var context = eventData.operationContext;
      const labelDetected = eventData.choiceResult.label;
      const phraseDetected = eventData.choiceResult.recognizedPhrase;
      console.log(
        "Recognition completed, labelDetected=%s, phraseDetected=%s, context=%s",
        labelDetected,
        phraseDetected,
        eventData.operationContext
      );
      const textToPlay =
        labelDetected === confirmLabel ? confirmText : cancelText;

      await handlePlay(callMedia, textToPlay);
      await acsClient.getCallConnection(callConnectionId).addParticipant({
        targetParticipant: { phoneNumber: "+15879006508" },
        sourceDisplayName: "Jake",
        sourceCallIdNumber: {
          phoneNumber: process.env.ACS_RESOURCE_PHONE_NUMBER!,
        },
      });
    }
  } else if (event.type === "Microsoft.Communication.RecognizeFailed") {
    var context = eventData.operationContext;
    if (context !== "" && context === retryContext) {
      await handlePlay(callMedia, noResponse);
    } else {
      const resultInformation = eventData.resultInformation;
      var code = resultInformation.subCode;
      console.log(
        "Recognize failed: data=%s",
        JSON.stringify(eventData, null, 2)
      );

      let replyText = "";
      switch (code) {
        case 8510:
        case 8511:
          replyText = customerQueryTimeout;
          break;
        case 8534:
        case 8547:
          replyText = invalidAudio;
          break;
        default:
          replyText = customerQueryTimeout;
      }
      if (callees && callees.length > 0) {
        await startRecognizing(
          callees[0].identifier!,
          callMedia,
          replyText,
          retryContext
        );
      }
    }
  }

  return NextResponse.json({ message: data }, { status: 200 });
}
