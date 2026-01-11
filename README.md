# World Monitor

Real-time global intelligence dashboard aggregating news, markets, geopolitical data, and infrastructure monitoring into a unified situation awareness interface.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=flat&logo=d3.js&logoColor=white)

![World Monitor Dashboard](Screenshot.png)

## Features

### Interactive Global Map
- **Zoom & Pan** - Smooth navigation with mouse/trackpad gestures
- **Multiple Views** - Global, US, and MENA region presets
- **Layer System** - Toggle visibility of different data layers
- **Time Filtering** - Filter events by time range (1h to 7d)

### Data Layers

Layers are organized into logical groups for efficient monitoring:

**Geopolitical**
| Layer | Description |
|-------|-------------|
| **Conflicts** | Active conflict zones with involved parties and status |
| **Hotspots** | Intelligence hotspots with activity levels based on news correlation |
| **Sanctions** | Countries under economic sanctions regimes |
| **Protests** | Live social unrest events from ACLED and GDELT |

**Military & Strategic**
| Layer | Description |
|-------|-------------|
| **Military Bases** | 220+ global military installations from 9 operators |
| **Nuclear Facilities** | Power plants, weapons labs, enrichment sites |
| **Gamma Irradiators** | IAEA-tracked Category 1-3 radiation sources |

**Infrastructure**
| Layer | Description |
|-------|-------------|
| **Undersea Cables** | 55 major submarine cable routes worldwide |
| **Pipelines** | 88 operating oil & gas pipelines across all continents |
| **Internet Outages** | Network disruptions via Cloudflare Radar |
| **AI Datacenters** | 111 major AI compute clusters (≥10,000 GPUs) |

**Transport**
| Layer | Description |
|-------|-------------|
| **Ships (AIS)** | Live vessel tracking via AIS with chokepoint monitoring |
| **Flights** | FAA airport delay status and ground stops |

**Natural Events**
| Layer | Description |
|-------|-------------|
| **Earthquakes** | Live USGS seismic data (M4.5+ global) |
| **Weather Alerts** | NWS severe weather warnings |

**Economic & Labels**
| Layer | Description |
|-------|-------------|
| **Economic** | FRED indicators panel (Fed assets, rates, yields) |
| **Countries** | Country boundary labels |
| **Waterways** | Strategic waterways and chokepoints |

### News Aggregation

Multi-source RSS aggregation across categories:
- **World / Geopolitical** - BBC, Reuters, AP, Guardian, NPR
- **Middle East / MENA** - Al Jazeera, BBC ME, CNN ME
- **Technology** - Hacker News, Ars Technica, The Verge, MIT Tech Review
- **AI / ML** - ArXiv, Hugging Face, VentureBeat, OpenAI
- **Finance** - CNBC, MarketWatch, Financial Times, Yahoo Finance
- **Government** - White House, State Dept, Pentagon, Treasury, Fed, SEC
- **Intel Feed** - Defense One, Breaking Defense, Bellingcat, Krebs Security
- **Think Tanks** - Foreign Policy, Brookings, CSIS, CFR
- **Layoffs Tracker** - Tech industry job cuts
- **Congress Trades** - Congressional stock trading activity

### Market Data
- **Stocks** - Major indices and tech stocks
- **Commodities** - Oil, gold, natural gas, copper
- **Crypto** - Bitcoin, Ethereum, and top cryptocurrencies
- **Sector Heatmap** - Visual sector performance
- **Economic Indicators** - Fed data (GDP, inflation, unemployment)

### Prediction Markets
- Polymarket integration for event probability tracking
- Correlation analysis with news events

### Search (⌘K)
Universal search across all data sources:
- News articles
- Geographic hotspots and conflicts
- Infrastructure (pipelines, cables, datacenters)
- Nuclear facilities and irradiators
- Markets and predictions

### Data Export
- JSON export of current dashboard state
- Historical playback from snapshots

---

## Signal Intelligence

The dashboard continuously analyzes data streams to detect significant patterns and anomalies. Signals appear in the header badge (⚡) with confidence scores.

### Signal Types

