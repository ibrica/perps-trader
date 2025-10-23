# Perps Trader Dashboard

A comprehensive web-based dashboard for monitoring and controlling the Perps Trader system. Built with Next.js, React, and TypeScript, featuring Google OAuth authentication and real-time trading analytics.

## Overview

The dashboard provides a complete interface for:

- **Real-time Analytics**: PnL tracking, win rates, position monitoring
- **Position Management**: View and control open/closed positions with exit flags
- **Configuration**: Manage perp settings (leverage, amounts) and trading parameters
- **Trading Control**: Emergency halt capabilities via closeAllPositions toggle
- **Secure Access**: Google OAuth 2.0 with email whitelist authentication

## Architecture

### Frontend Stack

- **Framework**: Next.js 15.3.3 with React 19
- **Language**: TypeScript with strict type checking
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React for UI icons
- **Styling**: Custom CSS with responsive grid system
- **Authentication**: OAuth 2.0 flow with cookie-based JWT session management

### Backend Integration

- **API Client**: Type-safe REST API client with auth headers
- **Authentication**: JWT Bearer tokens via HTTP-only cookies
- **Error Handling**: Automatic re-authentication on 401 errors
- **Real-time Updates**: Manual refresh with loading states

## Features

### 1. Authentication Flow

**OAuth 2.0 with Google**

```
1. User visits dashboard (http://localhost:3000)
2. If not authenticated, redirect to backend OAuth endpoint
3. Backend redirects to Google OAuth consent screen
4. User authorizes with their Google account
5. Google redirects to backend callback with auth code
6. Backend validates email against whitelist (ALLOWED_EMAILS)
7. Backend generates JWT token and CSRF secret
8. Backend sets HTTP-only auth cookie + CSRF cookie, then redirects to frontend callback
9. Frontend callback confirms session and redirects to dashboard
10. Dashboard loads with authenticated API access using cookies
```

**Email Whitelist**

Only emails listed in `ALLOWED_EMAILS` environment variable can access the dashboard. Unauthorized attempts are rejected at the backend.

### 2. Overview Tab

**Key Performance Indicators**

- **Total PnL**: Aggregate profit/loss across all positions
- **Win Rate**: Percentage of profitable trades
- **Open Positions**: Current active positions count
- **Total Trades**: Historical trade count with volume

**Time Period Selection**

- Last 7 Days
- Last 30 Days (default)
- Last 3 Months
- Last 6 Months
- Last Year

**PnL Chart**

Interactive line chart showing daily profit/loss over the selected time period. Uses Recharts with:
- Responsive container
- Date formatting on X-axis
- Currency formatting on Y-axis
- Tooltip with formatted values
- Green line for visual clarity

**Token Performance Breakdown**

Table showing top 10 tokens by performance:
- Token symbol
- Total PnL (color-coded green/red)
- Win rate percentage
- Number of trades

### 3. Positions Tab

**Position Tracking**

Real-time position monitoring with detailed metrics:

| Column | Description |
|--------|-------------|
| Token | Trading pair symbol |
| Status | OPEN, CLOSED, or FAILED |
| Direction | LONG or SHORT position |
| Entry Price | Position opening price |
| Current Price | Latest market price |
| PnL | Realized profit/loss in USD |
| PnL % | Percentage return on position |
| Leverage | Position leverage multiplier |
| Opened | Timestamp of position opening |
| Exit Flag | Manual exit control button |

**Exit Flag Control**

- **Mark Exit**: Sets `exitFlag=true` on open positions
- **Exit Marked**: Indicates position marked for closure
- **Real-time Update**: TradeMonitorScheduler checks exitFlag every minute
- **Manual Override**: Allows trader to force position closure

**Status Filtering**

Filter positions by status:
- All Statuses (shows everything)
- Open (active positions only)
- Closed (completed positions)
- Failed (error positions)

### 4. Perps Tab

**Configuration Management**

Manage trading instrument settings with inline editing:

| Column | Description | Editable |
|--------|-------------|----------|
| Name | Perp contract name | No |
| Token | Underlying asset | No |
| Platform | HYPERLIQUID | No |
| Active | Trading enabled status | No |
| Buy Flag | Entry permission | No |
| Market Direction | UP/DOWN/NEUTRAL | No |
| Recommended Amount | Default position size in USD | Yes |
| Default Leverage | Default leverage multiplier | Yes |

**Inline Editing**

1. Click "Edit" button on any row
2. Input fields appear for recommendedAmount and defaultLeverage
3. Modify values as needed
4. Click "Save" to persist changes
5. Click "Cancel" to discard changes

**Use Cases**

- Adjust position sizes based on market conditions
- Modify leverage for different risk profiles
- Configure instrument-specific parameters
- Prepare settings before enabling buyFlag

### 5. Settings Tab

**Trading Control Panel**

Emergency controls for halting trading operations.

