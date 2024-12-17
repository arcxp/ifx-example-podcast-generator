const { getStoryContentByWebsiteAndId, extractContent, generatePodcastScripts, generateAudio, mergeAudios} = require("../utils");
const path = require('path');
const podcastHandler = async (event) => {
    try {
        const { body: eventBody } = event;
        const { canonical_website: website, _id: storyId, headlines } = eventBody;
        const { content_elements: contentElements } = await getStoryContentByWebsiteAndId(website, storyId);

        const content = extractContent(contentElements);
        const title = headlines.basic;
        const prompt = `You are an experienced podcast host.
        - Based on text like an article, you can create an engaging conversation between two people.
        - Make the conversation at least 30,000 characters long with a lot of emotion.
        - In the response, for me to identify, use Sascha and Marina.
        - Sascha is writing the articles, and Marina is the second speaker who asks all the good questions.
        - The podcast is called ${title}.
        - Use short sentences that can be easily used with speech synthesis.
        - Include excitement during the conversation.
        - Do not mention last names.
        - Sascha and Marina are doing this podcast together. Avoid sentences like: "Thanks for having me, Marina!"
        - Include filler words like "uh" or repeat words to make the conversation more natural.`

        const conversationString = await generatePodcastScripts(prompt, content);
        const conversationObject = JSON.parse(conversationString);

        await generateAudio(conversationObject);

        const audioFilesDir = path.join(__dirname, '../../audio-files');
        const outputFilePath = path.join(audioFilesDir, 'podcast.mp3');

        mergeAudios(audioFilesDir, outputFilePath);
    } catch (error) {
        console.error('Error handling event:', error);
        throw error;
    }
};

module.exports = podcastHandler;
