const { searchStoryContentByWebsiteAndTag,  generatePodcastScripts, generateAudio, mergeAudios} = require("../utils");
const path = require("path");
const weeklyPodcastSummaryScheduler = async (event) => {
    // TODO: add publish date to filter weekly
    const website = 'pubstack-synthetics';
    const storyTag = 'sports-2020';
    const contentArray = await searchStoryContentByWebsiteAndTag(website, storyTag);

    const prompt = "You are Alex, an experienced podcast host for a sports recap show. Using the provided sports articles as your reference material, generate a comprehensive and engaging podcast script for this week's episode. Your script should highlight major events, standout performances, and trending topics in the sports world, ensuring it's entertaining and informative for listeners. \n\n" +
        "Instructions for the Script:\n" +
        "- Start with an engaging introduction that welcomes listeners and outlines what they can expect in this episode.\n" +
        "- Include a segment on major events, summarizing key games, scores, and statistics.\n" +
        "- Highlight standout performances of players from different sports and provide insights into their contributions.\n" +
        "- Discuss trending topics and provide context, such as trades, injuries, and upcoming events.\n" +
        "- Engage with fan questions or comments to make it interactive.\n" +
        "- Conclude with a summary and a call to action encouraging listeners to subscribe and leave feedback.\n\n" +
        "Make the script lively and suited for an audio format, keeping the tone conversational and dynamic.";
    const conversationString = await generatePodcastScripts(prompt, contentArray);
    const conversationObject = JSON.parse(conversationString);

    await generateAudio(conversationObject);

    const audioFilesDir = path.join(__dirname, '../../audio-files');
    const outputFilePath = path.join(audioFilesDir, 'podcast-summary.mp3');

    mergeAudios(audioFilesDir, outputFilePath);
};

module.exports = weeklyPodcastSummaryScheduler;
