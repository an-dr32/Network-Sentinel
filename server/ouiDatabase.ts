/**
 * Comprehensive OUI hardware vendor database and platform classifier
 */
const VENDOR_PREFIX_MAP: Record<string, string> = {
  // Apple Inc.
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
  '3c:22:fb': 'Apple, Inc.',
  'ac:bc:32': 'Apple, Inc.',
  'f0:18:98': 'Apple, Inc.',
  'a4:83:e7': 'Apple, Inc.',
  '40:6c:8f': 'Apple, Inc.',
  '68:fe:f7': 'Apple, Inc.',
  '70:56:81': 'Apple, Inc.',
  '78:4f:43': 'Apple, Inc.',
  '8c:85:90': 'Apple, Inc.',
  '90:27:e4': 'Apple, Inc.',
  'a8:66:7f': 'Apple, Inc.',
  'bc:d0:74': 'Apple, Inc.',
  'c8:2a:14': 'Apple, Inc.',
  'dc:2b:61': 'Apple, Inc.',
  'e4:ce:8f': 'Apple, Inc.',
  'f4:0f:24': 'Apple, Inc.',
  'f8:ff:c2': 'Apple, Inc.',

  // Microsoft Corporation (Surface, Xbox, PC adapters)
  '00:15:5d': 'Microsoft Corporation',
  '00:0d:3a': 'Microsoft Corporation',
  '00:50:f2': 'Microsoft Corporation',
  '28:18:78': 'Microsoft Corporation',
  '30:59:b7': 'Microsoft Corporation',
  '60:45:bd': 'Microsoft Corporation',
  '7c:1e:52': 'Microsoft Corporation',
  '98:5f:d3': 'Microsoft Corporation',
  'dc:b4:c4': 'Microsoft Corporation',
  'e0:d5:5e': 'Microsoft Corporation',
  'f8:66:f2': 'Microsoft Corporation',

  // Intel Corporation (Very common in Windows laptops & desktops)
  '00:1b:21': 'Intel Corporation',
  '00:1e:67': 'Intel Corporation',
  '00:21:6a': 'Intel Corporation',
  '00:23:14': 'Intel Corporation',
  '34:13:e8': 'Intel Corporation',
  '3c:f0:11': 'Intel Corporation',
  '48:51:b7': 'Intel Corporation',
  '4c:79:6e': 'Intel Corporation',
  '50:7b:9d': 'Intel Corporation',
  '58:91:cf': 'Intel Corporation',
  '68:05:ca': 'Intel Corporation',
  '7c:b2:7d': 'Intel Corporation',
  '80:86:f2': 'Intel Corporation',
  '8c:8d:28': 'Intel Corporation',
  'a4:4e:31': 'Intel Corporation',
  'c8:5b:76': 'Intel Corporation',
  'e4:aa:ea': 'Intel Corporation',

  // Realtek Semiconductor (Standard onboard audio/LAN/WLAN in Windows PCs)
  '00:e0:4c': 'Realtek Semiconductor Corp.',
  '52:54:00': 'QEMU / Realtek Virtual NIC',
  '00:18:e7': 'Realtek Semiconductor Corp.',
  '40:8d:5c': 'Realtek Semiconductor Corp.',
  '70:4d:7b': 'Realtek Semiconductor Corp.',
  'b4:b5:2f': 'Realtek Semiconductor Corp.',

  // Dell Inc.
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

  // HP / Hewlett Packard
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

  // Lenovo / ThinkPad
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

  // ASUSTeK Computer Inc.
  '00:15:f2': 'ASUSTeK Computer Inc.',
  '04:d9:f5': 'ASUSTeK Computer Inc.',
  '08:60:6e': 'ASUSTeK Computer Inc.',
  '10:bf:48': 'ASUSTeK Computer Inc.',
  '2c:fd:ab': 'ASUSTeK Computer Inc.',
  '40:16:7e': 'ASUSTeK Computer Inc.',
  '50:46:5d': 'ASUSTeK Computer Inc.',
  '90:e6:ba': 'ASUSTeK Computer Inc.',
  'ac:22:0b': 'ASUSTeK Computer Inc.',

  // Acer Inc.
  '00:01:24': 'Acer Incorporated',
  '00:60:67': 'Acer Incorporated',
  '00:a0:60': 'Acer Incorporated',
  '04:7d:7b': 'Acer Incorporated',
  '50:2b:73': 'Acer Incorporated',
  '84:3a:4b': 'Acer Incorporated',
  'c0:98:79': 'Acer Incorporated',

  // Samsung Electronics
  '00:12:47': 'Samsung Electronics',
  '00:15:99': 'Samsung Electronics',
  '00:16:6c': 'Samsung Electronics',
  '34:23:ba': 'Samsung Electronics',
  '44:4e:1a': 'Samsung Electronics',
  '50:56:bf': 'Samsung Electronics',
  '94:63:72': 'Samsung Electronics',
  'a0:0b:ba': 'Samsung Electronics',

  // Google LLC / Cloud / Nest
  '42:00:4e': 'Google Cloud Platform (Virtual NIC)',
  '42:01:0a': 'Google Cloud Platform (Virtual NIC)',
  '18:b4:30': 'Nest Labs (Google)',
  'f4:f5:e8': 'Google LLC',
  'd8:6c:63': 'Google LLC',
  '3c:5a:37': 'Google LLC',

  // Routers / Networking Infrastructure
  'd4:ca:6d': 'MikroTik',
  '48:8f:5a': 'MikroTik',
  '64:d1:54': 'MikroTik',
  '50:c7:bf': 'TP-Link Corporation',
  'e8:48:b8': 'TP-Link Corporation',
  '00:14:bf': 'Linksys',
  'c4:41:1e': 'Linksys',
  '00:09:5b': 'Netgear Technologies',
  '20:e5:2a': 'Netgear Technologies',
  '00:00:0c': 'Cisco Systems, Inc.',
  '00:01:42': 'Cisco Systems, Inc.',
  'fc:99:47': 'Ubiquiti Networks Inc.',
  '74:83:c2': 'Ubiquiti Networks Inc.',

  // Raspberry Pi & Linux IoT
  'b8:27:eb': 'Raspberry Pi Foundation',
  'dc:a6:32': 'Raspberry Pi Trading Ltd',
  'e4:5f:01': 'Raspberry Pi Trading Ltd',
  '28:cd:c1': 'Raspberry Pi Trading Ltd',
  '00:11:32': 'Synology Incorporated',
  '00:1e:c9': 'Brother Industries, Ltd.',
  '00:0c:29': 'VMware, Inc.',
  '08:00:27': 'Oracle VirtualBox',
  '24:0a:c4': 'Espressif Inc.',
  '30:ae:a4': 'Espressif Inc.',
};

