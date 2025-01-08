const MaskData = require("maskdata");
const axios = require("axios");

const maskPhoneOptions = {
 maskWith: "*",
 unmaskedStartDigits: 5,
 unmaskedEndDigits: 4,
};
const PAGE_SIZE = 15;

exports.handler = async function (context, event, callback) {
 const client = context.getTwilioClient();

 // Calculate the time 15 minutes ago
 const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

 const page = await client.messages.page({
   to: 'whatsapp:+14155238886',
   pageSize: PAGE_SIZE,
   pageNumber: event.page || 0,
   pageToken: event.pageToken,
 });

 let files = await Promise.all(
   page.instances
     .filter((message) => new Date(message.dateSent) >= fifteenMinutesAgo) // Filter messages from the last 15 minutes
     .map(async (message) => {
       const phone = message.from.replace("whatsapp:", "");
       const mediaURL = message.subresourceUris.media;
       const mediaRes = await axios({
         url: `https://api.twilio.com${mediaURL}`,
         method: "GET",
         auth: {
           username: context.ACCOUNT_SID,
           password: context.AUTH_TOKEN,
         },
       });
       const media = mediaRes.data.media_list[0];
       if (!media) {
         return undefined;
       }
       const mediaFileRequest = await axios({
         url: `https://api.twilio.com${media.uri.replace(/\.json$/, "")}`,
         method: "GET",
         headers: { "Content-Type": media.content_type },
         auth: {
           username: context.ACCOUNT_SID,
           password: context.AUTH_TOKEN,
         },
       });

       const url = mediaFileRequest.request.res.responseUrl;
       const tags = message.body ? [{ value: message.body, title: "caption" }] : [];

       return {
         src: url,
         tags,
         dateSent: message.dateSent,
         sender: MaskData.maskPhone(phone, maskPhoneOptions),
         caption: message.body,
         contentType: media.content_type,
       };
     })
 );
 if (files.length === 0) {
   callback(null, { message: "No images found in the last 15 minutes." });
   return;
 }

 callback(null, {
   files: files.filter((files) => !!files),
   pageToken: page.nextPageUrl && page.nextPageUrl.match(/PageToken=(.*)/)[1], // no page token means no more pages
 });
};
