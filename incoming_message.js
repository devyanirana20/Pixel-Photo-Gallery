// exports.handler = async function (context, event, callback) {
//     const client = context.getTwilioClient();
//     const twiml = new Twilio.twiml.MessagingResponse();
 
//     const firstMediaResponse = "Thanks for sending the first image, you are awesome!\nPS: I won't send any further confirmations";
 
//     const prevCorrespondence = await client.messages.list({
//         to: event.From,
//         from: event.To,
//     });
 
//     const isFirstMessage = prevCorrespondence.length === 0,
//         hasReceivedImagesBefore = prevCorrespondence.some(
//             (m) => m.body.indexOf(firstMediaResponse) >= 0
//         );
//     if (isFirstMessage) {
//         twiml.message( String.fromCodePoint(0x1F4F8)+`Those are some great clicks , You can view the gallery:\nhttps://${context.DOMAIN_NAME}/index.html`);
//     } else if (event.MediaUrl0) {
//         if (!hasReceivedImagesBefore) {
//             twiml.message(firstMediaResponse);
//         }
//     } else if (!event.MediaUrl0) {
//         twiml.message("Unable to find image:(");
//     }
//     callback(null, twiml);
//  };

const axios = require("axios");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: context.FB_PROJECT_ID,
      clientEmail: context.FB_CLIENT_EMAIL,
      privateKey: context.FB_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: context.FB_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

exports.handler = async function (context, event, callback) {
  const client = context.getTwilioClient();
  const messageSid = event.MessageSid;

  try {
    const message = await client.messages(messageSid).fetch();

    if (!message.subresourceUris.media) {
      return callback(null, { message: "No media attached." });
    }

    const mediaList = await axios.get(`https://api.twilio.com${message.subresourceUris.media}`, {
      auth: { username: context.ACCOUNT_SID, password: context.AUTH_TOKEN },
    });

    const media = mediaList.data.media_list[0];
    if (!media) return callback(null, { message: "No media found." });

    const mediaContent = await axios.get(`https://api.twilio.com${media.uri.replace('.json', '')}`, {
      auth: { username: context.ACCOUNT_SID, password: context.AUTH_TOKEN },
      responseType: "stream",
    });

    const phone = message.from.replace("whatsapp:", "");
    const filename = `${Date.now()}_${phone}.jpg`;
    const file = bucket.file(filename);

    await new Promise((resolve, reject) => {
      mediaContent.data
        .pipe(file.createWriteStream({ metadata: { contentType: media.content_type } }))
        .on("finish", resolve)
        .on("error", reject);
    });

    const [publicUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });

    await db.collection("gallery").add({
      url: publicUrl,
      caption: message.body || "",
      sender: phone,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    callback(null, { message: "Image saved to Firebase successfully." });

  } catch (err) {
    console.error("Upload error:", err.message);
    callback(err);
  }
};
