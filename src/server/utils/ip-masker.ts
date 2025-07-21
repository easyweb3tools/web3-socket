/**
 * IP address masking utility
 * This utility provides functions to mask IP addresses for privacy protection
 */

/**
 * Mask an IPv4 address by replacing the last octet with 'x'
 * Example: 192.168.1.123 -> 192.168.1.x
 */
export function maskIPv4(ip: string): string {
    if (!ip || typeof ip !== 'string') {
        return ip;
    }

    // Check if it's a valid IPv4 address
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Regex);

    if (match) {
        return `${match[1]}.${match[2]}.${match[3]}.x`;
    }

    return ip;
}

/**
 * Mask an IPv6 address by replacing the last 4 segments with 'xxxx'
 * Example: 2001:0db8:85a3:0000:0000:8a2e:0370:7334 -> 2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx
 */
export function maskIPv6(ip: string): string {
    if (!ip || typeof ip !== 'string') {
        return ip;
    }

    // Check if it's a valid IPv6 address
    const ipv6Regex = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;

    if (ipv6Regex.test(ip)) {
        const segments = ip.split(':');
        const maskedSegments = [
            ...segments.slice(0, 4),
            'xxxx',
            'xxxx',
            'xxxx',
            'xxxx'
        ];
        return maskedSegments.join(':');
    }

    // Handle compressed IPv6 addresses
    const compressedIPv6Regex = /^([0-9a-f]{1,4}:){0,6}(:[0-9a-f]{1,4}){0,6}$/i;
    if (compressedIPv6Regex.test(ip)) {
        // For compressed addresses, just mask half of the address
        const parts = ip.split('::');
        if (parts.length === 2) {
            const leftPart = parts[0].split(':');
            const rightPart = parts[1].split(':');

            // Keep half of the address visible
            const visibleCount = Math.floor((leftPart.length + rightPart.length) / 2);
            const maskedLeftPart = leftPart.slice(0, Math.min(visibleCount, leftPart.length));

            return maskedLeftPart.join(':') + '::xxxx:xxxx';
        }
    }

    return ip;
}

/**
 * Mask any IP address (IPv4 or IPv6)
 */
export function maskIP(ip: string): string {
    if (!ip || typeof ip !== 'string') {
        return ip;
    }

    // Check if it's an IPv4 address
    if (ip.includes('.')) {
        return maskIPv4(ip);
    }

    // Otherwise assume it's an IPv6 address
    return maskIPv6(ip);
}

/**
 * Mask IP addresses in an object
 */
export function maskIPsInObject(obj: any, ipKeys: string[] = ['ip', 'ipAddress', 'address', 'remoteAddress']): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in result) {
        if (typeof result[key] === 'object' && result[key] !== null) {
            // Recursively process nested objects
            result[key] = maskIPsInObject(result[key], ipKeys);
        } else if (
            typeof result[key] === 'string' &&
            ipKeys.some(ipKey => key.toLowerCase().includes(ipKey.toLowerCase()))
        ) {
            // Mask IP addresses in fields with IP-related names
            result[key] = maskIP(result[key]);
        }
    }

    return result;
}