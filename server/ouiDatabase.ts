/**
 * Comprehensive IEEE OUI Hardware Vendor Database and Device Classifier
 * Provides extensive hardware identification, private/randomized MAC detection,
 * and hardware archetype classification.
 */

// Comprehensive dictionary of major hardware vendor prefixes
const VENDOR_PREFIX_MAP: Record<string, string> = {
  // --- Apple, Inc. (macOS, iOS, iPadOS, watchOS, tvOS, audioOS) ---
  '00:03:93': 'Apple, Inc.',
  '00:05:02': 'Apple, Inc.',
  '00:0a:27': 'Apple, Inc.',
  '00:0a:95': 'Apple, Inc.',
  '00:0d:93': 'Apple, Inc.',
  '00:10:fa': 'Apple, Inc.',
  '00:11:24': 'Apple, Inc.',
  '00:14:51': 'Apple, Inc.',
  '00:16:cb': 'Apple, Inc.',
  '00:17:f2': 'Apple, Inc.',
  '00:19:e3': 'Apple, Inc.',
  '00:1b:63': 'Apple, Inc.',
  '00:1c:b3': 'Apple, Inc.',
  '00:1d:4f': 'Apple, Inc.',
  '00:1e:52': 'Apple, Inc.',
  '00:1e:c2': 'Apple, Inc.',
  '00:21:e9': 'Apple, Inc.',
  '00:22:41': 'Apple, Inc.',
  '00:23:12': 'Apple, Inc.',
  '00:23:32': 'Apple, Inc.',
  '00:23:6c': 'Apple, Inc.',
  '00:24:36': 'Apple, Inc.',
  '00:25:00': 'Apple, Inc.',
  '00:25:4b': 'Apple, Inc.',
  '00:25:bc': 'Apple, Inc.',
  '00:26:08': 'Apple, Inc.',
  '00:26:4a': 'Apple, Inc.',
  '00:26:b0': 'Apple, Inc.',
  '00:26:bb': 'Apple, Inc.',
  '00:3e:e1': 'Apple, Inc.',
  '00:56:cd': 'Apple, Inc.',
  '00:61:71': 'Apple, Inc.',
  '00:6d:52': 'Apple, Inc.',
  '00:88:65': 'Apple, Inc.',
  '00:cd:fe': 'Apple, Inc.',
  '00:f4:b9': 'Apple, Inc.',
  '04:0c:ce': 'Apple, Inc.',
  '04:15:52': 'Apple, Inc.',
  '04:26:65': 'Apple, Inc.',
  '04:54:53': 'Apple, Inc.',
  '04:db:56': 'Apple, Inc.',
  '04:e5:36': 'Apple, Inc.',
  '08:66:98': 'Apple, Inc.',
  '08:70:45': 'Apple, Inc.',
  '08:74:02': 'Apple, Inc.',
  '08:e6:89': 'Apple, Inc.',
  '0c:4d:e9': 'Apple, Inc.',
  '0c:bc:9f': 'Apple, Inc.',
  '10:1c:0c': 'Apple, Inc.',
  '10:40:f3': 'Apple, Inc.',
  '10:93:e9': 'Apple, Inc.',
  '10:94:bb': 'Apple, Inc.',
  '10:dd:b1': 'Apple, Inc.',
  '14:10:9f': 'Apple, Inc.',
  '14:20:5e': 'Apple, Inc.',
  '14:7d:da': 'Apple, Inc.',
  '18:af:61': 'Apple, Inc.',
  '18:e7:28': 'Apple, Inc.',
  '18:ee:69': 'Apple, Inc.',
  '1c:1a:c0': 'Apple, Inc.',
  '1c:5c:f2': 'Apple, Inc.',
  '1c:9e:46': 'Apple, Inc.',
  '20:7d:74': 'Apple, Inc.',
  '20:a2:e4': 'Apple, Inc.',
  '20:ee:28': 'Apple, Inc.',
  '24:a0:74': 'Apple, Inc.',
  '24:f0:94': 'Apple, Inc.',
  '28:0b:5c': 'Apple, Inc.',
  '28:6a:ba': 'Apple, Inc.',
  '28:cf:da': 'Apple, Inc.',
  '28:e0:2c': 'Apple, Inc.',
  '28:e7:cf': 'Apple, Inc.',
  '28:ed:6a': 'Apple, Inc.',
  '34:36:3b': 'Apple, Inc.',
  '38:ca:84': 'Apple, Inc.',
  '3c:07:54': 'Apple, Inc.',
  '3c:15:c2': 'Apple, Inc.',
  '3c:22:fb': 'Apple, Inc.',
  '40:30:04': 'Apple, Inc.',
  '40:6c:8f': 'Apple, Inc.',
  '40:a6:d9': 'Apple, Inc.',
  '44:00:10': 'Apple, Inc.',
  '44:2a:60': 'Apple, Inc.',
  '44:4c:0c': 'Apple, Inc.',
  '44:fb:42': 'Apple, Inc.',
  '48:60:5f': 'Apple, Inc.',
  '48:74:6e': 'Apple, Inc.',
  '48:d7:05': 'Apple, Inc.',
  '4c:32:75': 'Apple, Inc.',
  '50:ed:3c': 'Apple, Inc.',
  '54:26:96': 'Apple, Inc.',
  '58:55:ca': 'Apple, Inc.',
  '5c:96:9d': 'Apple, Inc.',
  '60:03:08': 'Apple, Inc.',
  '60:30:d4': 'Apple, Inc.',
  '60:c5:47': 'Apple, Inc.',
  '64:a5:c3': 'Apple, Inc.',
  '68:fe:f7': 'Apple, Inc.',
  '70:56:81': 'Apple, Inc.',
  '70:ef:00': 'Apple, Inc.',
  '74:8d:08': 'Apple, Inc.',
  '78:4f:43': 'Apple, Inc.',
  '7c:50:49': 'Apple, Inc.',
  '80:e6:50': 'Apple, Inc.',
  '84:8e:df': 'Apple, Inc.',
  '88:66:5a': 'Apple, Inc.',
  '8c:85:90': 'Apple, Inc.',
  '90:27:e4': 'Apple, Inc.',
  '98:01:a7': 'Apple, Inc.',
  '98:10:e8': 'Apple, Inc.',
  '98:e0:d9': 'Apple, Inc.',
  '9c:20:7b': 'Apple, Inc.',
  'a4:83:e7': 'Apple, Inc.',
  'a4:c3:61': 'Apple, Inc.',
  'a8:66:7f': 'Apple, Inc.',
  'ac:bc:32': 'Apple, Inc.',
  'b0:34:95': 'Apple, Inc.',
  'b8:e8:56': 'Apple, Inc.',
  'bc:d0:74': 'Apple, Inc.',
  'c0:b6:58': 'Apple, Inc.',
  'c8:2a:14': 'Apple, Inc.',
  'cc:08:8d': 'Apple, Inc.',
  'd0:03:4b': 'Apple, Inc.',
  'd4:61:9d': 'Apple, Inc.',
  'd8:9e:3f': 'Apple, Inc.',
  'dc:2b:61': 'Apple, Inc.',
  'e0:66:78': 'Apple, Inc.',
  'e4:ce:8f': 'Apple, Inc.',
  'f0:18:98': 'Apple, Inc.',
  'f4:0f:24': 'Apple, Inc.',
  'f4:5c:89': 'Apple, Inc.',
  'f8:ff:c2': 'Apple, Inc.',

  // --- Google LLC (Pixel, Nest, Chromecast, Home) ---
  '18:b4:30': 'Nest Labs (Google)',
  'f4:f5:e8': 'Google LLC',
  'd8:6c:63': 'Google LLC',
  '3c:5a:37': 'Google LLC',
  '54:60:09': 'Google LLC',
  '70:3e:ac': 'Google LLC',
  '94:eb:2c': 'Google LLC',
  'a4:77:33': 'Google LLC',
  'e4:f0:42': 'Google LLC',
  '20:df:b9': 'Google LLC',
  '48:d6:d5': 'Google LLC',
  '6c:ad:f8': 'Google LLC',

  // --- Samsung Electronics (Galaxy Smartphones, Tablets, Smart TVs) ---
  '00:12:47': 'Samsung Electronics',
  '00:15:99': 'Samsung Electronics',
  '00:16:6c': 'Samsung Electronics',
  '00:24:54': 'Samsung Electronics',
  '00:26:37': 'Samsung Electronics',
  '08:fc:88': 'Samsung Electronics',
  '14:bb:6e': 'Samsung Electronics',
  '18:3a:2d': 'Samsung Electronics',
  '24:4b:fe': 'Samsung Electronics',
  '34:23:ba': 'Samsung Electronics',
  '44:4e:1a': 'Samsung Electronics',
  '4c:bc:a5': 'Samsung Electronics',
  '50:56:bf': 'Samsung Electronics',
  '50:85:69': 'Samsung Electronics',
  '5c:f6:dc': 'Samsung Electronics',
  '64:b5:c6': 'Samsung Electronics',
  '68:05:71': 'Samsung Electronics',
  '78:47:1d': 'Samsung Electronics',
  '84:25:19': 'Samsung Electronics',
  '94:63:72': 'Samsung Electronics',
  'a0:0b:ba': 'Samsung Electronics',
  'ac:5f:3e': 'Samsung Electronics',
  'b0:ec:71': 'Samsung Electronics',
  'bc:85:56': 'Samsung Electronics',
  'c0:bd:d1': 'Samsung Electronics',
  'cc:07:ab': 'Samsung Electronics',
  'd0:59:99': 'Samsung Electronics',
  'e8:50:8b': 'Samsung Electronics',
  'f4:7b:5e': 'Samsung Electronics',

  // --- Microsoft Corporation (Surface, Xbox, Hyper-V) ---
  '00:15:5d': 'Microsoft Corporation (Hyper-V)',
  '00:0d:3a': 'Microsoft Corporation',
  '00:50:f2': 'Microsoft Corporation',
  '28:18:78': 'Microsoft Corporation (Surface)',
  '30:59:b7': 'Microsoft Corporation (Xbox)',
  '48:59:29': 'Microsoft Corporation',
  '60:45:bd': 'Microsoft Corporation (Xbox)',
  '7c:1e:52': 'Microsoft Corporation (Xbox)',
  '7c:ed:8d': 'Microsoft Corporation',
  '98:5f:d3': 'Microsoft Corporation (Surface)',
  'dc:b4:c4': 'Microsoft Corporation (Surface)',
  'e0:d5:5e': 'Microsoft Corporation',
  'f8:66:f2': 'Microsoft Corporation',

  // --- Amazon Technologies (Fire TV, Echo, Kindle, Ring, Blink) ---
  '00:fc:8b': 'Amazon Technologies Inc.',
  '0c:47:c9': 'Amazon Technologies Inc. (Fire TV)',
  '18:74:2e': 'Amazon Technologies Inc. (Echo)',
  '24:46:c8': 'Amazon Technologies Inc.',
  '34:d2:70': 'Amazon Technologies Inc. (Echo)',
  '3c:5c:c4': 'Amazon Technologies Inc.',
  '40:b4:cd': 'Amazon Technologies Inc. (Fire TV)',
  '44:65:0d': 'Amazon Technologies Inc. (Echo)',
  '50:dc:e7': 'Amazon Technologies Inc.',
  '68:37:e9': 'Amazon Technologies Inc. (Fire TV)',
  '68:54:5a': 'Amazon Technologies Inc.',
  '74:75:48': 'Amazon Technologies Inc. (Echo)',
  '74:c2:46': 'Amazon Technologies Inc.',
  '84:d6:d0': 'Amazon Technologies Inc.',
  'ac:63:be': 'Amazon Technologies Inc.',
  'b4:7c:9c': 'Amazon Technologies Inc. (Ring)',
  'cc:f4:11': 'Amazon Technologies Inc.',
  'fc:65:de': 'Amazon Technologies Inc. (Echo)',

  // --- Sony Interactive Entertainment / Sony Corporation (PlayStation, Bravia) ---
  '00:04:1f': 'Sony Corporation',
  '00:13:15': 'Sony Corporation',
  '00:19:c5': 'Sony Interactive (PlayStation 3)',
  '00:1d:0d': 'Sony Interactive (PlayStation 3)',
  '00:d9:d1': 'Sony Interactive (PlayStation 4)',
  '04:76:6e': 'Sony Corporation',
  '28:0d:fc': 'Sony Interactive (PlayStation 4)',
  '70:9e:29': 'Sony Interactive (PlayStation 5)',
  '78:c8:81': 'Sony Interactive (PlayStation 5)',
  'a8:e3:ee': 'Sony Corporation (Bravia TV)',
  'bc:60:a7': 'Sony Interactive (PlayStation 4)',
  'f8:46:1c': 'Sony Corporation (Bravia TV)',
  'fc:0f:e6': 'Sony Interactive (PlayStation 4)',

  // --- Nintendo Co., Ltd. (Switch, Wii U) ---
  '00:09:bf': 'Nintendo Co., Ltd.',
  '00:1f:32': 'Nintendo Co., Ltd.',
  '34:af:2c': 'Nintendo Co., Ltd. (Switch)',
  '70:48:0f': 'Nintendo Co., Ltd. (Switch)',
  '98:b6:e9': 'Nintendo Co., Ltd. (Switch)',
  'b8:78:26': 'Nintendo Co., Ltd. (Switch)',
  'e0:e7:51': 'Nintendo Co., Ltd. (Switch)',

  // --- Roku, Inc. (Streaming Stick, Roku TV, Express) ---
  '00:0d:4b': 'Roku, Inc.',
  '08:05:81': 'Roku, Inc.',
  '24:92:0e': 'Roku, Inc.',
  '84:ea:99': 'Roku, Inc.',
  'ac:ae:19': 'Roku, Inc.',
  'b0:a7:37': 'Roku, Inc.',
  'cc:6d:a0': 'Roku, Inc.',
  'd4:8a:3f': 'Roku, Inc.',

  // --- LG Electronics (webOS Smart TV, Smart ThinQ Appliances) ---
  '00:1c:62': 'LG Electronics (webOS TV)',
  '00:1f:6b': 'LG Electronics',
  '10:f9:6f': 'LG Electronics (webOS TV)',
  '14:c9:13': 'LG Electronics',
  '20:3d:b2': 'LG Electronics (webOS TV)',
  '58:fc:db': 'LG Electronics (webOS TV)',
  '74:40:be': 'LG Electronics',
  'a8:23:fe': 'LG Electronics (webOS TV)',
  'c4:36:6c': 'LG Electronics (webOS TV)',

  // --- Android OEMs (Xiaomi, Huawei, OnePlus, Motorola) ---
  '14:f6:5a': 'Xiaomi Communications',
  '28:6c:07': 'Xiaomi Communications',
  '50:8f:4c': 'Xiaomi Communications',
  '64:09:80': 'Xiaomi Communications',
  '74:51:ba': 'Xiaomi Communications',
  '78:11:dc': 'Xiaomi Communications',
  '88:c3:97': 'Xiaomi Communications',
  '98:fa:e3': 'Xiaomi Communications',
  '00:1e:10': 'Huawei Technologies',
  '04:25:c5': 'Huawei Technologies',
  '24:df:6a': 'Huawei Technologies',
  '48:46:fb': 'Huawei Technologies',
  '70:89:cc': 'Huawei Technologies',
  '88:cf:98': 'OnePlus Technology',
  'c0:ee:fb': 'OnePlus Technology',
  '3c:28:6d': 'Motorola Mobility LLC',
  'e4:90:7e': 'Motorola Mobility LLC',

  // --- Smart Home / IoT (Espressif, Tuya, Sonos, Philips Hue) ---
  '18:fe:34': 'Espressif Inc. (ESP8266/ESP32)',
  '24:0a:c4': 'Espressif Inc. (ESP8266/ESP32)',
  '24:62:ab': 'Espressif Inc. (ESP8266/ESP32)',
  '24:6f:28': 'Espressif Inc. (ESP8266/ESP32)',
  '24:a1:60': 'Espressif Inc. (ESP8266/ESP32)',
  '24:d7:eb': 'Espressif Inc. (ESP8266/ESP32)',
  '2c:3a:e8': 'Espressif Inc. (ESP8266/ESP32)',
  '30:ae:a4': 'Espressif Inc. (ESP8266/ESP32)',
  '3c:61:05': 'Espressif Inc. (ESP8266/ESP32)',
  '3c:71:bf': 'Espressif Inc. (ESP8266/ESP32)',
  '48:3f:da': 'Espressif Inc. (ESP8266/ESP32)',
  '48:55:19': 'Espressif Inc. (ESP8266/ESP32)',
  '4c:11:ae': 'Espressif Inc. (ESP8266/ESP32)',
  '50:02:91': 'Espressif Inc. (ESP8266/ESP32)',
  '54:5a:a6': 'Espressif Inc. (ESP8266/ESP32)',
  '5c:cf:7f': 'Espressif Inc. (ESP8266/ESP32)',
  '60:01:94': 'Espressif Inc. (ESP8266/ESP32)',
  '68:c6:3a': 'Espressif Inc. (ESP8266/ESP32)',
  '70:03:9f': 'Espressif Inc. (ESP8266/ESP32)',
  '78:e3:6d': 'Espressif Inc. (ESP8266/ESP32)',
  '80:7d:3a': 'Espressif Inc. (ESP8266/ESP32)',
  '84:0d:8e': 'Espressif Inc. (ESP8266/ESP32)',
  '84:f3:eb': 'Espressif Inc. (ESP8266/ESP32)',
  '8c:4b:14': 'Espressif Inc. (ESP8266/ESP32)',
  '8c:aa:b5': 'Espressif Inc. (ESP8266/ESP32)',
  '90:97:d5': 'Espressif Inc. (ESP8266/ESP32)',
  '94:b5:55': 'Espressif Inc. (ESP8266/ESP32)',
  '94:b9:7e': 'Espressif Inc. (ESP8266/ESP32)',
  '98:f4:ab': 'Espressif Inc. (ESP8266/ESP32)',
  'a0:20:a6': 'Espressif Inc. (ESP8266/ESP32)',
  'a4:cf:12': 'Espressif Inc. (ESP8266/ESP32)',
  'a4:e5:7c': 'Espressif Inc. (ESP8266/ESP32)',
  'ac:d0:74': 'Espressif Inc. (ESP8266/ESP32)',
  'b4:e6:2d': 'Espressif Inc. (ESP8266/ESP32)',
  'bc:dd:c2': 'Espressif Inc. (ESP8266/ESP32)',
  'c4:4f:33': 'Espressif Inc. (ESP8266/ESP32)',
  'c8:2b:96': 'Espressif Inc. (ESP8266/ESP32)',
  'cc:50:e3': 'Espressif Inc. (ESP8266/ESP32)',
  'd4:d4:da': 'Espressif Inc. (ESP8266/ESP32)',
  'd8:a0:1d': 'Espressif Inc. (ESP8266/ESP32)',
  'dc:4f:22': 'Espressif Inc. (ESP8266/ESP32)',
  'e0:98:06': 'Espressif Inc. (ESP8266/ESP32)',
  'e8:31:cd': 'Espressif Inc. (ESP8266/ESP32)',
  'ec:fa:bc': 'Espressif Inc. (ESP8266/ESP32)',
  '00:0e:58': 'Sonos, Inc.',
  '48:a6:b8': 'Sonos, Inc.',
  '5c:aa:fd': 'Sonos, Inc.',
  '78:28:ca': 'Sonos, Inc.',
  '94:9f:3e': 'Sonos, Inc.',
  'b8:e9:37': 'Sonos, Inc.',
  '00:17:88': 'Philips Lighting (Hue Bridge)',
  'ec:b5:fa': 'Philips Lighting (Hue Bridge)',
  '10:d5:61': 'Tuya Smart Inc.',
  '70:8e:64': 'Tuya Smart Inc.',
  'd8:1f:12': 'Tuya Smart Inc.',
  '60:a4:23': 'Sonoff / ITEAD IoT',

  // --- Network Routers, Gateways & APs (TP-Link, Netgear, Ubiquiti, MikroTik, Cisco) ---
  '50:c7:bf': 'TP-Link Corporation',
  'e8:48:b8': 'TP-Link Corporation',
  '14:cc:20': 'TP-Link Corporation',
  '30:b5:c2': 'TP-Link Corporation',
  '60:32:b1': 'TP-Link Corporation',
  '70:4f:57': 'TP-Link Corporation',
  '98:48:27': 'TP-Link Corporation',
  'ac:84:c6': 'TP-Link Corporation',
  'c0:06:c3': 'TP-Link Corporation',
  'c0:4a:00': 'TP-Link Corporation',
  'ec:08:6b': 'TP-Link Corporation',
  '00:09:5b': 'Netgear Inc.',
  '20:e5:2a': 'Netgear Inc.',
  '28:80:88': 'Netgear Inc.',
  '44:94:fc': 'Netgear Inc.',
  '84:1b:5e': 'Netgear Inc.',
  '9c:3d:cf': 'Netgear Inc.',
  'a0:04:60': 'Netgear Inc.',
  'b0:7f:b9': 'Netgear Inc.',
  'c0:ff:d4': 'Netgear Inc.',
  '00:14:bf': 'Linksys',
  'c4:41:1e': 'Linksys',
  '14:91:82': 'Linksys',
  'fc:99:47': 'Ubiquiti Networks (UniFi)',
  '74:83:c2': 'Ubiquiti Networks (UniFi)',
  '04:18:d6': 'Ubiquiti Networks (UniFi)',
  '24:a4:3c': 'Ubiquiti Networks (UniFi)',
  '68:d7:9a': 'Ubiquiti Networks (UniFi)',
  '78:8a:20': 'Ubiquiti Networks (UniFi)',
  '80:2a:a8': 'Ubiquiti Networks (UniFi)',
  'ac:8b:a9': 'Ubiquiti Networks (UniFi)',
  'b4:fb:e4': 'Ubiquiti Networks (UniFi)',
  'f0:9f:c2': 'Ubiquiti Networks (UniFi)',
  'd4:ca:6d': 'MikroTik RouterOS',
  '48:8f:5a': 'MikroTik RouterOS',
  '64:d1:54': 'MikroTik RouterOS',
  '00:0c:42': 'MikroTik RouterOS',
  '18:fd:74': 'MikroTik RouterOS',
  '2c:c8:1b': 'MikroTik RouterOS',
  '74:4d:28': 'MikroTik RouterOS',
  'cc:2d:e0': 'MikroTik RouterOS',
  '00:00:0c': 'Cisco Systems',
  '00:01:42': 'Cisco Systems',
  '00:1b:54': 'Cisco Systems',
  '00:26:0b': 'Cisco Systems',
  '58:97:bd': 'Cisco Systems',
  '00:1d:7e': 'Cisco Meraki',
  '0c:8d:db': 'Cisco Meraki',
  'e0:55:3d': 'Cisco Meraki',
  '00:04:5a': 'AVM Fritz!Box',
  '34:31:c4': 'AVM Fritz!Box',
  'bc:05:43': 'AVM Fritz!Box',
  'c8:0e:14': 'AVM Fritz!Box',

  // --- Raspberry Pi Foundation & Linux SBCs ---
  'b8:27:eb': 'Raspberry Pi Foundation',
  'dc:a6:32': 'Raspberry Pi Trading Ltd',
  'e4:5f:01': 'Raspberry Pi Trading Ltd',
  '28:cd:c1': 'Raspberry Pi Trading Ltd',
  'd8:3a:dd': 'Raspberry Pi Trading Ltd',
  '2c:cf:67': 'Raspberry Pi Trading Ltd',

  // --- Network Storage (Synology, QNAP, Buffalo, TrueNAS) ---
  '00:11:32': 'Synology Inc.',
  '00:08:9b': 'QNAP Systems Inc.',
  '24:5e:be': 'QNAP Systems Inc.',
  '00:07:e9': 'Buffalo Technology',

  // --- Printers & Multifunction Copiers ---
  '00:1e:c9': 'Brother Industries Ltd.',
  '30:05:5c': 'Brother Industries Ltd.',
  '00:00:85': 'Canon Inc.',
  '00:1e:8f': 'Canon Inc.',
  '70:85:c2': 'Canon Inc.',
  '00:00:48': 'Seiko Epson Corporation',
  '00:26:ab': 'Seiko Epson Corporation',
  'ac:17:02': 'Seiko Epson Corporation',
  '00:00:aa': 'Xerox Corporation',
  '00:20:6b': 'Konica Minolta Inc.',

  // --- PC Motherboards & Complete Systems (Dell, HP, Lenovo, ASUS, Acer) ---
  '00:14:22': 'Dell Inc.',
  '00:18:8b': 'Dell Inc.',
  '00:1a:a0': 'Dell Inc.',
  '00:21:70': 'Dell Inc.',
  '18:03:73': 'Dell Inc.',
  '24:b6:fd': 'Dell Inc.',
  '34:17:eb': 'Dell Inc.',
  '44:a8:42': 'Dell Inc.',
  '54:bf:64': 'Dell Inc.',
  '74:86:7a': 'Dell Inc.',
  '90:b1:1c': 'Dell Inc.',
  'b8:ac:6f': 'Dell Inc.',
  'd4:be:d9': 'Dell Inc.',
  'e4:54:e8': 'Dell Inc.',
  'ec:f4:bb': 'Dell Inc.',
  '00:17:a4': 'Hewlett-Packard Company',
  '00:1e:0b': 'Hewlett-Packard Company',
  '00:24:81': 'Hewlett-Packard Company',
  '10:60:4b': 'Hewlett-Packard Company',
  '2c:59:e5': 'Hewlett-Packard Company',
  '3c:d9:2b': 'Hewlett-Packard Company',
  '50:65:f3': 'Hewlett-Packard Company',
  '70:5a:0f': 'Hewlett-Packard Company',
  '9c:b6:54': 'Hewlett-Packard Company',
  'b4:99:ba': 'Hewlett-Packard Company',
  'cc:3d:82': 'Hewlett-Packard Company',
  'd8:9d:67': 'Hewlett-Packard Company',
  '00:21:cc': 'Lenovo Mobile',
  '00:23:7d': 'Lenovo',
  '00:26:22': 'Lenovo',
  '08:11:96': 'Lenovo',
  '28:d0:ea': 'Lenovo',
  '3c:97:0e': 'Lenovo',
  '54:ee:75': 'Lenovo',
  '70:72:0d': 'Lenovo',
  '84:7b:eb': 'Lenovo',
  'a4:bb:6d': 'Lenovo',
  'ec:71:db': 'Lenovo',
  '00:15:f2': 'ASUSTeK Computer Inc.',
  '04:d9:f5': 'ASUSTeK Computer Inc.',
  '08:60:6e': 'ASUSTeK Computer Inc.',
  '10:bf:48': 'ASUSTeK Computer Inc.',
  '2c:fd:ab': 'ASUSTeK Computer Inc.',
  '40:16:7e': 'ASUSTeK Computer Inc.',
  '50:46:5d': 'ASUSTeK Computer Inc.',
  '90:e6:ba': 'ASUSTeK Computer Inc.',
  'ac:22:0b': 'ASUSTeK Computer Inc.',
  '00:01:24': 'Acer Incorporated',
  '00:60:67': 'Acer Incorporated',
  '00:a0:60': 'Acer Incorporated',
  '04:7d:7b': 'Acer Incorporated',
  '50:2b:73': 'Acer Incorporated',
  '84:3a:4b': 'Acer Incorporated',
  'c0:98:79': 'Acer Incorporated',

  // --- Network Chipsets (Intel, Realtek, Broadcom, MediaTek, Qualcomm) ---
  // NOTE: These are network adapter chipsets found in BOTH Linux and Windows!
  '00:1b:21': 'Intel Corporation (NIC)',
  '00:1e:67': 'Intel Corporation (NIC)',
  '00:21:6a': 'Intel Corporation (NIC)',
  '00:23:14': 'Intel Corporation (NIC)',
  '34:13:e8': 'Intel Corporation (NIC)',
  '3c:f0:11': 'Intel Corporation (NIC)',
  '48:51:b7': 'Intel Corporation (NIC)',
  '4c:79:6e': 'Intel Corporation (NIC)',
  '50:7b:9d': 'Intel Corporation (NIC)',
  '58:91:cf': 'Intel Corporation (NIC)',
  '68:05:ca': 'Intel Corporation (NIC)',
  '7c:b2:7d': 'Intel Corporation (NIC)',
  '80:86:f2': 'Intel Corporation (NIC)',
  '8c:8d:28': 'Intel Corporation (NIC)',
  'a4:4e:31': 'Intel Corporation (NIC)',
  'c8:5b:76': 'Intel Corporation (NIC)',
  'e4:aa:ea': 'Intel Corporation (NIC)',
  '00:e0:4c': 'Realtek Semiconductor (NIC)',
  '00:18:e7': 'Realtek Semiconductor (NIC)',
  '40:8d:5c': 'Realtek Semiconductor (NIC)',
  '70:4d:7b': 'Realtek Semiconductor (NIC)',
  'b4:b5:2f': 'Realtek Semiconductor (NIC)',
  '00:10:18': 'Broadcom Corporation',
  '00:0a:f7': 'Broadcom Corporation',

  // --- Virtualization & Containers (VMware, VirtualBox, QEMU, Docker) ---
  '00:05:69': 'VMware, Inc.',
  '00:0c:29': 'VMware, Inc.',
  '00:50:56': 'VMware, Inc.',
  '08:00:27': 'Oracle VirtualBox',
  '52:54:00': 'QEMU / KVM Virtual NIC',
  '02:42:ac': 'Docker Container Engine',
};

