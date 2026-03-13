const { sentimentAnalyticsHandler } = require('../controllers/answersController');
router.get('/analytics/sentiment', sentimentAnalyticsHandler);