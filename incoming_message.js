exports.handler = async function (context, event, callback) {
    const client = context.getTwilioClient();
    const twiml = new Twilio.twiml.MessagingResponse();
 
    const firstMediaResponse = "Thanks for sending the first image, you are awesome!\nPS: I won't send any further confirmations";
 
    const prevCorrespondence = await client.messages.list({
        to: event.From,
        from: event.To,
    });
 
    const isFirstMessage = prevCorrespondence.length === 0,
        hasReceivedImagesBefore = prevCorrespondence.some(
            (m) => m.body.indexOf(firstMediaResponse) >= 0
        );
    if (isFirstMessage) {
        twiml.message( String.fromCodePoint(0x1F4F8)+`Those are some great clicks , You can view the gallery:\nhttps://${context.DOMAIN_NAME}/index.html`);
    } else if (event.MediaUrl0) {
        if (!hasReceivedImagesBefore) {
            twiml.message(firstMediaResponse);
        }
    } else if (!event.MediaUrl0) {
        twiml.message("Unable to find image:(");
    }
    callback(null, twiml);
 };