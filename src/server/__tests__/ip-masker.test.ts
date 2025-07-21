import { maskIP, maskIPv4, maskIPv6, maskIPsInObject } from '../utils/ip-masker';

describe('IP Masker Utility', () => {
    describe('maskIPv4', () => {
        it('should mask the last octet of IPv4 addresses', () => {
            expect(maskIPv4('192.168.1.123')).toBe('192.168.1.x');
            expect(maskIPv4('10.0.0.1')).toBe('10.0.0.x');
            expect(maskIPv4('172.16.254.1')).toBe('172.16.254.x');
        });

        it('should handle invalid or non-IPv4 inputs', () => {
            expect(maskIPv4('')).toBe('');
            expect(maskIPv4('not an ip')).toBe('not an ip');
            expect(maskIPv4('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        });

        it('should handle null or undefined inputs', () => {
            expect(maskIPv4(null as any)).toBe(null);
            expect(maskIPv4(undefined as any)).toBe(undefined);
        });
    });

    describe('maskIPv6', () => {
        it('should mask the last 4 segments of IPv6 addresses', () => {
            expect(maskIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx');
            expect(maskIPv6('fe80:0000:0000:0000:0202:b3ff:fe1e:8329')).toBe('fe80:0000:0000:0000:xxxx:xxxx:xxxx:xxxx');
        });

        it('should handle compressed IPv6 addresses', () => {
            expect(maskIPv6('2001:db8::1')).toBe('2001::xxxx:xxxx');
            expect(maskIPv6('::1')).toBe('::xxxx:xxxx');
        });

        it('should handle invalid or non-IPv6 inputs', () => {
            expect(maskIPv6('')).toBe('');
            expect(maskIPv6('not an ip')).toBe('not an ip');
            expect(maskIPv6('192.168.1.1')).toBe('192.168.1.1');
        });

        it('should handle null or undefined inputs', () => {
            expect(maskIPv6(null as any)).toBe(null);
            expect(maskIPv6(undefined as any)).toBe(undefined);
        });
    });

    describe('maskIP', () => {
        it('should mask IPv4 addresses', () => {
            expect(maskIP('192.168.1.123')).toBe('192.168.1.x');
        });

        it('should mask IPv6 addresses', () => {
            expect(maskIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx');
        });

        it('should handle invalid or non-IP inputs', () => {
            expect(maskIP('')).toBe('');
            expect(maskIP('not an ip')).toBe('not an ip');
        });

        it('should handle null or undefined inputs', () => {
            expect(maskIP(null as any)).toBe(null);
            expect(maskIP(undefined as any)).toBe(undefined);
        });
    });

    describe('maskIPsInObject', () => {
        it('should mask IP addresses in objects', () => {
            const obj = {
                ip: '192.168.1.1',
                name: 'test',
                nested: {
                    ipAddress: '10.0.0.1',
                    data: 'some data'
                },
                remoteAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                ips: ['192.168.1.2', '192.168.1.3']
            };

            const masked = maskIPsInObject(obj);

            expect(masked.ip).toBe('192.168.1.x');
            expect(masked.name).toBe('test');
            expect(masked.nested.ipAddress).toBe('10.0.0.x');
            expect(masked.nested.data).toBe('some data');
            expect(masked.remoteAddress).toBe('2001:0db8:85a3:0000:xxxx:xxxx:xxxx:xxxx');
            expect(masked.ips).toEqual(['192.168.1.2', '192.168.1.3']); // Array of IPs not matched by default
        });

        it('should mask IP addresses with custom key patterns', () => {
            const obj = {
                clientIP: '192.168.1.1',
                serverAddress: '10.0.0.1',
                data: {
                    sourceIP: '172.16.254.1'
                }
            };

            const masked = maskIPsInObject(obj, ['clientIP', 'sourceIP', 'serverAddress']);

            expect(masked.clientIP).toBe('192.168.1.x');
            expect(masked.serverAddress).toBe('10.0.0.x');
            expect(masked.data.sourceIP).toBe('172.16.254.x');
        });

        it('should handle arrays', () => {
            const arr = [
                { ip: '192.168.1.1', name: 'server1' },
                { ip: '192.168.1.2', name: 'server2' }
            ];

            const masked = maskIPsInObject(arr);

            expect(masked[0].ip).toBe('192.168.1.x');
            expect(masked[0].name).toBe('server1');
            expect(masked[1].ip).toBe('192.168.1.x');
            expect(masked[1].name).toBe('server2');
        });

        it('should handle null or undefined inputs', () => {
            expect(maskIPsInObject(null)).toBe(null);
            expect(maskIPsInObject(undefined)).toBe(undefined);
        });

        it('should handle primitive values', () => {
            expect(maskIPsInObject('192.168.1.1')).toBe('192.168.1.1');
            expect(maskIPsInObject(123)).toBe(123);
            expect(maskIPsInObject(true)).toBe(true);
        });
    });
});