| Signal | Trigger | What It Means |
|--------|---------|---------------|
| **◉ Convergence** | 3+ source types report same story within 30 minutes | Multiple independent channels confirming the same event—higher likelihood of significance |
| **△ Triangulation** | Wire + Government + Intel sources align | The "authority triangle"—when official channels, wire services, and defense specialists all report the same thing |
| **🔥 Velocity Spike** | Topic mention rate doubles with 6+ sources/hour | A story is accelerating rapidly across the news ecosystem |
| **🔮 Prediction Leading** | Prediction market moves 5%+ with low news coverage | Markets pricing in information not yet reflected in news |
| **📊 Silent Divergence** | Market moves 2%+ with minimal related news | Unexplained price action—possible insider knowledge or algorithm-driven |

### How It Works

The correlation engine maintains rolling snapshots of:
- News topic frequency (by keyword extraction)
- Market price changes
- Prediction market probabilities

Each refresh cycle compares current state to previous snapshot, applying thresholds and deduplication to avoid alert fatigue. Signals include confidence scores (60-95%) based on the strength of the pattern.

---

## Source Intelligence

Not all sources are equal. The system implements a dual classification to prioritize authoritative information.

### Source Tiers (Authority Ranking)

| Tier | Sources | Characteristics |
|------|---------|-----------------|
| **Tier 1** | Reuters, AP, AFP, Bloomberg, White House, Pentagon | Wire services and official government—fastest, most reliable |
| **Tier 2** | BBC, Guardian, NPR, Al Jazeera, CNBC, Financial Times | Major outlets—high editorial standards, some latency |
| **Tier 3** | Defense One, Bellingcat, Foreign Policy, MIT Tech Review | Domain specialists—deep expertise, narrower scope |
| **Tier 4** | Hacker News, The Verge, VentureBeat, aggregators | Useful signal but requires corroboration |

When multiple sources report the same story, the **lowest tier** (most authoritative) source is displayed as the primary, with others listed as corroborating.

### Source Types (Categorical)

Sources are also categorized by function for triangulation detection:

- **Wire** - News agencies (Reuters, AP, AFP, Bloomberg)
- **Gov** - Official government (White House, Pentagon, State Dept, Fed, SEC)
- **Intel** - Defense/security specialists (Defense One, Bellingcat, Krebs)
- **Mainstream** - Major news outlets (BBC, Guardian, NPR, Al Jazeera)
- **Market** - Financial press (CNBC, MarketWatch, Financial Times)
- **Tech** - Technology coverage (Hacker News, Ars Technica, MIT Tech Review)

---

## Algorithms & Design

### News Clustering

Related articles are grouped using **Jaccard similarity** on tokenized headlines:

```
similarity(A, B) = |A ∩ B| / |A ∪ B|
```

- Headlines are tokenized, lowercased, and stripped of stop words
- Articles with similarity ≥ 0.5 are grouped into clusters
- Clusters are sorted by source tier, then recency
- The most authoritative source becomes the "primary" headline

### Velocity Analysis

Each news cluster tracks publication velocity:

- **Sources per hour** = article count / time span
- **Trend** = rising/stable/falling based on first-half vs second-half publication rate
- **Levels**: Normal (<3/hr), Elevated (3-6/hr), Spike (>6/hr)

### Sentiment Detection

Headlines are scored against curated word lists:

**Negative indicators**: war, attack, killed, crisis, crash, collapse, threat, sanctions, invasion, missile, terror, assassination, recession, layoffs...

**Positive indicators**: peace, deal, agreement, breakthrough, recovery, growth, ceasefire, treaty, alliance, victory...

Score determines sentiment classification: negative (<-1), neutral (-1 to +1), positive (>+1)

### Baseline Deviation (Z-Score)

The system maintains rolling baselines for news volume per topic:

- **7-day average** and **30-day average** stored in IndexedDB
- Standard deviation calculated from historical counts
- **Z-score** = (current - mean) / stddev

Deviation levels:
- **Spike**: Z > 2.5 (statistically rare increase)
- **Elevated**: Z > 1.5
- **Normal**: -2 < Z < 1.5
- **Quiet**: Z < -2 (unusually low activity)

This enables detection of anomalous activity even when absolute numbers seem normal.

---

## Dynamic Hotspot Activity

Hotspots on the map are **not static threat levels**. Activity is calculated in real-time based on news correlation.