/**
 * Normalizes and looks up vendor by MAC address OUI prefix
 */
export function lookupOuiVendor(mac: string): string | null {
  if (!mac) return null;
  const clean = mac.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length < 6) return null;
  const prefix = `${clean.substring(0, 2)}:${clean.substring(2, 4)}:${clean.substring(4, 6)}`;
  return VENDOR_PREFIX_MAP[prefix] || null;
}

/**
 * Classifies probable ecosystem/platform based on vendor name
 */
export function classifyVendorPlatform(vendor: string): 'apple' | 'windows' | 'linux' | 'router' | 'iot' | 'unknown' {
  if (!vendor) return 'unknown';
  const v = vendor.toLowerCase();
  if (v.includes('apple')) return 'apple';
  if (
    v.includes('microsoft') ||
    v.includes('dell') ||
    v.includes('lenovo') ||
    v.includes('hewlett-packard') ||
    v.includes('hp') ||
    v.includes('asus') ||
    v.includes('acer') ||
    v.includes('intel') ||
    v.includes('realtek')
  ) {
    return 'windows';
  }
  if (v.includes('synology') || v.includes('raspberry') || v.includes('canonical') || v.includes('red hat')) {
    return 'linux';
  }
  if (v.includes('mikrotik') || v.includes('cisco') || v.includes('ubiquiti') || v.includes('tp-link') || v.includes('netgear') || v.includes('linksys')) {
    return 'router';
  }
  if (v.includes('nest') || v.includes('brother') || v.includes('espressif') || v.includes('tuya')) {
    return 'iot';
  }
  return 'unknown';
}
