require('dotenv').config()
let { Voice, Task, Messaging } = require('@signalwire/realtime-api')
const axios = require('axios').default;

const client = new Voice.Client({
  project: process.env.SIGNALWIRE_PROJECT_ID,
  token: process.env.SIGNALWIRE_TOKEN,
  contexts: ['office'],
  debug: {
    logWsTraffic: false,
  },
})

const Messagingclient = new Messaging.Client({
  project: process.env.SIGNALWIRE_PROJECT_ID,
  token: process.env.SIGNALWIRE_TOKEN,
  contexts: ['office'],
});
/*



Messagingclient.on("message.received", (message) => {
  console.log("message.received", message);
});


 */

const taskClient = new Task.Client({
  project: process.env.SIGNALWIRE_PROJECT_ID,
  token: process.env.SIGNALWIRE_TOKEN,
  contexts: ['office']
})

taskClient.on('task.received', async (payload) => {
  console.log('Task Received', payload)
  console.log("payload type is " + payload.type)
  if (payload.type == "voice"){
    await reportStatus('STARTED')
    await reportStatus(`Calling ${payload.number}`)
    try {
      const call = await client.dialPhone({
        from: process.env.CALLER_ID,
        to: payload.number,
        timeout: 30,
      })
      var to_num = payload.number;
      console.log("call starting to " + payload.number)
      const basePrompt = payload.message;
      await reportStatus('PROMPTING')
      var result = await promptYesNo(call, basePrompt);
      if (result == 'invalid') {
        console.log('first input failed')
        //ask again
        result = await promptYesNo(call, "Sorry! I did not understand that. " + basePrompt + " Press 1 for yes and 2 for no.");
      }

      if (result == 'invalid') {
        // still invalid, whatever
        await reportStatus('FAILED')
        await call.playTTS({ text: "Sorry! I did not understand that again. Let me transfer you."})
        connectToAgent(call)
      } else if (result == 'yes')  {
        // do something with the confirmation
        console.log('playing message')
        await reportStatus('CONFIRMED')
        await call.playTTS({ text: "Good! Your appointment is confirmed. Goodbye!"})
        setTimeout(async () => {
          await call.hangup();
        }, 4000)

      } else if (result == 'no')  {
        await reportStatus('NOT_CONFIRMED')
        await call.playTTS({ text: "I understand you would like to change your appointment. Let me transfer you."})
        setTimeout(async () => {
          await reportStatus('TRANSFERING')
          await connectToAgent(call);
        }, 5000)

      }

    } catch (e) {
      console.log("Call not answered.", e)
    }
    }
  if (payload.type == "sms"){
    await Messagingclient.send({
      context: "office",
      from: process.env.CALLER_ID,
      to: payload.number,
      body: payload.message,
    });
    await reportStatus('PROMPTING')

  }
  if (payload.type == "video"){
    await Messagingclient.send({
      context: "office",
      from: process.env.CALLER_ID,
      to: payload.number,
      body: "You have been invited to join a videochat about you upcoming appointment: https://jon-gray.signalwire.com/prebuilt-room/vpt_f6155a1cd01ad83e8ae49a8b68b29139",
    });
    await reportStatus('PROMPTING')

  }

})
Messagingclient.on("message.received", (message) => {
  console.log("message.received", message);
  if (message.body == "1") {
    reportStatus('CONFIRMED');
  }
});

async function connectToAgent(call) {
  const peer = await call.connectPhone({
    from: process.env.CALLER_ID,
    to: process.env.AGENT_NUMBER,
    timeout: 30
  })

  await peer.waitForDisconnected();
}

async function reportStatus(text) {
  axios.post(process.env.REPORTING_URL + '/notify', {
    message: text
  })
  .catch(function (error) {
    console.log(error);
  });
}

async function promptYesNo(call, text) {
  var match = 'invalid';
  const prompt = await call.promptTTS({
    text: text,
    digits: {
      max: 1,
      digitTimeout: 5
    },
    speech: {
      endSilenceTimeout: 1,
      speechTimeout: 5,
      language: 'en-US',
      hints: []
    }
  })
  const result = await prompt.waitForResult();
  console.log(result)
  if (result.type == 'speech') {
    if (result.text == 'yes' || result.text == 'no') {
      match = result.text;
    }
  }

  if (result.type == 'digit') {
    console.log('params', result.digits)
    if (result.digits == '1') {
      match = 'yes';
    }
    else if (result.digits == '2') {
      match = 'no';
    }
  }

  return match;
}