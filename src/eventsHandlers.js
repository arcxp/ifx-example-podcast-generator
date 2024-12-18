const podcastHandler = require('./eventsHandlers/podcastHandler');
const weeklyPodcastSummaryScheduler = require('./eventsHandlers/weeklyPodcastSummaryScheduler');

module.exports = {
  podcastHandler,
  weeklyPodcastSummaryScheduler,
}