/**
 * Checks if the MAC address has the IEEE 802 Locally Administered Address (LAA) bit set.
 * In modern mobile operating systems (iOS 14+, Android 10+) and modern Windows/macOS,
 * Wi-Fi address randomization sets bit 1 of byte 0 to 1 (i.e. second character is 2, 6, A, or E).
 */
export function isRandomizedMac(mac: string): boolean {
  if (!mac) return false;
  const clean = mac.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length < 2) return false;
  const firstByte = parseInt(clean.substring(0, 2), 16);
  if (isNaN(firstByte)) return false;
  // Bit 1 is Locally Administered bit (0x02)
  return (firstByte & 0x02) !== 0;
}

/**
 * Normalizes and looks up vendor by MAC address OUI prefix.
 * Gracefully flags Private Wi-Fi Addresses / Randomized MACs when no explicit vendor prefix matches.
 */
export function lookupOuiVendor(mac: string): string | null {
  if (!mac) return null;
  const clean = mac.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length < 6) return null;

  const prefix = `${clean.substring(0, 2)}:${clean.substring(2, 4)}:${clean.substring(4, 6)}`;
  if (VENDOR_PREFIX_MAP[prefix]) {
    return VENDOR_PREFIX_MAP[prefix];
  }

  // Check if it is a modern smartphone / laptop with Private Wi-Fi Addressing enabled
  if (isRandomizedMac(mac)) {
    return 'Private Wi-Fi Address (Randomized MAC)';
  }

  return null;
}