Each hotspot defines keywords:
```typescript
{
  id: 'dc',
  name: 'DC',
  keywords: ['pentagon', 'white house', 'congress', 'cia', 'nsa', ...],
  agencies: ['Pentagon', 'CIA', 'NSA', 'State Dept'],
}
```

The system counts matching news articles in the current feed, applies velocity analysis, and assigns activity levels:

| Level | Criteria | Visual |
|-------|----------|--------|
| **Low** | <3 matches, normal velocity | Gray marker |
| **Elevated** | 3-6 matches OR elevated velocity | Yellow pulse |
| **High** | >6 matches OR spike velocity | Red pulse |

This creates a dynamic "heat map" of global attention based on live news flow.

---

## Custom Monitors

Create personalized keyword alerts that scan all incoming news:

1. Enter comma-separated keywords (e.g., "nvidia, gpu, chip shortage")
2. System assigns a unique color
3. Matching articles are highlighted in the Monitor panel
4. Matching articles in clusters inherit the monitor color

Monitors persist across sessions via LocalStorage.

---

## Snapshot System

The dashboard captures periodic snapshots for historical analysis:

- **Automatic capture** every refresh cycle
- **7-day retention** with automatic cleanup
- **Stored data**: news clusters, market prices, prediction values, hotspot levels
- **Playback**: Load historical snapshots to see past dashboard states

Baselines (7-day and 30-day averages) are stored in IndexedDB for deviation analysis.

---

## Maritime Intelligence

The Ships layer provides real-time vessel tracking and maritime domain awareness through AIS (Automatic Identification System) data.

### Chokepoint Monitoring

The system monitors eight critical maritime chokepoints where disruptions could impact global trade:

| Chokepoint | Strategic Importance |
|------------|---------------------|
| **Strait of Hormuz** | 20% of global oil transits; Iran control |
| **Suez Canal** | Europe-Asia shipping; single point of failure |
| **Strait of Malacca** | Primary Asia-Pacific oil route |
| **Bab el-Mandeb** | Red Sea access; Yemen/Houthi activity |
| **Panama Canal** | Americas east-west transit |
| **Taiwan Strait** | Semiconductor supply chain; PLA activity |
| **South China Sea** | Contested waters; island disputes |
| **Black Sea** | Ukraine grain exports; Russian naval activity |

### Density Analysis

Vessel positions are aggregated into a 2° grid to calculate traffic density. Each cell tracks:
- Current vessel count
- Historical baseline (30-minute rolling window)
- Change percentage from baseline

Density changes of ±30% trigger alerts, indicating potential congestion, diversions, or blockades.

### Dark Ship Detection

The system monitors for AIS gaps—vessels that stop transmitting their position. An AIS gap exceeding 60 minutes in monitored regions may indicate:
- Sanctions evasion (ship-to-ship transfers)
- Illegal fishing
- Military activity
- Equipment failure

Vessels reappearing after gaps are flagged for the duration of the session.

### WebSocket Architecture

AIS data flows through a WebSocket relay for real-time updates without polling:

```
AISStream → WebSocket Relay → Browser
              (ws://relay)
```

The connection automatically reconnects on disconnection with a 30-second backoff. When the Ships layer is disabled, the WebSocket disconnects to conserve resources.

---

## Social Unrest Tracking

The Protests layer aggregates civil unrest data from two independent sources, providing corroboration and global coverage.

### ACLED (Armed Conflict Location & Event Data)

Academic-grade conflict data with human-verified events:
- **Coverage**: Global, 30-day rolling window
- **Event types**: Protests, riots, strikes, demonstrations
- **Metadata**: Actors involved, fatalities, detailed notes
- **Confidence**: High (human-curated)

### GDELT (Global Database of Events, Language, and Tone)

Real-time news-derived event data:
- **Coverage**: Global, 7-day rolling window
- **Event types**: Geocoded protest mentions from news
- **Volume**: Reports per location (signal strength)
- **Confidence**: Medium (algorithmic extraction)

### Multi-Source Corroboration

Events from both sources are deduplicated using a 0.5° spatial grid and date matching. When both ACLED and GDELT report events in the same area:
- Confidence is elevated to "high"
- ACLED data takes precedence (higher accuracy)
- Source list shows corroboration

### Severity Classification

| Severity | Criteria |
|----------|----------|
| **High** | Fatalities reported, riots, or clashes |
| **Medium** | Large demonstrations, strikes |
| **Low** | Smaller protests, localized events |