**Close All Positions Toggle**

- **Current State**: Visual indicator (red background when halted)
- **Action Button**:
  - "Halt Trading" (when active) - Requires confirmation
  - "Resume Trading" (when halted) - Immediate action
- **Confirmation Dialog**: Safety check before halting
- **Effects**:
  - Stops opening new positions
  - Closes all currently open positions at market price
  - TradeMonitorScheduler respects this flag

**Safety Features**

- Confirmation dialog with detailed explanation
- Color-coded state indicators
- Last updated timestamp
- Clear action descriptions

## API Endpoints

### Analytics

```typescript
GET /api/dashboard/analytics?period=LAST_30_DAYS&token=BTC
```

**Query Parameters**:
- `period`: TimePeriod enum (optional)
- `startDate`: ISO date string (optional, for CUSTOM period)
- `endDate`: ISO date string (optional, for CUSTOM period)
- `token`: Filter by specific token (optional)

**Response**:
```typescript
{
  overview: {
    totalPnl: number;
    totalVolume: number;
    winRate: number;
    openPositionsCount: number;
    closedPositionsCount: number;
    totalTrades: number;
  };
  timeSeries: Array<{
    date: string;
    pnl: number;
  }>;
  tokenBreakdown: Array<{
    token: string;
    totalPnl: number;
    totalVolume: number;
    winRate: number;
    tradeCount: number;
  }>;
}
```

### Positions

```typescript
GET /api/dashboard/positions?status=OPEN&limit=50&offset=0
```

**Query Parameters**:
- `status`: TradePositionStatus enum (optional)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response**:
```typescript
{
  positions: Position[];
  total: number;
  limit: number;
  offset: number;
}
```

**Update Position**:
```typescript
PATCH /api/dashboard/positions/:id
Body: { exitFlag: boolean }
```

### Perps

```typescript
GET /api/dashboard/perps
```

**Response**: Array of perp configurations

**Update Perp**:
```typescript
PATCH /api/dashboard/perps/:id
Body: {
  recommendedAmount?: number;
  defaultLeverage?: number;
}
```

### Settings

```typescript
GET /api/dashboard/settings
```

**Response**: Current settings object

**Update Settings**:
```typescript
PATCH /api/dashboard/settings
Body: { closeAllPositions: boolean }
```

### Authentication

```typescript
GET /api/auth/google
```
Initiates OAuth flow (redirects to Google)

```typescript
GET /api/auth/google/callback
```
OAuth callback handler (redirects to dashboard with token)

```typescript
GET /api/auth/me
```
Get current user profile (requires JWT)

## Setup & Configuration

### 1. Google OAuth Setup

**Create OAuth Credentials**:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Choose "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:7777/api/auth/google/callback`
   - `https://your-production-domain.com/api/auth/google/callback`
7. Copy Client ID and Client Secret

**Configure Environment Variables**:

Backend (`.env`):
```bash
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:7777/api/auth/google/callback

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=7d

ALLOWED_EMAILS=admin@company.com,trader1@company.com,trader2@company.com

DASHBOARD_URL=http://localhost:3000
```

