# Network Sentinel 🛡️

> **Local-First Defensive Network Monitoring & Explainable Intrusion Detection System (IDS / NDR)**

Network Sentinel is a high-contrast, privacy-first network security console designed to monitor local subnets, detect unauthorized devices, spot lateral movement, and provide mathematically explainable risk scores without black-box machine learning or third-party telemetry leaks.

---

## Table of Contents

- [Core Architectural Principles](#core-architectural-principles)
- [System Architecture](#system-architecture)
- [Directory Structure](#directory-structure)
- [Detection & Risk Engine Breakdown](#detection--risk-engine-breakdown)
- [Baseline Learning Mode](#baseline-learning-mode)
- [Observed Ports & Expected Services Architecture](#observed-ports--expected-services-architecture)
- [Interactive Features & Views](#interactive-features--views)
  - [1. Overview (Mission Control)](#1-overview-mission-control)
  - [2. Subnet Inventory (Devices View)](#2-subnet-inventory-devices-view)
  - [3. Interactive 2D Subnet Topology](#3-interactive-2d-subnet-topology)
  - [4. Activity & Syslog Audit Log](#4-activity--syslog-audit-log)
  - [5. Security Alerts Console](#5-security-alerts-console)
  - [6. Security Laboratory (`[SIMULATED]`)](#6-security-laboratory-simulated)
  - [7. Settings & Collector Configuration](#7-settings--collector-configuration)
- [Header & Side Menu Controls Reference](#header--side-menu-controls-reference)
  - [Top Header Controls Overview](#top-header-controls-overview)
  - [Subnet Scan & Auto-Scan Tabbed Modal Architecture](#subnet-scan--auto-scan-tabbed-modal-architecture)
    - [Tab 1: Subnet Scan Duration & Overdrive Mode](#tab-1-subnet-scan-duration--overdrive-mode)
    - [Tab 2: Auto Scan (Continuous & Scheduled Subnet Sweeps)](#tab-2-auto-scan-continuous--scheduled-subnet-sweeps)
  - [Monitoring Mode & Subnet Scan Visual Alignment](#monitoring-mode--subnet-scan-visual-alignment)
  - [Side Menu Controls & Animated Collapsible Logo](#side-menu-controls--animated-collapsible-logo)
- [How to Use the App](#how-to-use-the-app)
  - [Cloud Sandbox / Demo Mode](#cloud-sandbox--demo-mode)
  - [Guided 5-Step Hackathon Demo](#guided-5-step-hackathon-demo)
  - [Running on macOS (MacBook, Mac mini, iMac)](#running-on-macos-macbook-mac-mini-imac)
  - [On-Premise Deployment (Linux / Raspberry Pi)](#on-premise-deployment-linux--raspberry-pi)
- [REST & WebSocket API Reference](#rest--websocket-api-reference)
- [Developer & Debugging Guide for Humans](#developer--debugging-guide-for-humans)
- [Data Storage & Privacy](#data-storage--privacy)
- [Build & Development Commands](#build--development-commands)
- [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

---

## Core Architectural Principles

1. **Hardware-First Identity ("IP is not identity")**:
   Network Sentinel tracks network assets using hardware MAC addresses and continuity markers rather than assuming IP leases are static. When DHCP assigns a new lease to an existing laptop or phone, the device's historical profile, trust status, and event audit log persist seamlessly.

2. **Transparent, Explainable Risk Scoring**:
   Risk ratings (0–100) are computed through a strictly deterministic, itemized rules engine. Every point increment or deduction is accompanied by human-readable justification (e.g. `+20 pts: New unverified device`, `+30 pts: Port scanning activity`, `-20 pts: Trusted identity verification`).

3. **Baseline-Aware Threat Detection**:
   Before flagging benign spikes or routine network operations as anomalies, Sentinel supports a dedicated **Baseline Learning Mode** that profiles typical communication volumes, ports, and host associations.

4. **Defensive Response Abstraction**:
   Enables administrators to isolate compromised nodes via simulated or real gateway ACL policies (ARP / firewall drop rules) with explicit confirmation workflows and audit logging.

5. **100% Local & Privacy-Preserving**:
   All network metadata, packet summaries, and topology logs are maintained in local storage. No network traffic, device hostnames, or private keys are ever uploaded to external cloud endpoints.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 Frontend                               │
│  (Overview, Devices, 2D Topology, Activity, Alerts, Security Lab, UI)  │
└──────────────────┬─────────────────────────────▲───────────────────────┘
                   │ HTTP REST API               │ WebSocket (/ws)
                   ▼                             │ Live Stream
┌────────────────────────────────────────────────┴───────────────────────┐
│                    Express.js Backend Server                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Detection & Risk Engine                       │  │
│  │     - Explainable 0-100 Scoring & Evidence Generation            │  │
│  │     - Real-Time Event Analyzer                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────────────────┐     │
│  │   Baseline Manager      │  │    Defensive Response Adapter    │     │
│  │  (Confidence, Profiles) │  │   (Quarantine & Restore ACLs)    │     │
│  └─────────────────────────┘  └──────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                    Network Collector Manager                  │     │
│  │    ├─ Mock Driver (Security Lab / Demo Sandbox)               │     │
│  │    ├─ Linux Driver (/proc/net/arp Kernel Neighbor Table)      │     │
│  │    └─ macOS / Windows Native Table Drivers                    │     │
│  └───────────────────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │                 Local Store / Persistence                     │     │
│  │     (/data/store.json with SQLite/JSON Local Engine)          │     │
│  └───────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
├── .env.example                     # Environment configuration template
├── data/
│   └── store.json                   # Local persistent state (devices, alerts, events)
├── package.json                     # Dependencies & build scripts
├── server/
│   ├── baseline.ts                  # Baseline learning engine & confidence calculation
│   ├── collectors/
│   │   ├── collector.interface.ts   # Network collector driver contract
│   │   ├── collectorManager.ts      # Active collector orchestrator & event bus
│   │   ├── linuxCollector.ts        # /proc/net/arp kernel neighbor reader
│   │   └── mockCollector.ts         # Deterministic lab simulation driver
│   ├── db.ts                        # Local storage data access layer
│   ├── detection.ts                 # Explainable risk scoring & alert generation
│   ├── response.ts                  # Defensive quarantine & ACL isolation adapter
│   ├── securityLab.ts               # Controlled anomaly injection & scenario runner
│   └── types.ts                     # Backend domain models & interfaces
├── server.ts                        # Express server entry point & WebSocket setup
├── src/
│   ├── App.tsx                      # Root layout, router, and modal coordinator
│   ├── components/
│   │   ├── ActivityView.tsx         # Real-time event log & payload inspector
│   │   ├── AlertsView.tsx           # Security alerts console with "Why am I seeing this?"
│   │   ├── DeviceDetailModal.tsx    # Multi-tab deep inspection (ports, DNS, history)
│   │   ├── DevicesView.tsx          # Subnet inventory (Table & Card views)
│   │   ├── Header.tsx               # Top status bar, collector state & quick actions
│   │   ├── LearningBanner.tsx       # Baseline learning mode progress indicator
│   │   ├── OverviewView.tsx         # Primary executive dashboard & threat metrics
│   │   ├── QuarantineConfirmModal.tsx # Safety-gated device isolation dialog
│   │   ├── SecurityLabView.tsx      # Controlled sandbox & 5-step guided demo
│   │   ├── SettingsView.tsx         # Interface settings, scoring weights, JSON export
│   │   ├── Sidebar.tsx              # Primary navigation
│   │   └── TopologyView.tsx         # Interactive 2D Subnet Topology SVG canvas
│   ├── context/
│   │   └── NetworkContext.tsx       # Global state, WebSocket listeners, API hooks
│   ├── types.ts                     # Frontend TypeScript types
│   └── utils/
│       ├── api.ts                   # Fetch API client
│       └── formatters.ts            # Bandwidth, time-ago, and risk badge helpers
```

---

## Detection & Risk Engine Breakdown

Risk scores range from **0 to 100** points and are classified into four tiers:

| Score Range | Severity Tier | Color Indicator | Recommended Action |
|-------------|---------------|-----------------|--------------------|
| **0 – 29**  | `normal`      | Green           | Routine observation |
| **30 – 59** | `watch`       | Yellow          | Passive monitoring |
| **60 – 79** | `suspicious`  | Amber           | Administrator review |
| **80 – 100**| `critical`    | Red             | Quarantine / Immediate investigation |

### Default Point Weights

| Detection Heuristic | Default Points | Reason / Evidence |
|---------------------|----------------|-------------------|
| **New Device**      | `+20`          | Recently observed node without baseline registration |
| **Port Scan**       | `+30`          | Rapid TCP SYN sweep across internal service ports |
| **Unusual Hosts**   | `+20`          | Peer-to-peer lateral connections to unexpected nodes |
| **DNS Anomaly**     | `+10`          | High-entropy domain generation (DGA) or TXT tunneling |
| **Traffic Spike**   | `+15`          | Outbound bandwidth burst exceeding 3x baseline |
| **Manual Suspicious** | `+25`        | Device flagged manually by security operator |
| **Quarantine Active**| `+50`         | Device isolated pending threat resolution |
| **Trusted Bonus**   | `-20`          | Hardware MAC manually validated by administrator |
| **Baseline Match**  | `-10`          | Observed traffic complies with established baseline model |

All weights can be customized in real time via **Settings > Detection Engine Scoring Weights**.

---

## Baseline Learning Mode

Baseline mode allows Network Sentinel to learn the normal behavior of your subnet before triggering alerts.

1. **Activation**: Click **"Start Baseline Learning"** in the top navigation or from the Security Lab.
2. **Learning Duration**: Configurable duration (default: 15–60 seconds).
3. **Observation Metrics**:
   - Active device count and typical IP-to-MAC assignments
   - Routine outbound transmission rates (Kbps)
   - Discovered listening ports per node
   - Standard DNS resolution targets
4. **Confidence Score**: Displays a 0–100% confidence gauge. Once learning completes, devices that stay within baseline thresholds receive a `-10 pt` baseline deduction, reducing false positives.

---

## Observed Ports & Expected Services Architecture

Network Sentinel incorporates an **Observed Ports Engine** that bridges active network port probing with passive traffic monitoring and explainable threat scoring.

### 1. The Need for Dynamic Observed Ports
In traditional network intrusion detection, scanners either check only a tiny set of hardcoded default ports or require complex external CLI flags (`-p 1-65535`). Network Sentinel provides:
- A curated catalog of common network services categorized by operational domain.
- A user-friendly multi-select dropdown interface allowing operators to choose exactly which services are expected and observed on their subnet.
- The ability to create **custom, non-standard observed ports** (e.g. proprietary SCADA controllers, Home Assistant hubs, internal microservice APIs, or development ports).
- Direct bidirectional coupling between the chosen observed ports, the **subnet discovery scanner**, the **OS fingerprinting engine**, and the **live passive traffic monitor**.

### 2. Common Ports Catalog (Built-in)
The system includes built-in profiles for standard ports, their expected service daemon, protocol, and functional description:

| Port | Service | Protocol | Category | Description / Expected Behavior |
|------|---------|----------|----------|---------------------------------|
| **21** | FTP | TCP | File Sharing | File Transfer Protocol (unencrypted legacy control) |
| **22** | SSH | TCP | Remote Access | Secure Shell remote administration & SFTP |
| **23** | Telnet | TCP | Remote Access | Legacy plaintext terminal (flagged high risk) |
| **25** | SMTP | TCP | Network Core | Simple Mail Transfer Protocol |
| **53** | DNS | UDP/TCP | Network Core | Domain Name System resolver |
| **80** | HTTP | TCP | Web & Proxies | World Wide Web unencrypted plaintext traffic |
| **110** | POP3 | TCP | Network Core | Post Office Protocol email retrieval |
| **123** | NTP | UDP | Network Core | Network Time Protocol clock synchronization |
| **135** | MS-RPC | TCP | Network Core | Microsoft Windows RPC endpoint mapper |
| **139** | NetBIOS | TCP | File Sharing | NetBIOS Session Service / Windows file sharing |
| **143** | IMAP | TCP | Network Core | Internet Message Access Protocol |
| **443** | HTTPS | TCP | Web & Proxies | Encrypted Web Traffic (TLS/SSL encryption) |
| **445** | SMB | TCP | File Sharing | Server Message Block Windows file/printer sharing |
| **515** | LPD/LPR | TCP | Network Core | Line Printer Daemon network printing service |
| **548** | AFP | TCP | File Sharing | Apple Filing Protocol macOS network shares |
| **554** | RTSP | TCP | Streaming & Media | Real Time Streaming Protocol for IP security cameras |
| **631** | IPP / CUPS | TCP | Network Core | Internet Printing Protocol / CUPS print server |
| **993** | IMAPS | TCP | Network Core | IMAP over TLS encrypted email retrieval |
| **1433** | MSSQL | TCP | Databases | Microsoft SQL Server database listener |
| **1883** | MQTT | TCP | IoT & Smart Home | Lightweight IoT publish-subscribe telemetry broker |
| **1900** | SSDP | UDP | IoT & Smart Home | Simple Service Discovery Protocol (UPnP discovery) |
| **3000** | Dev Server | TCP | Web & Proxies | Modern web application development & preview server |
| **3306** | MySQL | TCP | Databases | MySQL / MariaDB relational database engine |
| **3389** | RDP | TCP | Remote Access | Microsoft Remote Desktop Protocol desktop access |
| **5000** | Synology DSM | TCP | File Sharing | Synology DiskStation Manager web portal |
| **5001** | DSM SSL | TCP | File Sharing | Synology DiskStation Manager HTTPS portal |
| **5353** | mDNS | UDP | Network Core | Multicast DNS / Bonjour zero-configuration discovery |
| **5357** | WSD | TCP | Network Core | Web Services for Devices (Windows discovery daemon) |
| **5432** | PostgreSQL | TCP | Databases | PostgreSQL object-relational database engine |
| **5900** | VNC | TCP | Remote Access | Virtual Network Computing remote desktop sharing |
| **6379** | Redis | TCP | Databases | In-memory key-value cache and data store |
| **7000** | AirPlay | TCP | Streaming & Media | Apple AirPlay screen mirroring & audio streaming |
| **8000** | HTTP-Alt | TCP | Web & Proxies | Alternative HTTP proxy or internal web service |
| **8008** | Chromecast | TCP | Streaming & Media | Google Cast / DIAL media device control |
| **8080** | HTTP Proxy | TCP | Web & Proxies | Common web proxy, Apache Tomcat, or API gateway |
| **8443** | HTTPS-Alt | TCP | Web & Proxies | Secondary TLS/SSL web interface & management portal |
| **8883** | MQTT-TLS | TCP | IoT & Smart Home | Secure MQTT with TLS/SSL encryption |
| **9000** | Portainer | TCP | Web & Proxies | Container management console & SonarQube |
| **9100** | JetDirect | TCP | Network Core | Raw HP JetDirect / network printer data stream |
| **27017** | MongoDB | TCP | Databases | NoSQL document database server |
| **32400** | Plex | TCP | Streaming & Media | Plex Media Server home streaming portal |

### 3. Creating Custom / Non-Standard Monitored Ports
When working with proprietary devices, local home lab equipment, or unique internal infrastructure, operators can define custom ports:
- **Port Number**: Any valid integer between `1` and `65535`.
- **Expected Service Name**: Free-text label (e.g., `Home Assistant`, `SCADA Modbus`, `Custom ERP API`, `Minecraft Server`).
- **Protocol**: Select `TCP`, `UDP`, or `Both`.
- **Category**: Custom, Web, Remote Access, Smart Home / IoT, Database, File Sharing, Core Network, or Streaming Media.
- **Description / Notes**: Human-readable context explaining why the port is under active observation.
- Custom ports are stored in `sentinel_db.json`, tagged with a distinct `CUSTOM` badge, and can be individually deleted or toggled.

### 4. How Observed Ports Flow Across the Stack
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Configuration (UI Modal / REST API)                                      │
│    - Operator selects ports from common catalog or inputs custom port       │
│    - Persisted in local database `sentinel_db.json`                         │
│    - Broadcasts `observed_ports.updated` over WebSocket                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Subnet Discovery & Active Fingerprinting (`server/osFingerprint.ts`)     │
│    - `probeSignaturePorts()` queries `observedPortsManager.getActivePortNumbers()`│
│    - Target ports for every online host are dynamically merged              │
│    - `probeTcpPort()` probes each target, maps service banners, and logs    │
│      open/closed states directly into device records                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Passive Traffic Monitoring Simulation (`server/trafficMonitor.ts`)       │
│    - `pickRealisticInteraction()` incorporates active observed ports        │
│    - Realistic synthetic requests emulate authentic IoT/server communications│
│      matching user-configured ports and services                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Detection & Explainable Threat Scoring (`server/detection.ts`)           │
│    - Detection engine verifies open ports against the observed ports set    │
│    - Generates itemized risk evidence (e.g. unexpected open management ports│
│      on untrusted nodes or new unverified listeners)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Interactive Features & Views

### 1. Overview (Mission Control)
- **Top Metric Cards**: Total Subnet Assets, Online Nodes, Active Alerts, and Subnet Threat Level.
- **Explainable Threat Matrix**: Real-time distribution of devices across Normal, Watch, Suspicious, and Critical tiers.
- **High-Risk Device Spotlight**: Instant shortcut to inspect the most critical nodes on the network.
- **Recent Audit Stream**: Live ticker of device discoveries, IP changes, and port scan events.

### 2. Subnet Inventory (Devices View)
- Switch between **Table View** and **Card Grid**.
- Filter by search query (hostname, IP, MAC, vendor, or tag), Trust State (`known`, `new`, `guest`, `suspicious`, `blocked`), and Risk Tier.
- Displays hardware vendor lookup (Apple, MikroTik, Synology, Nest, etc.), active IP, lease counts, and risk score badges.
- One-click **Inspect**, **Quarantine**, or **Restore** action buttons.

### 3. Interactive 2D Subnet Topology & Real-Time Router Request Tracking
- Visualizes WAN Gateway, Router (`192.168.1.1`), and connected device nodes in an interactive radial tree layout.
- Zoom in, zoom out, and reset canvas controls.
- **Real-Time Machine-to-Router Request Tracking**:
  - **Quantity of Requests**: Link midpoints and node badges display the exact number of requests each machine has made to the router (e.g. `48 req • DNS`, `⚡54`).
  - **Request Types & Protocols**: Shows what type of requests devices are issuing (DNS resolution, HTTPS web transit, NTP clock synchronization, DHCP renews, mDNS discovery, and ICMP keepalive).
  - **Animated Bi-Directional Request Pulses**: Glowing visual particles travel from machines to the router upon each request, with return pulses for replies.
  - **Protocol Filter Bar**: Filter topology activity by request protocol (`ALL`, `DNS`, `HTTPS`, `NTP`, `ICMP`) or toggle pulse animations.
- **Node & Router Telemetry Inspector**: Clicking any machine displays its total router interaction volume, request rate (reqs/min), protocol distribution breakdown, and full details of the latest request.
- **Live Streaming Telemetry Ticker**: Bottom log table streams real-time router requests with timestamps, source machine, protocol, port, packet size, and request summary.
- **Dynamic Link Color Coding**:
  - Green: Normal traffic
  - Amber: Suspicious activity
  - Red: Critical threat or isolated node
  - Dashed Red: Quarantined node (traffic blocked)

### 4. Activity & Syslog Audit Log
- Live stream of network events powered by WebSockets.
- Filter by severity (`critical`, `suspicious`, `watch`, `info`) and event type (`device_discovered`, `port_scan`, `dns_anomaly`, `traffic_anomaly`, `ip_changed`, `response`).
- Pause / Resume live stream button.
- **Evidence Metadata Inspector**: Click any event to expand the raw JSON payload with port lists, byte counts, and packet rates.

### 5. Security Alerts Console
- Filter between **Active**, **Resolved**, and **All History**.
- Every alert highlights **"Why am I seeing this alert?"** with itemized bullet points.
- One-click **"Investigate Node"** opens the device's deep-dive inspection modal.
- Resolve alerts with an operator audit tag.

### 6. Security Laboratory (`[SIMULATED]`)
A dedicated, clearly labeled testbed for testing detection rules and demonstrations:
- **5-Step Guided Hackathon Demo Sequence** (see below).
- **Individual Scenario Triggers**:
  1. *Rogue Subnet Device* (+20 pts)
  2. *Lateral TCP Port Scan* (+30 pts)
  3. *DNS Tunneling & DGA Query* (+10 pts)
  4. *Abnormal Outbound Spike* (+15 pts)
  5. *DHCP Dynamic IP Shift* (Identity continuity test)
- **Reset Lab Button**: Restores the database and baseline to clean initial state.

### 7. Settings & Collector Configuration
- **Network Interface**: Configure subnet range (e.g. `192.168.1.0/24`) and interface (`eth0`, `en0`).
- **Collector Driver**: Switch between Mock Driver, Linux Kernel Neighbor Table (`/proc/net/arp`), macOS, and Windows.
- **Risk Weight Sliders**: Adjust point values for all 7 detection rules.
- **Data Export**: Export complete database (devices, alerts, events) to a formatted JSON audit file.
- **Reset Database**: Clears local data store back to baseline defaults.

---

## Header & Side Menu Controls Reference

## Header & Side Menu Controls Reference

### Top Header Controls Overview

The top navigation header houses real-time operational status indicators and quick-action triggers accessible from any view:

| Button / Control | Visual State & Icon | Action & Functionality |
|---|---|---|
| **Network Interface Badge** | Cyan/Blue/Emerald Badge (`Cable`, `Wifi`, or `WifiOff`) | **Auto-Detected Connection Indicator**: <br>• Highlights active link type: `WI-FI`, `ETHERNET`, `ETHERNET + WI-FI`, or `OFFLINE`.<br>• Clicking opens the Network Interface settings panel to view hardware MACs and IP subnet parameters. |
| **Scan Subnet (Split Control)** | Rotating Radar (`Radar`) with chevron dropdown (`ChevronDown`) | **Subnet Discovery & Sweep Engine**: <br>• **Left Button (Trigger / Stop)**: Fires an immediate subnet sweep, pauses an ongoing indefinite sweep, or triggers an on-demand burst during auto-scanning.<br>• **Right Button (Dropdown)**: Opens the **Tabbed Configuration Modal** (`Scan Duration` vs. `Auto Scan`).<br>• **Automatic Monitoring Kick-off**: Running any subnet scan automatically starts Monitoring Mode and traffic safety profiling if it was previously off. |
| **Monitoring Mode** | Emerald Pulsing Badge (`CheckCircle2`) or Muted Gray (`Square`) | **Defensive Packet Inspection & Traffic Telemetry**: <br>• **Active State**: Continuously inspects packet flows, updates 2D router telemetry, and executes real-time anomaly heuristics.<br>• **4-Second Safety Hold Interlock**: To prevent accidental shutdown, turning off Monitoring Mode requires holding the button pressed down for 4 full seconds with a live red progress fill and countdown animation. |
| **Baseline Learning Progress** | Amber Pulsing Badge (`BookOpen`) | **Active Profile Calibration**: <br>• Visible when baseline training is underway (e.g., `Learning (45%) • 8s`).<br>• Profiles normal IP-to-MAC assignments, typical throughput, and listening ports.<br>• Includes a 1-click **Stop** button to finalize baseline scoring early. |
| **Demo Lab Shortcut** | Amber Sparkles (`Sparkles`) | **Instant Sandbox Access**: <br>• 1-click shortcut to the **Security Demonstration Laboratory** (`security-lab`).<br>• Enables rapid execution of the guided 5-step incident sequence without traversing menu trees. |
| **LIVE / POLLING Badge** | Green Wi-Fi (`Wifi`) or Gray Disconnected (`WifiOff`) | **WebSocket Health Indicator**: <br>• Displays `LIVE` with an emerald indicator when connected to `ws://localhost:3000/ws` for real-time telemetry streaming.<br>• Automatically falls back to periodic REST polling if WebSockets are unavailable. |

---

### Subnet Scan & Auto-Scan Tabbed Modal Architecture

Clicking the dropdown arrow (`ChevronDown`) next to the **Scan Subnet** button opens an inspector modal featuring a dual-tab architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  [ Clock: Scan Duration ]      [ RefreshCw: Auto Scan (ON) ]│
├─────────────────────────────────────────────────────────────┤
│ Tab 1: Single Scan Sweeps      Tab 2: Recurring Engine      │
│  - Presets (10s, 15s, 30s, 60s)  - Presets (10s to 15m)    │
│  - Continuous Slider (1s-60s)    - Custom Slider (5s-300s)  │
│  - Time Overdrive (>60s-10m/Inf) - Indefinite vs Timed      │
│  - Immediate Execution Button    - Live Sweep Progress Bar  │
└─────────────────────────────────────────────────────────────┘
```

#### Tab 1: Subnet Scan Duration & Overdrive Mode

The **Scan Duration** tab configures single, on-demand discovery sweeps:

1. **Standard Durations & Presets**:
   - **Instant (0s)**: Performs a fast single ARP table query and updates online/offline states.
   - **Quick Presets**: 10-second Quick Sweep, 15-second Standard Sweep, 30-second Deep Sweep, 45-second Audit, and 60-second Standard Maximum.
   - **Interactive Duration Slider**: Smoothly adjust duration between 1 second and 60 seconds with live visual label feedback.
2. **Time Overdrive Mode Switch**:
   - By default, single scan duration is capped at 60 seconds to protect network and CPU resources.
   - Enabling **Time Overdrive** toggles extended scan windows:
     - **120s (2 min)**, **300s (5 min)**, **600s (10 min)**.
     - **Continuous Indefinite Scan (`∞ Continuous Scan`)**: Sweeps the subnet repeatedly every 4 seconds without stopping.
   - **Resource & Safety Warning**: Clearly warns operators that continuous sweeps generate sustained ARP traffic and consume local CPU cycles.
3. **Execution & Interlocks**:
   - Click **Run Subnet Scan** to start the sweep with the configured duration.
   - The button pill updates dynamically (e.g. `Scan Subnet (30s)`, `Scanning (24s)`, or `Scanning Indefinitely`).
   - Clicking the button while scanning instantly cancels the sweep and restores idle state.

#### Tab 2: Auto Scan (Continuous & Scheduled Subnet Sweeps)

The **Auto Scan** tab decouples recurring background scheduling from single-sweep durations, providing a persistent, automated network sentinel:

1. **Master Switch (ON / OFF)**:
   - Toggle switch activates or deactivates the recurring sweep engine.
   - When active, the header button badge displays an animated pulsing `AUTO` indicator with an active countdown.
2. **Interval Configuration**:
   - **Quick Interval Presets**: 10s, 15s, 30s, 1 min, 2 min, 5 min, 10 min, and 15 min.
   - **Custom Interval Slider**: Fine-tune repeat frequency from **5 seconds up to 300 seconds (5 minutes)**.
3. **Schedule Mode (Indefinite vs. Timed Sessions)**:
   - **Scan Indefinitely (`∞`)**: Runs recurrent sweeps indefinitely until explicitly stopped by an administrator.
   - **Timed Sessions**: Automatically limits the auto-scan run window to **5 minutes**, **15 minutes**, **30 minutes**, or **1 hour**, after which the engine disarms itself safely.
4. **Live Progress & Status Telemetry Card**:
   - **Completed Sweeps Counter**: Displays the exact number of discovery cycles executed (e.g. `12 sweeps done`).
   - **Real-Time Countdown**: Live second-by-second countdown to the next sweep (e.g. `Next subnet sweep in: 8s`).
   - **Animated Progress Bar**: Smooth linear progress bar visualizing elapsed interval percentage.
5. **Non-Blocking Background Execution**:
   - Auto-scans operate seamlessly without locking the dashboard, modal views, or topology inspector.
   - Parameters are persisted in browser `localStorage` (`sentinel_autoscan_interval`, `sentinel_autoscan_indefinite`, `sentinel_autoscan_session`) so preferences remain intact across page refreshes.

---

### Monitoring Mode & Subnet Scan Visual Alignment

To provide a cohesive, professional mission-control interface, the **Scan Subnet** and **Monitoring Mode** buttons are strictly aligned:

- **Geometric Alignment**: Both controls share identical `h-8` heights, `rounded-md` corner radiuses, `text-xs font-medium` typography, and matching border weights.
- **Automatic Monitoring Kick-off**: In real-world security operations, discovering devices without inspecting traffic is incomplete. Initiating any subnet scan (instant, timed, overdrive, or auto-scan) **automatically turns on Monitoring Mode** if it was paused, immediately capturing traffic telemetry and applying defensive risk heuristics.
- **Accidental Deactivation Protection**: Monitoring Mode includes a 4-second hold safety interlock (`onPointerDown` / `onPointerUp`) with an animated red progress overlay, preventing accidental telemetry interruption.

---

### Side Menu Controls & Animated Collapsible Logo

The left sidebar provides access to all primary monitoring modules, incident response tools, and system diagnostics:

| Button / Control | Icon & Indicator | Action & Functionality |
|---|---|---|
| **Top-Left Animated Shield Logo (Collapse / Expand)** | Emerald Shield (`Shield`) with micro-chevron indicator | **Animated Sidebar Toggle**: <br>• **Click Action**: Smoothly collapses the sidebar from expanded width (`256px`) down to a compact icon-only view (`72px`), maximizing screen space for wide topology graphs and dense device tables.<br>• **Micro-Interactions & Animations**: Hovering triggers an interactive scale bounce (`scale-105`), an emerald glow halo (`shadow-[0_0_12px_rgba(16,185,129,0.25)]`), and a subtle shield rotation. The mini-chevron flips 180° when toggled.<br>• **Collapsed State**: Nav items switch to centered icon-only view with native hover tooltips and compact notification badge dots. Click the logo again to restore the full sidebar.<br>• State persists in browser `localStorage`. |
| **Overview** | `LayoutDashboard` | **Mission Control Dashboard**: <br>• Opens the primary executive view displaying subnet asset totals, online node counts, active alerts, and overall subnet threat score.<br>• Houses the **Explainable Threat Matrix** and **High-Risk Device Spotlight**. |
| **Devices** | `Server` with numeric count badge | **Subnet Inventory & Identity Registry**: <br>• Displays the complete inventory of discovered network assets.<br>• Badge shows total registered devices; turns amber if suspicious or critical nodes are present.<br>• Features Table and Card views, search bar, OS family filters, and batch "Fingerprint All OS" probing. |
| **Topology** | `Network` | **Interactive 2D Subnet Map**: <br>• Renders an interactive vector graph of the WAN Gateway, router, and connected endpoints.<br>• Features real-time animated data throughput pulses along communication links and a node inspection drawer. |
| **Activity Stream** | `Activity` | **Real-Time Syslog & Audit Log**: <br>• Chronological live feed of observed network events (new devices, IP changes, TCP port scans, DNS queries, and firewall quarantine responses).<br>• Expandable raw JSON evidence payload inspector for forensic analysis. |
| **Security Alerts** | `AlertTriangle` with unread alert badge | **Incident Triage Console**: <br>• Displays active and resolved alerts with itemized "Why am I seeing this alert?" explanations.<br>• Prominent red badge indicates the number of unresolved active threats.<br>• Includes 1-click **Investigate Node** navigation to inspect the offending device. |
| **Security Lab** | `FlaskConical` with `[SIMULATED]` tag | **Incident Response Demonstration Testbed**: <br>• Controlled simulation sandbox for testing detection rules and demonstrations.<br>• Contains the **5-Step Guided Hackathon Demo Sequence** and individual anomaly injection buttons (Rogue Device, Port Scan, DNS Tunneling, Traffic Spike, Dynamic IP Shift). |
| **Settings** | `Settings` | **Collector & Detection Configuration**: <br>• Configure subnet CIDR ranges (`192.168.1.0/24`) and physical network interfaces (`en0`, `eth0`).<br>• Switch collector drivers (macOS, Linux, Mock).<br>• Adjust detection engine point weights and export the entire audit database to a timestamped JSON file. |
| **Passive Collector Footer** | Animated green heartbeat pulse dot | **Hardware Collector Telemetry**: <br>• Shows the active driver (`mock`, `macos_arp`, `linux_arp`), network interface, and count of active online devices.<br>• In collapsed mode, condenses to a centered pulsing heartbeat with a detailed hover tooltip. |

---

## How to Use the App

### Cloud Sandbox / Demo Mode

When running in Google AI Studio or the cloud preview environment, the app runs in an isolated container. The container cannot directly scan your physical Wi-Fi network. 

Instead, the app runs the **Security Lab Mock Driver** by default, populating realistic sample devices (Gateway router, MacBook, Synology NAS, Ubuntu server, Nest thermostat). You can fully test all inspection features, topology rendering, alert flows, and quarantine actions in this mode.

---

### Guided 5-Step Hackathon Demo

To demonstrate the full detection and remediation lifecycle in under 60 seconds:

1. Navigate to **Security Lab** in the left sidebar.
2. Click **Step 1: Start & Baseline**:
   - The top banner turns amber, initiating baseline learning mode.
   - Network Sentinel profiles healthy subnet communication.
3. Click **Step 2: Subnet Verified**:
   - Baseline learning concludes with a high statistical confidence score.
   - Normal devices receive a `-10 pt` baseline bonus.
4. Click **Step 3: Rogue Device**:
   - Simulates an unauthorized IoT device (`rogue-esp32-sensor.local`) joining the DHCP pool.
   - The device is detected as `new`, instantly triggering an explainable `+20 pt` risk score.
5. Click **Step 4: Port Scan Probe**:
   - The rogue device launches an internal TCP SYN scan probing sensitive ports (SMB 445, NetBIOS 139, RDP 3389).
   - Detection engine adds `+30 pts`, elevating the node to **Critical (85/100)**.
6. Click **Step 5: Inspect Alert**:
   - Automatically opens the **Alerts Console**.
   - Review the evidence: rapid SYN rate, probed ports, and targeted internal IPs.
   - Click **Investigate Node** → click **Quarantine Device** to simulate an immediate firewall drop rule.

---

### Running on macOS (MacBook, Mac mini, iMac)

Network Sentinel runs natively on Apple Silicon (M1/M2/M3/M4) and Intel Macs on macOS Sonoma, Ventura, Monterey, and later. On macOS, Network Sentinel queries the native kernel neighbor table (`arp -an`) without needing root or `sudo` privileges.

#### 1. Mac Prerequisites
- **Homebrew** (recommended) or official Node.js installer:
  ```bash
  # Check if Node is installed
  node -v

  # If not installed, install via Homebrew:
  brew install node pnpm
  ```
- Any standard terminal emulator (Terminal.app, iTerm2, Warp, Ghostty).

#### 2. Find Your Mac's Wi-Fi Interface & Subnet
On macOS, your primary Wi-Fi interface is typically `en0` (or `en1` on some Mac models or when using a Thunderbolt dock).

Run these commands in your Mac terminal:
```bash
# Identify your active default route interface (typically en0):
route get default | grep interface
# Output example: interface: en0

# Get your Mac's current local IP address:
ipconfig getifaddr en0
# Output example: 192.168.1.45  (Your subnet is 192.168.1.0/24)
```

#### 3. Clone and Start Network Sentinel
```bash
# Clone or extract the project
cd network-sentinel

# Enable pnpm and install dependencies
corepack enable pnpm
pnpm install

# Start the full-stack development server
pnpm dev
# (Or using npm: npm install && npm run dev)
```
*The server will start on `http://localhost:3000`.*

> **Note on pnpm v10/v11 (`ERR_PNPM_IGNORED_BUILDS`)**:
> Modern pnpm enforces supply-chain security by ignoring dependency build scripts unless approved. Network Sentinel already ships with pre-configured build permissions in `pnpm-workspace.yaml` for `esbuild`, `protobufjs`, and `@google/genai`. If you ever see a prompt regarding ignored builds, simply run:
> ```bash
> pnpm approve-builds --all
> ```

#### 4. macOS Firewall Notice
When Node boots the server for the first time, macOS may present a system security dialog:
> *"Do you want the application 'node' to accept incoming network connections?"*

Click **Allow**. This enables the local dashboard and WebSocket real-time feeds to operate smoothly.

#### 5. Enable Native macOS Subnet Scanning
1. Open your browser (Safari, Chrome, Arc, Firefox) to `http://localhost:3000`.
2. Navigate to **Settings** in the left sidebar.
3. In **Network Interface & Subnet Discovery**:
   - **Subnet Range**: Enter your local subnet (e.g., `192.168.1.0/24` or `10.0.0.0/24`).
   - **Network Interface**: Set to `en0` (or your active interface from step 2).
   - **Collector Driver**: Select `macOS Native Neighbor Table (arp -an)`.
4. Click **Save Changes**.
5. Click **Scan Subnet Now** in the top navigation bar.

#### 6. Pro-Tip: Fast Subnet Population on macOS
macOS only stores ARP neighbor table entries for devices your Mac has interacted with recently. If you want Network Sentinel to immediately catalog all devices on your Wi-Fi (such as smart TVs, IoT bulbs, phones, and printers):

```bash
# Send a quick broadcast ping across your subnet to wake up all LAN devices:
ping -c 3 192.168.1.255
# (Replace 192.168.1.255 with your subnet's broadcast address, or use 255.255.255.255)
```
After the broadcast ping returns, click **Scan Subnet Now** in the Network Sentinel UI. All active devices will immediately populate the **Subnet Inventory** and **2D Topology Map**.

---

### On-Premise Deployment (Linux / Raspberry Pi)

To monitor your physical home or office network with real packet observation:

#### Prerequisites
- Node.js 18+ or 20+
- A machine connected to your local network (e.g. Raspberry Pi, Linux home server, Mac, or PC)
- Permissions to read local ARP / neighbor tables (root/sudo optional for `/proc/net/arp`, required for raw socket packet capture)

#### Setup Steps

1. **Clone or Export the Project**:
   ```bash
   git clone <repository-url>
   cd network-sentinel
   ```

2. **Install Dependencies** (Recommended with **pnpm**):
   ```bash
   # Enable pnpm if not already installed (Corepack is built into Node 18+)
   corepack enable pnpm

   # Install dependencies with lockfile validation
   pnpm install
   # Or using npm: npm install
   ```

3. **Start the Development Server**:
   ```bash
   pnpm dev
   # Or using npm: npm run dev
   ```
   *The server starts on `http://localhost:3000`.*

4. **Production Build & Run**:
   ```bash
   pnpm build
   pnpm start
   # Or using npm: npm run build && npm start
   ```

5. **Enable Real Network Discovery**:
   - Open your browser to `http://localhost:3000`.
   - Go to **Settings** in the left sidebar.
   - Under **Network Interface & Subnet Discovery**, set:
     - **Subnet Range**: Your subnet (e.g., `192.168.1.0/24` or `10.0.0.0/24`).
     - **Network Interface**: Your local interface (e.g., `eth0`, `wlan0`, `en0`).
     - **Collector Driver**: Select `Host Linux Neighbor Table (/proc/net/arp)` or corresponding OS driver.
   - Click **Save Changes**.
   - Click **Scan Subnet Now** in the top navigation bar. Network Sentinel will begin cataloging active devices on your local network.

---

## REST & WebSocket API Reference

### WebSocket Feed

Connect to `ws://localhost:3000/ws`.

| Event Name | Description |
|------------|-------------|
| `system.status` | Emitted when system-wide counts, network interfaces, or operational modes update. |
| `monitoring.updated` | Emitted when Monitoring Mode is toggled or auto-started (`{ active: boolean, mode: string }`). |
| `devices.updated`| Emitted when all devices update following a subnet discovery scan. |
| `device.updated`| Emitted when an individual device's trust status, IP, or risk score changes. |
| `event.created` | Emitted whenever a network event (discovery, scan, DNS, traffic) occurs. |
| `alert.created` | Emitted when a new security alert is generated by the detection engine. |
| `topology.updated` | Emitted when topology nodes or edge links change. |
| `baseline.updated` | Emitted when baseline learning progress or confidence updates. |

---

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/status` | Current system health, device counts, network interfaces, uptime, and collector mode. |
| `GET`  | `/api/monitoring` | Get current Monitoring Mode state (`{ active: boolean, mode: string }`). |
| `POST` | `/api/monitoring/toggle` | Toggle or set Monitoring Mode. Body: `{ "enabled": boolean }`. |
| `GET`  | `/api/devices` | List all discovered devices with current IP, MAC, trust, and risk score. |
| `GET`  | `/api/devices/:id` | Get full details for a single device (ports, DNS logs, IP history). |
| `POST` | `/api/devices/:id/trust` | Set trust level (`known`, `new`, `guest`, `suspicious`, `blocked`). Body: `{ "trustStatus": "known" }`. |
| `POST` | `/api/devices/:id/detect-os` | Run passive fingerprinting on a single device. |
| `POST` | `/api/discovery/detect-all-os` | Batch fingerprint all registered devices on the subnet. |
| `POST` | `/api/devices/:id/quarantine` | Isolate device via simulated ACL rule. Body: `{ "reason": "string" }`. |
| `POST` | `/api/devices/:id/restore` | Remove quarantine isolation and restore routing. |
| `DELETE`| `/api/devices/:id` | Remove a device record from the persistent inventory. |
| `GET`  | `/api/topology` | Get 2D topology nodes and edge links with current throughput rates. |
| `GET`  | `/api/events` | Retrieve recent network event logs (`?limit=100`). |
| `POST` | `/api/events/clear` | Clear network event audit history. |
| `GET`  | `/api/alerts` | Retrieve active and resolved security alerts. |
| `POST` | `/api/alerts/:id/resolve` | Mark an alert as resolved. Body: `{ "resolvedBy": "Admin" }`. |
| `GET`  | `/api/baseline` | Get baseline learning state, duration, and confidence score. |
| `POST` | `/api/baseline/start-learning` | Initiate baseline learning. Body: `{ "durationSeconds": 15, "indefinite": false }`. |
| `POST` | `/api/baseline/finish-learning`| Manually complete baseline learning mode. |
| `POST` | `/api/security-lab/events` | Trigger anomaly scenario (`new_device`, `port_scan`, `dns_anomaly`, `traffic_spike`, `ip_change`). |
| `POST` | `/api/security-lab/reset` | Reset lab state and database to baseline defaults. |
| `GET`  | `/api/settings` | Read current interface and detection weight configuration. |
| `POST` | `/api/settings` | Update settings and detection weights. |
| `POST` | `/api/discovery/scan` | Trigger immediate collector subnet discovery pass. Body: `{ "durationSeconds": 0, "indefinite": false }`. <br>• Automatically starts Monitoring Mode if paused.<br>• Enriches online nodes with OS fingerprints.<br>• Recalculates compounded 0–100 risk scores.<br>• Broadcasts updates over WebSocket. |
| `GET`  | `/api/observed-ports` | Get all common catalog and custom observed ports, active ports list, and counts. |
| `POST` | `/api/observed-ports` | Update active monitored port numbers. Body: `{ "portNumbers": [80, 443, 22, ...] }`. |
| `POST` | `/api/observed-ports/custom` | Define a new custom non-standard observed port. Body: `{ "port": 8123, "service": "Home Assistant", "protocol": "tcp", "description": "...", "category": "iot" }`. |
| `DELETE`| `/api/observed-ports/:port` | Delete a custom observed port from the configuration. |
| `POST` | `/api/observed-ports/batch-probe` | Probe all online subnet devices for the active observed ports immediately, enrich device open port arrays, and recalculate risk. |

---

## Developer & Debugging Guide for Humans

This section provides maintainers and security developers with structural insight into how Network Sentinel functions internally and how to diagnose issues.

### 1. Subnet Discovery Lifecycle Under the Hood

When a user clicks **Scan Subnet**, configures an **Auto Scan**, or calls `POST /api/discovery/scan`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Trigger Invocation (UI Click / Auto-Scan Interval / REST API)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Collector Driver Execution (`collectorManager.discoverNow()`)            │
│    - Linux: Reads and parses kernel neighbor table `/proc/net/arp`          │
│    - macOS: Spawns non-root `arp -an` and parses HW address entries         │
│    - Sandbox / Demo: Queries deterministic `MockCollector` dataset          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Hardware MAC-to-Device Reconciliation                                    │
│    - Matches discovered hardware MAC addresses against `data/store.json`    │
│    - Discovered nodes: set to `status: 'online'` and update `lastSeen`      │
│    - Undiscovered nodes: preserved with `status: 'offline'` (never deleted) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. OS Fingerprinting & Enrichment Pipeline                                  │
│    - Probes open ports & TCP/IP stack signatures for un-fingerprinted nodes │
│    - Identifies device vendor and operating system (macOS, Linux, etc.)     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. Dynamic Risk Score Recalculation                                         │
│    - Evaluates detection heuristics (ports, DNS, traffic, trust status)     │
│    - Produces explainable 0–100 risk scores and itemized evidence tags      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Automatic Monitoring Mode Activation                                     │
│    - If Monitoring Mode was OFF, kicks off packet capture & traffic monitor │
│    - Logs a `monitoring_event` in the audit log                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. Real-Time WebSocket Multi-Broadcast                                      │
│    - Dispatches `devices.updated`, `system.status`, `monitoring.updated`,   │
│      and `topology.updated` to all connected browser clients                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Auto-Scan Engine Architecture & State Machine

The Auto-Scan engine (`src/context/NetworkContext.tsx`) manages background scheduling on the client:

- **State Fields**:
  - `isAutoScanActive`: Boolean indicating whether recurring background scanning is running.
  - `autoScanInterval`: Recurring interval in seconds (default: 30s, range: 5s to 300s).
  - `autoScanCountdown`: Real-time remaining seconds until the next sweep.
  - `autoScanCompletedSweeps`: Counter of completed sweeps in the current session.
  - `autoScanIsIndefinite`: If `true`, runs indefinitely; if `false`, respects session duration limit.
  - `autoScanSessionDuration`: Session limit in seconds (300s = 5m, 900s = 15m, 1800s = 30m, 3600s = 1h).
- **LocalStorage State Persistence**:
  Settings are persisted in `localStorage` under:
  - `sentinel_autoscan_interval`
  - `sentinel_autoscan_indefinite`
  - `sentinel_autoscan_session`
- **Timer Mechanics & Cleanup**:
  - Auto-scan uses `setInterval` ticking every 1,000ms to decrement `autoScanCountdown`.
  - When countdown reaches 0, it calls `api.triggerScan()` without UI blocking, increments `autoScanCompletedSweeps`, and resets the countdown.
  - If a timed session expires (`elapsed >= session`), the timer disarms cleanly.
  - Unmounting or calling `stopAutoScan()` clears `autoScanTimerRef.current`.

### 3. Observed Ports Architecture & Debugging Notes

The Observed Ports system synchronizes port definitions between database storage, active network socket testing, and passive traffic simulation:

- **Source of Truth (`server/observedPorts.ts`)**:
  - `observedPortsManager`: Singleton instance maintaining the `COMMON_PORTS_CATALOG` combined with persistent user configs from `server/db.ts`.
  - Methods: `getAllPorts()`, `getActivePortNumbers()`, `saveActivePortNumbers()`, `addCustomPort()`, `removePort()`, `getServiceForPort()`.
- **Database Schema**:
  - Persisted in `data/sentinel_db.json` (or `sentinel_db.json`) under the key `"observedPorts": [...]`.
  - Stored structure: `{ port: number, service: string, protocol: 'tcp'|'udp'|'both', description?: string, category?: string, isCustom?: boolean, enabled?: boolean }`.
- **Port Probing Engine (`server/osFingerprint.ts`)**:
  - Probing uses `probeSignaturePorts()` which pulls `observedPortsManager.getActivePortNumbers()`.
  - Connects using non-blocking Node.js `net.Socket` with 120ms timeouts to avoid blocking scanning loops.
  - When open, records port number, inferred or custom service banner, protocol, and state `open`.
- **Traffic Simulator (`server/trafficMonitor.ts`)**:
  - `pickRealisticInteraction()` randomly pairs online devices with one of the active observed ports, emitting realistic client/server interactions and syslog events.

#### Testing Observed Ports via CLI
```bash
# 1. Fetch current list of observed ports and active status:
curl -s http://localhost:3000/api/observed-ports | jq .

# 2. Add a custom non-standard port (e.g. Home Assistant port 8123):
curl -X POST http://localhost:3000/api/observed-ports/custom \
  -H "Content-Type: application/json" \
  -d '{"port": 8123, "service": "Home Assistant", "protocol": "tcp", "description": "Home automation controller", "category": "iot"}' | jq .

# 3. Enable a specific set of active port numbers:
curl -X POST http://localhost:3000/api/observed-ports \
  -H "Content-Type: application/json" \
  -d '{"portNumbers": [22, 80, 443, 8123, 3389]}' | jq .

# 4. Trigger immediate batch probe of observed ports across all online subnet nodes:
curl -X POST http://localhost:3000/api/observed-ports/batch-probe | jq .

# 5. Delete a custom port:
curl -X DELETE http://localhost:3000/api/observed-ports/8123 | jq .
```

### 4. Debugging Checklist & Helpful Terminal Commands

#### Test Subnet Discovery via CLI
```bash
# Trigger an instant discovery sweep
curl -X POST http://localhost:3000/api/discovery/scan \
  -H "Content-Type: application/json" \
  -d '{"durationSeconds": 0}'

# Trigger a 15-second timed discovery window
curl -X POST http://localhost:3000/api/discovery/scan \
  -H "Content-Type: application/json" \
  -d '{"durationSeconds": 15}'
```

#### Inspecting WebSocket Telemetry
Open your browser's Developer Tools (`F12` or `Cmd+Option+I`):
1. Go to the **Network** tab and filter by **WS** (WebSockets).
2. Select the `/ws` connection and click the **Messages** tab.
3. Observe incoming JSON frames: `system.status`, `devices.updated`, `topology.updated`, and `event.created`.

#### Troubleshooting Empty ARP Tables on macOS / Linux
On freshly booted machines, operating systems only store ARP entries for hosts they have communicated with recently. If a subnet scan discovers 0 or few devices:
```bash
# Send a broadcast ping to populate the local ARP neighbor cache:
ping -c 3 255.255.255.255
# (Or on a 192.168.1.0/24 subnet: ping -c 3 192.168.1.255)

# Then inspect your OS neighbor table directly:
# On macOS:
arp -an
# On Linux:
cat /proc/net/arp
```
Once ARP entries exist, click **Scan Subnet** in Network Sentinel to catalog all devices immediately.

#### Reset Database & State Programmatically
```bash
curl -X POST http://localhost:3000/api/security-lab/reset
```

---

## Data Storage & Privacy

- **Local Storage Engine**: Stored in `data/store.json`.
- **Zero Cloud Leakage**: No packet payloads, MAC addresses, or subnet IPs leave your machine.
- **Exporting Audits**: Click **Export Database (JSON)** in Settings at any time to generate an offline, timestamped compliance audit log.

---

## Build & Development Commands

Network Sentinel supports **pnpm** (preferred for deterministic, secure, non-flat module isolation) and **npm**:

```bash
# Install dependencies
pnpm install          # or: npm install

# Run backend and frontend in development mode
pnpm dev              # or: npm run dev

# Run TypeScript typecheck / linter
pnpm run lint         # or: npm run lint

# Compile frontend and bundle backend for production
pnpm build            # or: npm run build

# Start the compiled production server
pnpm start            # or: npm start

# Clean build artifacts
pnpm run clean        # or: npm run clean
```

---

## Frequently Asked Questions (FAQ)

#### Q: Is the app scanning my real internet right now in AI Studio?
**A**: No. In the cloud container environment, the browser and server are sandboxed. The application runs the **Security Lab Demo Driver** to provide realistic network simulation. To monitor your actual network, export the project to a physical machine connected to your local network.

#### Q: What happens when a device changes its IP address?
**A**: Network Sentinel tracks devices by their hardware MAC address and lease history. When a device acquires a new IP from DHCP, the identity record remains intact, and an informational `ip_changed` event is logged without losing the device's trust status or risk history.

#### Q: What does "Quarantine" actually do?
**A**: In Demo/Sandbox mode, quarantine executes a simulated ACL isolation policy, updating the node's status, applying a high risk rating, rendering dashed lines on the topology map, and recording an audit trail. On bare metal Linux deployments, this adapter can be connected to `iptables`, `nftables`, or router API webhooks.

#### Q: How can I tune false positive alerts?
**A**: 
1. Run **Baseline Learning Mode** so Sentinel can learn typical device traffic patterns.
2. Mark verified devices as **Known / Trusted** to apply the `-20 pt` trust deduction.
3. Adjust point weights in **Settings > Detection Engine Scoring Weights** to fit your network's specific profile.

#### Q: Why did pnpm report `[ERR_PNPM_IGNORED_BUILDS]` during installation?
**A**: In pnpm v10 and v11, lifecycle scripts (`postinstall`, `preinstall`) from packages like `esbuild` are ignored by default for supply-chain security. The repository includes a `pnpm-workspace.yaml` with pre-approved builds. If you ever update dependencies or see this error, run:
```bash
pnpm approve-builds --all
```
and re-run `pnpm dev`.
