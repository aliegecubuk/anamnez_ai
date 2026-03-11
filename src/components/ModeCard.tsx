import React from 'react';
import { Check } from 'lucide-react';

interface ModeCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    features: string[];
    color: 'primary' | 'secondary';
}

export default function ModeCard({ icon, title, description, features, color }: ModeCardProps) {
    const colorClasses = {
        primary: {
            bg: 'from-primary-500 to-primary-600',
            ring: 'ring-primary-500/50',
            check: 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400',
            iconBg: 'bg-primary-500',
        },
        secondary: {
            bg: 'from-secondary-500 to-secondary-600',
            ring: 'ring-secondary-500/50',
            check: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-900 dark:text-secondary-400',
            iconBg: 'bg-secondary-500',
        },
    };

    const colors = colorClasses[color];

    return (
        <div className={`
      relative h-full p-8 rounded-3xl glass
      transform transition-all duration-300 ease-out
      hover:scale-105 hover:shadow-2xl
      hover:ring-4 ${colors.ring}
      cursor-pointer
    `}>
            {/* Icon */}
            <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${colors.bg} text-white mb-6 shadow-lg`}>
                {icon}
            </div>

            {/* Title & Description */}
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-800 dark:text-white">
                {title}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                {description}
            </p>

            {/* Features */}
            <ul className="space-y-3">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1 rounded-full ${colors.check}`}>
                            <Check className="w-4 h-4" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                ))}
            </ul>

            {/* Hover Effect Gradient */}
            <div className={`
        absolute inset-0 rounded-3xl bg-gradient-to-br ${colors.bg} opacity-0
        group-hover:opacity-5 transition-opacity duration-300 pointer-events-none
      `} />
        </div>
    );
}
