require('dotenv').config()

const { fetchPastOrders, getUberEatsSession } = require('./src/services/uberService');
const { logger } = require('./src/utils/logger');

// Test function to verify the new API endpoint
async function testPastOrdersAPI() {
  try {
    // Replace with an actual user ID that has a valid UberEats session
    const testUserId = '6762d2b8-00c7-459d-961c-07a84043491a';
    
    logger.info('Testing UberEats past orders API...');
    
    // First check if user has a valid session
    const session = await getUberEatsSession(testUserId);
    if (!session) {
      logger.error('No valid UberEats session found for user');
      return;
    }
    
    logger.info('Found valid UberEats session, fetching past orders...');
    
    // Test the new API endpoint
    const orders = await fetchPastOrders(testUserId, '');
    
    logger.info(`Successfully fetched ${orders.length} orders`);
    
    if (orders.length > 0) {
      const sampleOrder = orders[0];
      logger.info('Sample order structure:', {
        uuid: sampleOrder.baseEaterOrder?.uuid,
        storeUuid: sampleOrder.baseEaterOrder?.storeUuid,
        isCompleted: sampleOrder.baseEaterOrder?.isCompleted,
        completedAt: sampleOrder.baseEaterOrder?.completedAt,
        itemCount: sampleOrder.baseEaterOrder?.shoppingCart?.items?.length || 0
      });
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPastOrdersAPI();
}

module.exports = { testPastOrdersAPI };
