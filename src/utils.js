const { createWriteStream, existsSync, mkdirSync } = require('fs');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { ElevenLabsClient } = require("elevenlabs");
require("dotenv").config();

const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const schema = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            speaker: { type: SchemaType.STRING },
            text: { type: SchemaType.STRING }
        },
    },
};

const extractContent = (contentElements) => {
    return contentElements
        .filter(element => element.type === 'text')
        .map(element => element.content)
        .join(' ');
};

/**
 * Generates podcast scripts based on the provided content.
 *
 * @param {string} systemInstruction - The instruction to guide the generative model.
 * @param {string} content - The content to generate the podcast scripts from.
 * @returns {Promise<string>} - A promise that resolves to the generated podcast script.
 *
 * @example
 * // The format of the returned script will be like this:
 * [
 *     {
 *         "speaker": "SpeakerName",
 *         "text": "Text spoken by the speaker."
 *     },
 * ]
 */
const generatePodcastScripts = async (systemInstruction, content) => {
    const geminiModel = googleAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });
    try {
        const result = await geminiModel.generateContent(content);
        return result.response.candidates[0].content.parts[0].text;
    } catch (error) {
        console.log("Error while generating scripts: ", error);
    }
};

/**
 * Fetches story content from the Arc Content API by website and story ID.
 *
 * @param {string} website - The canonical website identifier.
 * @param {string} id - The unique identifier of the story.
 * @returns {Promise<Object>} - A promise that resolves to the story content data.
 * @throws {Error} - Throws an error if the request fails.
 */
const getStoryContentByWebsiteAndId = async (website, id) => {
    try {
        const response = await axios.get(`https://${process.env.CONTENT_API_HOST}/stories`, {
            params: {
                website: website,
                _id: id,
                included_fields: 'content_elements'
            },
            headers: {
                'Authorization': `Bearer ${process.env.PERSONAL_ACCESS_TOKEN}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching story content:', error);
        throw error;
    }
};

const searchStoryContentByWebsiteAndTag = async (website, tagName) => {
    try {
        const response = await axios.get(`https://${process.env.CONTENT_API_HOST}/search/published`, {
            params: {
                website: website,
                q: `type:story AND taxonomy.tags.slug:${tagName}`,
            },
            headers: {
                'Authorization': `Bearer ${process.env.PERSONAL_ACCESS_TOKEN}`
            }
        });
        return response.data.content_elements.map(element =>
            element.content_elements[0].content
        );
    } catch (error) {
        console.error('Error searching story content by tag:', error);
        throw error;
    }
};

const speakerVoiceMapping = {
    // Mapping of speaker to voice provided by ElevenLabs
    "Marina": "Alice",
    "Sascha": "Aria",
    "Alex": "Bill",
};

const audioFilesDir = path.join(__dirname, '../audio-files');
const pLimit = require('p-limit');

const generateAudio = async (conversation) => {
    const elevenlabs = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY
    });

    // Ensure the ./audio-files folder exists
    if (existsSync(audioFilesDir)) {
        fs.removeSync(audioFilesDir);
    }
    mkdirSync(audioFilesDir, { recursive: true });

    // Set concurrency limit based on your tier (e.g., Free tier allows 2 concurrent requests)
    const limit = pLimit(2); // Change the number as needed based on your tier

    const audioPromises = conversation.map((part, index) => {
        const voice = speakerVoiceMapping[part.speaker];

        if (!voice) {
            const errorMsg = `No voice mapping found for speaker: ${part.speaker}`;
            console.error(errorMsg);
            return Promise.reject(new Error(errorMsg));
        }

        // Use limit to wrap the request in order to control concurrency
        return limit(() =>
            elevenlabs.generate({
                voice,
                text: part.text,
                model_id: "eleven_turbo_v2_5",
            })
                .then(audio => writeAudioToFile(audio, part.speaker, index))
                .catch(error => {
                    console.error(`Error generating audio for ${part.speaker}:`, error);
                    throw error;
                })
        );
    });

    return Promise.all(audioPromises);
};

const writeAudioToFile = (audio, speaker, index) => {
    const fileName = path.join(audioFilesDir, `${index}_${speaker}.mp3`);
    const fileStream = createWriteStream(fileName);

    return new Promise((resolve, reject) => {
        audio.pipe(fileStream);
        fileStream.on("finish", () => {
            console.log(`Generated audio for ${speaker}: ${fileName}`);
            resolve(fileName);
        });
        fileStream.on("error", reject);
    });
};

function mergeAudios(audioFolder, outputFile) {
    const tempDir = './tempDir';

    // Ensure the temporary directory exists
    if (!existsSync(tempDir)) {
        mkdirSync(tempDir);
    }

    fs.readdir(audioFolder, (err, files) => {
        if (err) {
            return console.error(`Unable to scan directory: ${err}`);
        }

        // Filter and sort audio files
        const audioFiles = files.filter(file => file.endsWith('.mp3')).sort();

        if (audioFiles.length === 0) {
            return console.log("No audio files found to merge.");
        }

        const audioPaths = audioFiles.map(file => path.join(audioFolder, file));

        console.log("Processing:", audioPaths);

        // Use ffmpeg to concatenate audio files
        const command = ffmpeg();

        audioPaths.forEach(file => {
            command.input(file);
        });

        command
            .on('end', () => {
                console.log(`Merged audio saved as ${outputFile}`);
            })
            .on('error', (err) => {
                console.error(`Error merging audio: ${err.message}`);
            })
            .mergeToFile(outputFile, tempDir);
    });
}

module.exports = {
    generatePodcastScripts,
    getStoryContentByWebsiteAndId,
    searchStoryContentByWebsiteAndTag,
    generateAudio,
    extractContent,
    mergeAudios
};
