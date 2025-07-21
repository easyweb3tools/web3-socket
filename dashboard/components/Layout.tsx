import React, { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

type LayoutProps = {
    children: ReactNode;
    title?: string;
};

export default function Layout({ children, title = 'Socket Server Dashboard' }: LayoutProps) {
    const router = useRouter();

    const navItems = [
        { href: '/', label: 'Overview' },
        { href: '/connections', label: 'Connections' },
        { href: '/rooms', label: 'Rooms' },
        { href: '/logs', label: 'Logs' },
        { href: '/metrics', label: 'Metrics' },
    ];

    return (
        <div className="min-h-screen bg-gray-100">
            <Head>
                <title>{title}</title>
                <meta name="description" content="Socket Server Dashboard" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <nav className="bg-primary-700 text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <span className="text-xl font-bold">Socket Server</span>
                            </div>
                            <div className="hidden md:block">
                                <div className="ml-10 flex items-baseline space-x-4">
                                    {navItems.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`px-3 py-2 rounded-md text-sm font-medium ${router.pathname === item.href
                                                    ? 'bg-primary-800 text-white'
                                                    : 'text-white hover:bg-primary-600'
                                                }`}
                                        >
                                            {item.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
                </div>
                {children}
            </main>

            <footer className="bg-white shadow-inner py-4 mt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-gray-500 text-sm">
                        Socket Server Dashboard &copy; {new Date().getFullYear()}
                    </p>
                </div>
            </footer>
        </div>
    );
}