Events near intelligence hotspots are cross-referenced to provide geopolitical context.

---

## Aviation Monitoring

The Flights layer tracks airport delays and ground stops at major US airports using FAA NASSTATUS data.

### Delay Types

| Type | Description |
|------|-------------|
| **Ground Stop** | No departures permitted; severe disruption |
| **Ground Delay** | Departures held; arrival rate limiting |
| **Arrival Delay** | Inbound traffic backed up |
| **Departure Delay** | Outbound traffic delayed |

### Severity Thresholds

| Severity | Average Delay | Visual |
|----------|--------------|--------|
| **Severe** | ≥60 minutes | Red |
| **Major** | 45-59 minutes | Orange |
| **Moderate** | 25-44 minutes | Yellow |
| **Minor** | 15-24 minutes | Gray |

### Monitored Airports

The 30 largest US airports are tracked:
- Major hubs: JFK, LAX, ORD, ATL, DFW, DEN, SFO
- International gateways with high traffic volume
- Airports frequently affected by weather or congestion

Ground stops are particularly significant—they indicate severe disruption (weather, security, or infrastructure failure) and can cascade across the network.

---

## Fault Tolerance

External APIs are unreliable. Rate limits, outages, and network errors are inevitable. The system implements **circuit breaker** patterns to maintain availability.

### Circuit Breaker Pattern

Each external service is wrapped in a circuit breaker that tracks failures:

```
Normal → Failure #1 → Failure #2 → OPEN (cooldown)
                                      ↓
                              5 minutes pass
                                      ↓
                                   CLOSED
```

**Behavior during cooldown:**
- New requests return cached data (if available)
- UI shows "temporarily unavailable" status
- No API calls are made (prevents hammering)

### Protected Services

| Service | Cooldown | Cache TTL |
|---------|----------|-----------|
| Yahoo Finance | 5 min | 10 min |
| Polymarket | 5 min | 10 min |
| USGS Earthquakes | 5 min | 10 min |
| NWS Weather | 5 min | 10 min |
| FRED Economic | 5 min | 10 min |
| Cloudflare Radar | 5 min | 10 min |
| ACLED | 5 min | 10 min |
| GDELT | 5 min | 10 min |
| FAA Status | 5 min | 5 min |
| RSS Feeds | 5 min per feed | 10 min |

RSS feeds use per-feed circuit breakers—one failing feed doesn't affect others.

### Graceful Degradation

When a service enters cooldown:
1. Cached data continues to display (stale but available)
2. Status panel shows service health
3. Automatic recovery when cooldown expires
4. No user intervention required

---

## Conditional Data Loading

API calls are expensive. The system only fetches data for **enabled layers**, reducing unnecessary network traffic and rate limit consumption.

### Layer-Aware Loading

When a layer is toggled OFF:
- No API calls for that data source
- No refresh interval scheduled
- WebSocket connections closed (for AIS)

When a layer is toggled ON:
- Data is fetched immediately
- Refresh interval begins
- Loading indicator shown on toggle button

### Unconfigured Services

Some data sources require API keys (AIS relay, Cloudflare Radar). If credentials are not configured:
- The layer toggle is hidden entirely
- No failed requests pollute the console
- Users see only functional layers

This prevents confusion when deploying without full API access.

---

## Prediction Market Filtering

The Prediction Markets panel focuses on **geopolitically relevant** markets, filtering out sports and entertainment.

### Inclusion Keywords

Markets matching these topics are displayed:
- **Conflicts**: war, military, invasion, ceasefire, NATO, nuclear
- **Countries**: Russia, Ukraine, China, Taiwan, Iran, Israel, Gaza
- **Leaders**: Putin, Zelensky, Trump, Biden, Xi Jinping, Netanyahu
- **Economics**: Fed, interest rate, inflation, recession, tariffs, sanctions
- **Global**: UN, EU, treaties, summits, coups, refugees

### Exclusion Keywords

Markets matching these are filtered out:
- **Sports**: NBA, NFL, FIFA, World Cup, championships, playoffs
- **Entertainment**: Oscars, movies, celebrities, TikTok, streaming

This ensures the panel shows markets like "Will Russia withdraw from Ukraine?" rather than "Will the Lakers win the championship?"

---

## Tech Stack

