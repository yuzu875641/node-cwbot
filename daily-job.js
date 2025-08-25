require('dotenv').config();
const { resetRankingData } = require('./utils');

async function runDailyJob() {
    console.log('Daily ranking data reset job started.');
    try {
        await resetRankingData();
        console.log('Ranking data successfully reset.');
    } catch (error) {
        console.error('Error in daily reset job:', error);
    }
}

runDailyJob();
