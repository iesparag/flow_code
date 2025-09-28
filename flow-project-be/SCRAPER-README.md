# Web Scraper Module

This module provides functionality to scrape emails and other information from websites using Google search queries. It's designed to be used in a controlled and responsible manner.

## Features

- Search Google with custom queries
- Extract emails from search results
- Rate limiting and delays to avoid detection
- Proxy support for distributed requests
- Command-line interface and REST API
- Progress tracking

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Puppeteer dependencies (required for headless browsing):
```bash
# On Ubuntu/Debian
sudo apt-get install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# On CentOS/RHEL
sudo yum install -y alsa-lib.x86_64 atk.x86_64 cups-libs.x86_64 gtk3.x86_64 ipa-gothic-fonts libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXrandr.x86_64 libXScrnSaver.x86_64 libXtst.x86_64 pango.x86_64 xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-fonts-cyrillic xorg-x11-fonts-misc xorg-x11-fonts-Type1 xorg-x11-utils
```

## Configuration

Create a `.env` file in the project root with the following variables:

```env
# Optional: Add proxies (one per line)
# PROXIES=http://user:pass@proxy1:port
# PROXIES=http://user:pass@proxy2:port

# Optional: Set request delays (in milliseconds)
# REQUEST_DELAY=5000
# MAX_CONCURRENT_REQUESTS=3
```

## Usage

### Command Line Interface

Run the scraper from the command line:

```bash
# Basic usage
npm run scraper:run -- run -q "site:linkedin.com CTO" -o results.json

# Multiple queries
npm run scraper:run -- run -q "site:linkedin.com CTO" "site:angel.co founder" --max-results 20

# With proxies from a file
npm run scraper:run -- run -q "site:linkedin.com hiring" --proxies proxies.txt

# Check status
npm run scraper:run -- status

# Stop the current job
npm run scraper:run -- stop
```

### API Endpoints

The following endpoints are available:

- `POST /api/scraper/start` - Start a new scraping job
  ```json
  {
    "queries": ["site:linkedin.com CTO"],
    "maxResults": 10,
    "delayBetweenRequests": 5000,
    "useProxies": false,
    "headless": true
  }
  ```

- `GET /api/scraper/progress` - Get current scraping progress
- `POST /api/scraper/pause` - Pause the current job
- `POST /api/scraper/resume` - Resume a paused job
- `POST /api/scraper/stop` - Stop the current job

## Rate Limiting and Proxies

To avoid being blocked:

1. Use appropriate delays between requests (5-10 seconds recommended)
2. Rotate user agents (handled automatically)
3. Use a pool of proxies (recommended for large-scale scraping)
4. Respect `robots.txt` (enabled by default)

## Legal Considerations

- Only scrape publicly available information
- Respect website terms of service
- Implement rate limiting to avoid overloading servers
- Consider using official APIs when available
- Be aware of data protection regulations (GDPR, CCPA, etc.)

## Troubleshooting

### Common Issues

1. **Puppeteer Timeout Errors**: Increase timeouts in the configuration
2. **CAPTCHAs**: Use proxies and increase delays between requests
3. **Missing Dependencies**: Make sure all system dependencies are installed
4. **Memory Leaks**: Restart the scraper periodically for long-running jobs

### Debugging

Run with debug logging:
```bash
DEBUG=scraper:* npm run scraper:run -- run -q "your query"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