- **Frontend**: TypeScript, Vite
- **Visualization**: D3.js, TopoJSON
- **Data**: RSS feeds, REST APIs
- **Storage**: IndexedDB for snapshots/baselines, LocalStorage for preferences

## Installation

```bash
# Clone the repository
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Dependencies

The dashboard fetches data from various public APIs and data sources:

| Service | Data | Auth Required |
|---------|------|---------------|
| RSS2JSON | News feed parsing | No |
| Yahoo Finance | Stock quotes, indices | No |
| CoinGecko | Cryptocurrency prices | No |
| USGS | Earthquake data | No |
| NWS | Weather alerts | No |
| FRED | Economic indicators (Fed data) | No |
| Polymarket | Prediction markets | No |
| ACLED | Armed conflict & protest data | Yes (free) |
| GDELT | News-derived event geolocation | No |
| FAA NASSTATUS | Airport delay status | No |
| Cloudflare Radar | Internet outage data | Yes (free) |
| AISStream | Live vessel positions | Yes (relay) |

### Optional API Keys

Some features require API credentials. Without them, the corresponding layer is hidden:

| Variable | Service | How to Get |
|----------|---------|------------|
| `VITE_WS_RELAY_URL` | AIS vessel tracking | Deploy AIS relay or use hosted service |
| `CLOUDFLARE_API_TOKEN` | Internet outages | Free Cloudflare account with Radar access |
| `VITE_ACLED_ACCESS_TOKEN` | Protest data | Free registration at acleddata.com |

The dashboard functions fully without these keys—affected layers simply don't appear.

## Project Structure

```
src/
├── App.ts                  # Main application orchestrator
├── main.ts                 # Entry point
├── components/
│   ├── Map.ts              # D3.js map with 18 toggleable layers
│   ├── MapPopup.ts         # Contextual info popups
│   ├── SearchModal.ts      # Universal search (⌘K)
│   ├── SignalModal.ts      # Signal intelligence display
│   ├── EconomicPanel.ts    # FRED economic indicators
│   ├── NewsPanel.ts        # News feed display
│   ├── MarketPanel.ts      # Stock/commodity display
│   ├── MonitorPanel.ts     # Custom keyword monitors
│   └── ...
├── config/
│   ├── feeds.ts            # 45+ RSS feeds, source tiers
│   ├── geo.ts              # Hotspots, conflicts, 55 cables, waterways
│   ├── pipelines.ts        # 88 oil & gas pipelines
│   ├── bases-expanded.ts   # 220+ military bases
│   ├── ai-datacenters.ts   # 313 AI clusters (filtered to 111)
│   ├── airports.ts         # 30 monitored US airports
│   ├── irradiators.ts      # IAEA gamma irradiator sites
│   └── markets.ts          # Stock symbols, sectors
├── services/
│   ├── ais.ts              # WebSocket vessel tracking
│   ├── protests.ts         # ACLED + GDELT integration
│   ├── flights.ts          # FAA delay parsing
│   ├── outages.ts          # Cloudflare Radar integration
│   ├── rss.ts              # RSS parsing with circuit breakers
│   ├── markets.ts          # Yahoo Finance, CoinGecko
│   ├── earthquakes.ts      # USGS integration
│   ├── weather.ts          # NWS alerts
│   ├── fred.ts             # Federal Reserve data
│   ├── polymarket.ts       # Prediction markets (filtered)
│   ├── clustering.ts       # Jaccard similarity clustering
│   ├── correlation.ts      # Signal detection engine
│   ├── velocity.ts         # Velocity & sentiment analysis
│   └── storage.ts          # IndexedDB snapshots & baselines
├── utils/
│   ├── circuit-breaker.ts  # Fault tolerance pattern
│   └── ...
├── styles/
└── types/
api/                        # Vercel serverless proxies
├── cloudflare-outages.js
├── faa-status.js
├── fred-data.js
├── gdelt-geo.js
└── nga-warnings.js
```

## Usage

### Keyboard Shortcuts
- `⌘K` / `Ctrl+K` - Open search
- `↑↓` - Navigate search results
- `Enter` - Select result
- `Esc` - Close modals

### Map Controls
- **Scroll** - Zoom in/out
- **Drag** - Pan the map
- **Click markers** - Show detailed popup
- **Layer toggles** - Show/hide data layers

### Panel Management
- **Drag panels** - Reorder layout
- **Settings (⚙)** - Toggle panel visibility

## Data Sources

### News Feeds
Aggregates **45+ RSS feeds** from major news outlets, government sources, and specialty publications with source-tier prioritization. Categories include world news, MENA, technology, AI/ML, finance, government releases, defense/intel, and think tanks.

### Geospatial Data
- **Hotspots**: 25+ global intelligence hotspots with keyword correlation
- **Conflicts**: 10+ active conflict zones with involved parties
- **Military Bases**: 220+ installations from US, NATO, Russia, China, and allies
- **Pipelines**: 88 operating oil/gas pipelines across all continents
- **Undersea Cables**: 55 major submarine cable routes
- **Nuclear**: 100+ power plants, weapons labs, enrichment facilities
- **AI Infrastructure**: 111 major compute clusters (≥10k GPUs)
- **Strategic Waterways**: 8 critical chokepoints

### Live APIs
- **USGS**: Earthquake feed (M4.5+ global)
- **NWS**: Severe weather alerts (US)
- **FAA**: Airport delays and ground stops
- **Cloudflare Radar**: Internet outage detection
- **AIS**: Real-time vessel positions
- **ACLED/GDELT**: Protest and unrest events
- **Yahoo Finance**: Stock quotes and indices
- **CoinGecko**: Cryptocurrency prices
- **FRED**: Federal Reserve economic data
- **Polymarket**: Prediction market odds

## Data Attribution

This project uses data from the following sources. Please respect their terms of use.

### Aircraft Tracking
Data provided by [The OpenSky Network](https://opensky-network.org). If you use this data in publications, please cite:

> Matthias Schäfer, Martin Strohmeier, Vincent Lenders, Ivan Martinovic and Matthias Wilhelm. "Bringing Up OpenSky: A Large-scale ADS-B Sensor Network for Research". In *Proceedings of the 13th IEEE/ACM International Symposium on Information Processing in Sensor Networks (IPSN)*, pages 83-94, April 2014.

### Conflict & Protest Data
- **ACLED**: Armed Conflict Location & Event Data. Source: [ACLED](https://acleddata.com). Data must be attributed per their [Attribution Policy](https://acleddata.com/attributionpolicy/).
- **GDELT**: Global Database of Events, Language, and Tone. Source: [The GDELT Project](https://www.gdeltproject.org/).

### Financial Data
- **Market Data**: Powered by [Yahoo Finance](https://finance.yahoo.com/)
- **Cryptocurrency**: Powered by [CoinGecko API](https://www.coingecko.com/en/api)
- **Economic Indicators**: Data from [FRED](https://fred.stlouisfed.org/), Federal Reserve Bank of St. Louis

### Geophysical Data
- **Earthquakes**: [U.S. Geological Survey](https://earthquake.usgs.gov/), ANSS Comprehensive Catalog
- **Weather Alerts**: [National Weather Service](https://www.weather.gov/) - Open data, free to use

### Infrastructure & Transport
- **Airport Delays**: [FAA Air Traffic Control System Command Center](https://www.fly.faa.gov/)
- **Vessel Tracking**: [AISstream](https://aisstream.io/) real-time AIS data
- **Internet Outages**: [Cloudflare Radar](https://radar.cloudflare.com/) (CC BY-NC 4.0)

### Other Sources
- **Prediction Markets**: [Polymarket](https://polymarket.com/)

## Acknowledgments

Original dashboard concept inspired by Reggie James ([@HipCityReg](https://x.com/HipCityReg/status/2009003048044220622)) - with thanks for the vision of a comprehensive situation awareness tool

---

## Design Philosophy

**Information density over aesthetics.** Every pixel should convey signal. The dark interface minimizes eye strain during extended monitoring sessions.

**Authority matters.** Not all sources are equal. Wire services and official government channels are prioritized over aggregators and blogs.

**Correlation over accumulation.** Raw news feeds are noise. The value is in clustering related stories, detecting velocity changes, and identifying cross-source patterns.

**Local-first.** No accounts, no cloud sync. All preferences and history stored locally. The only network traffic is fetching public data.

---

## License

MIT

## Author

**Elie Habib**

---

*Built for situational awareness and open-source intelligence gathering.*
