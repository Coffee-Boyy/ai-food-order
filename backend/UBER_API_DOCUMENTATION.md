# UberEats API Integration Documentation

## Overview

This backend implements multiple methods for fetching UberEats order data, with automatic fallback between different authentication methods to ensure reliable data access.

## Authentication Methods

### 1. OAuth Authentication (Official API)
- Uses Uber's official OAuth 2.0 flow
- Requires Uber Developer account and app registration
- Limited by Uber's API rate limits and data availability

### 2. Session-based Authentication (CLI Tool)
- Uses the CLI tool to extract session cookies from UberEats.com
- Requires manual login through browser automation
- More reliable than OAuth for order history access

### 3. Undocumented API (New Implementation)
- Direct access to UberEats internal API endpoints
- Uses session cookies for authentication
- Provides access to detailed order information not available through official API

## New Past Orders API Implementation

### Endpoint: `/_p/api/getPastOrdersV1`

**Method**: POST  
**Authentication**: Session cookie (`sid`)  
**Base URL**: `https://www.ubereats.com`

#### Request Body
```json
{
  "lastWorkflowUUID": ""
}
```

#### Response Format
```json
{
  "status": "success",
  "data": {
    "ordersMap": {
      "order-uuid-1": {
        "baseEaterOrder": {
          "uuid": "order-uuid-1",
          "storeUuid": "store-uuid",
          "isCancelled": false,
          "isCompleted": true,
          "completedAt": "2025-08-13T20:57:06.000Z",
          "shoppingCart": {
            "items": [
              {
                "title": "Chili Sauce",
                "price": 0,
                "quantity": 5,
                "specialInstructions": "",
                "customizations": []
              }
            ]
          }
        }
      }
    }
  }
}
```

## Implementation Details

### Service Functions

#### `fetchPastOrders(userId, lastWorkflowUUID)`
- Fetches past orders using the undocumented API
- Automatically handles session cookie authentication
- Converts response format to standardized order objects
- Includes comprehensive error handling and logging

### API Endpoints

#### `POST /api/orders/fetch-past-orders`
- Direct access to the new past orders API
- Request body: `{ "userId": "string", "lastWorkflowUUID": "string" }`
- Returns raw order data from UberEats

### Error Handling

The implementation includes comprehensive error handling:

1. **API Response Validation**: Checks for proper response structure
2. **Session Validation**: Verifies session cookies are valid
3. **Fallback Mechanisms**: Automatically tries alternative methods
4. **Detailed Logging**: Logs all API interactions and errors
5. **Graceful Degradation**: Continues processing even if individual orders fail

### Data Processing

The system handles both old and new API response formats:

#### New API Format (Past Orders)
- Orders wrapped in `baseEaterOrder` object
- Items in `shoppingCart.items` array
- Store information via `storeUuid`
- Detailed order state information

#### Old API Format (Legacy)
- Direct order objects
- Items in `items` array
- Restaurant information directly available
- Simplified order structure

### Testing

Use the provided test script to verify the API implementation:

```bash
cd backend
npm run test:past-orders
```

This will:
1. Check for valid UberEats session
2. Test the past orders API endpoint
3. Log sample order structure
4. Verify data processing

## Security Considerations

1. **Session Management**: Session cookies are stored securely in Redis
2. **Authentication**: All API calls require valid user authentication
3. **Rate Limiting**: Implemented to prevent API abuse
4. **Error Handling**: Sensitive information is not logged
5. **Fallback Security**: OAuth tokens are used as secure fallback

## Usage Examples

### Frontend Integration

```javascript
// Fetch past orders directly
const response = await fetch('/api/orders/fetch-past-orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-id', lastWorkflowUUID: '' })
});

// Sync orders to database
const syncResponse = await fetch('/api/orders/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-id' })
});
```

### Backend Integration

```javascript
const { fetchPastOrders, fetchRestaurantInfo } = require('./services/uberService');

// Fetch orders
const orders = await fetchPastOrders(userId, '');

// Fetch restaurant info
const restaurant = await fetchRestaurantInfo(userId, storeUuid);
```

## Troubleshooting

### Common Issues

1. **No Valid Session**: Ensure user has authenticated via CLI tool
2. **API Rate Limits**: Implement exponential backoff for retries
3. **Invalid Response Format**: Check for API changes and update parsing
4. **Session Expired**: Re-authenticate user through CLI tool

### Debug Logging

Enable debug logging to troubleshoot API issues:

```javascript
logger.debug('UberEats API response:', response.data);
```

## Future Enhancements

1. **Pagination Support**: Implement proper pagination for large order histories
2. **Real-time Updates**: WebSocket integration for live order updates
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Analytics**: Enhanced analytics using detailed order information
