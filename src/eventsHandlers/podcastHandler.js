const { getStoryContentByWebsiteAndId, extractContent, generatePodcastScripts, generateAudio, mergeAudios} = require("../utils");
const path = require('path');
const podcastHandler = async (event) => {
    try {
        const { body: eventBody } = event;
        const { canonical_website: website, _id: storyId, headlines } = eventBody;
        const { content_elements: contentElements } = await getStoryContentByWebsiteAndId(website, storyId);

        const content = extractContent(contentElements);
        const title = headlines.basic;

        const conversationString = await generatePodcastScripts(content, title);
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