Frontend (`src/dash/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:7777
```

### 2. Running the Dashboard

**Development Mode**:

Terminal 1 (Backend):
```bash
yarn dev
# Backend runs on http://localhost:7777
```

Terminal 2 (Dashboard):
```bash
yarn dashboard:dev
# Dashboard runs on http://localhost:3000
```

**Production Mode**:

```bash
# Build dashboard
yarn dashboard:build

# Start backend
yarn start:prod

# Start dashboard
yarn dashboard:start
```

### 3. Access Control

**Email Whitelist**:

Only emails in the `ALLOWED_EMAILS` environment variable can access the dashboard. Add/remove emails by updating the variable and restarting the backend.

**Example**:
```bash
ALLOWED_EMAILS=ceo@company.com,cto@company.com,head-trader@company.com
```

**Security Considerations**:

- JWT tokens stored in localStorage (client-side)
- Tokens expire based on JWT_EXPIRATION setting
- All API requests require valid JWT token
- Backend validates email on every OAuth login
- Use HTTPS in production for secure token transmission

### 4. Docker Deployment

**docker-compose.yml** (example):
```yaml
version: '3.8'

services:
  perps-trader:
    build: .
    ports:
      - "7777:7777"
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - JWT_SECRET=${JWT_SECRET}
      - ALLOWED_EMAILS=${ALLOWED_EMAILS}
      - DASHBOARD_URL=${DASHBOARD_URL}
    depends_on:
      - mongodb

  dashboard:
    build:
      context: .
      dockerfile: src/dash/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:7777
```

## Development

### Project Structure

```
src/dash/
├── pages/
│   ├── _app.tsx              # App wrapper with auth check
│   ├── index.tsx             # Main dashboard page
│   └── auth/
│       └── callback.tsx      # OAuth callback handler
├── components/
│   ├── MetricCard.tsx        # KPI display component
│   ├── ProfitChart.tsx       # Recharts line chart
│   ├── PositionsTable.tsx    # Interactive positions table
│   ├── PerpsTable.tsx        # Perp config table with editing
│   └── SettingsPanel.tsx     # Trading control panel
├── services/
│   └── api.ts                # Type-safe API client
├── types/
│   └── dashboard.ts          # TypeScript interfaces
├── styles/
│   └── globals.css           # Global styles
├── next.config.js            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
└── .env.local.example        # Environment template
```

### Adding New Features

**Add New Component**:

1. Create component in `src/dash/components/`
2. Import types from `src/dash/types/dashboard.ts`
3. Use API client from `src/dash/services/api.ts`
4. Follow existing styling patterns in `globals.css`

**Add New API Endpoint**:

1. Add endpoint to backend controller
2. Update API client in `services/api.ts`
3. Add TypeScript types in `types/dashboard.ts`
4. Use in component with error handling

**Example**:
```typescript
// services/api.ts
export async function getCustomData(): Promise<CustomData> {
  return fetchApi<CustomData>('/api/dashboard/custom');
}

// Component usage
const [data, setData] = useState<CustomData | null>(null);

useEffect(() => {
  async function fetchData() {
    try {
      const result = await getCustomData();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch:', error);
    }
  }
  fetchData();
}, []);
```

### Styling Guide

**CSS Classes**:

- `.container` - Max-width container with padding
- `.card` - White card with shadow and rounded corners
- `.grid`, `.grid-2`, `.grid-3`, `.grid-4` - Responsive grid layouts
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger` - Button styles
- `.text-green`, `.text-red`, `.text-gray` - Color utilities
- `.badge`, `.badge-green`, `.badge-red` - Status badges
- `.table` - Styled table with hover effects

**Responsive Design**:

All grid layouts collapse to single column on mobile (<768px).

## Troubleshooting

### Authentication Issues

**"Access denied. Your email is not in the allowed list."**

- Check `ALLOWED_EMAILS` environment variable in backend `.env`
- Ensure email matches exactly (case-sensitive)
- Restart backend after changing environment variables

**Token expired or invalid**

- Clear localStorage in browser DevTools
- Navigate to dashboard to re-authenticate
- Check JWT_SECRET matches between backend config and generated tokens

### API Errors

**401 Unauthorized**

- Token missing or invalid
- Dashboard will auto-redirect to OAuth flow
- Check browser console for error details

**CORS Errors**

- Ensure `NEXT_PUBLIC_API_URL` points to correct backend
- Check backend CORS configuration if using different domains
- Use same protocol (http/https) for both services

### Display Issues

**Data not loading**

- Check browser console for API errors
- Verify backend is running and accessible
- Check network tab for failed requests
- Ensure MongoDB is connected

**Chart not rendering**

- Check browser console for Recharts errors
- Verify data format matches expected structure
- Ensure data array is not empty

## Best Practices

### Security

1. **Never commit credentials** - Use environment variables
2. **Use HTTPS in production** - Encrypt token transmission
3. **Rotate JWT secrets** - Periodically update JWT_SECRET
4. **Limit email whitelist** - Only add trusted users
5. **Monitor access logs** - Track authentication attempts

### Performance

1. **Implement pagination** - For large position lists
2. **Cache analytics** - Reduce database load
3. **Optimize re-fetching** - Avoid unnecessary API calls
4. **Use React.memo** - Prevent unnecessary re-renders
5. **Lazy load components** - Improve initial load time

### User Experience

1. **Show loading states** - Use spinners for async operations
2. **Handle errors gracefully** - Display user-friendly messages
3. **Confirm destructive actions** - Like halting trading
4. **Provide feedback** - Toast notifications for actions
5. **Keep UI responsive** - Optimize for mobile devices

## Future Enhancements

### Planned Features

- [ ] Real-time WebSocket updates for positions
- [ ] Advanced filtering and search
- [ ] Export data to CSV/Excel
- [ ] Custom alert notifications
- [ ] Mobile app with React Native
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Advanced charting with TradingView
- [ ] Trade execution from dashboard
- [ ] Backtesting interface

### Integration Ideas

- Telegram bot for alerts
- Email notifications for events
- Slack integration for team updates
- Discord webhooks for community
- Mobile push notifications

## Support

For dashboard-related issues:

1. Check this documentation
2. Review browser console errors
3. Check backend logs: `docker-compose logs perps-trader`
4. Verify environment configuration
5. Test API endpoints with curl/Postman

## Contributing

When contributing to the dashboard:

1. Follow existing code style (Prettier)
2. Add TypeScript types for all new features
3. Test on both desktop and mobile
4. Update documentation for new features
5. Ensure authentication still works
6. Test error handling scenarios