export type HardwareArchetype =
  | 'apple_ecosystem'
  | 'google_ecosystem'
  | 'samsung_device'
  | 'pc_workstation'
  | 'router_infrastructure'
  | 'raspberry_pi_linux'
  | 'smart_tv_streaming'
  | 'iot_embedded'
  | 'printer'
  | 'storage_nas'
  | 'virtual_machine'
  | 'nic_chipset'
  | 'mobile_randomized'
  | 'unknown';

/**
 * Analyzes the vendor string and MAC to return the hardware archetype.
 * NOTE: Network chipsets (Intel/Realtek) are deliberately segregated so they DO NOT
 * trigger false Windows classifications on Linux servers or custom PCs.
 */
export function getHardwareArchetype(vendor: string | null, mac?: string): HardwareArchetype {
  if (mac && isRandomizedMac(mac)) {
    return 'mobile_randomized';
  }

  if (!vendor) return 'unknown';
  const v = vendor.toLowerCase();

  if (v.includes('apple')) return 'apple_ecosystem';
  if (v.includes('google') || v.includes('nest')) return 'google_ecosystem';
  if (v.includes('samsung')) return 'samsung_device';
  if (v.includes('raspberry')) return 'raspberry_pi_linux';
  if (v.includes('synology') || v.includes('qnap') || v.includes('truenas') || v.includes('buffalo')) return 'storage_nas';
  if (
    v.includes('brother') ||
    v.includes('canon') ||
    v.includes('epson') ||
    v.includes('xerox') ||
    v.includes('ricoh') ||
    v.includes('konica')
  ) {
    return 'printer';
  }
  if (
    v.includes('roku') ||
    v.includes('fire tv') ||
    v.includes('bravia') ||
    v.includes('webos') ||
    v.includes('playstation') ||
    v.includes('nintendo') ||
    v.includes('xbox')
  ) {
    return 'smart_tv_streaming';
  }
  if (
    v.includes('espressif') ||
    v.includes('tuya') ||
    v.includes('sonos') ||
    v.includes('philips') ||
    v.includes('hue') ||
    v.includes('sonoff') ||
    v.includes('ring') ||
    v.includes('blink')
  ) {
    return 'iot_embedded';
  }
  if (
    v.includes('mikrotik') ||
    v.includes('cisco') ||
    v.includes('ubiquiti') ||
    v.includes('tp-link') ||
    v.includes('netgear') ||
    v.includes('linksys') ||
    v.includes('fritz!box') ||
    v.includes('meraki')
  ) {
    return 'router_infrastructure';
  }
  if (
    v.includes('vmware') ||
    v.includes('virtualbox') ||
    v.includes('qemu') ||
    v.includes('docker') ||
    v.includes('hyper-v')
  ) {
    return 'virtual_machine';
  }
  if (v.includes('intel') || v.includes('realtek') || v.includes('broadcom') || v.includes('qualcomm') || v.includes('mediatek')) {
    return 'nic_chipset';
  }
  if (
    v.includes('microsoft') ||
    v.includes('dell') ||
    v.includes('lenovo') ||
    v.includes('hewlett-packard') ||
    v.includes('hp') ||
    v.includes('asus') ||
    v.includes('acer')
  ) {
    return 'pc_workstation';
  }

  return 'unknown';
}
