'use client';

import React from 'react';

interface DentalChartProps {
    missingTeeth?: string[];
    decayedTeeth?: string[];
    filledTeeth?: string[];
    problemTeeth?: string[];
    className?: string;
}

// FDI (World Dental Federation) tooth numbering system
// Quadrant 1: 11-18 (Upper right)
// Quadrant 2: 21-28 (Upper left)
// Quadrant 3: 31-38 (Lower left)
// Quadrant 4: 41-48 (Lower right)

export default function DentalChart({
    missingTeeth = [],
    decayedTeeth = [],
    filledTeeth = [],
    problemTeeth = [],
    className = ''
}: DentalChartProps) {
    const getToothStatus = (toothNumber: string) => {
        if (missingTeeth.includes(toothNumber)) return 'missing';
        if (decayedTeeth.includes(toothNumber)) return 'decayed';
        if (filledTeeth.includes(toothNumber)) return 'filled';
        if (problemTeeth.includes(toothNumber)) return 'problem';
        return 'healthy';
    };

    const getToothColor = (status: string) => {
        switch (status) {
            case 'missing': return '#9CA3AF'; // Gray
            case 'decayed': return '#EF4444'; // Red
            case 'filled': return '#10B981'; // Green
            case 'problem': return '#F59E0B'; // Orange
            default: return '#E5E7EB'; // Light gray (healthy)
        }
    };

    const getToothStroke = (status: string) => {
        return status === 'healthy' ? '#D1D5DB' : '#1F2937';
    };

    // Generate tooth numbers for each quadrant
    const quadrant1 = ['18', '17', '16', '15', '14', '13', '12', '11']; // Upper right
    const quadrant2 = ['21', '22', '23', '24', '25', '26', '27', '28']; // Upper left
    const quadrant3 = ['38', '37', '36', '35', '34', '33', '32', '31']; // Lower left
    const quadrant4 = ['41', '42', '43', '44', '45', '46', '47', '48']; // Lower right

    const Tooth = ({ number, x, y }: { number: string; x: number; y: number }) => {
        const status = getToothStatus(number);
        const isMissing = status === 'missing';

        return (
            <g className="tooth-group cursor-pointer transition-all hover:opacity-80">
                <title>{`Diş ${number} - ${getStatusText(status)}`}</title>
                {isMissing ? (
                    // X mark for missing tooth
                    <>
                        <line
                            x1={x - 10}
                            y1={y - 15}
                            x2={x + 10}
                            y2={y + 15}
                            stroke={getToothColor(status)}
                            strokeWidth="2"
                        />
                        <line
                            x1={x - 10}
                            y1={y + 15}
                            x2={x + 10}
                            y2={y - 15}
                            stroke={getToothColor(status)}
                            strokeWidth="2"
                        />
                    </>
                ) : (
                    // Normal tooth shape
                    <path
                        d={`M ${x - 12} ${y - 15} Q ${x} ${y - 20} ${x + 12} ${y - 15} L ${x + 8} ${y + 15} Q ${x} ${y + 18} ${x - 8} ${y + 15} Z`}
                        fill={getToothColor(status)}
                        stroke={getToothStroke(status)}
                        strokeWidth="1.5"
                    />
                )}
                <text
                    x={x}
                    y={y + (isMissing ? 30 : 35)}
                    textAnchor="middle"
                    className="text-xs font-semibold"
                    fill="#374151"
                >
                    {number}
                </text>
            </g>
        );
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'missing': return 'Eksik';
            case 'decayed': return 'Çürük';
            case 'filled': return 'Dolgulu';
            case 'problem': return 'Problemli';
            default: return 'Sağlıklı';
        }
    };

    return (
        <div className={`dental-chart ${className}`}>
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                    🦷 Diş Şeması (FDI Sistemi)
                </h3>
                <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-400 rounded"></div>
                        <span className="text-gray-700 dark:text-gray-300">Eksik</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded"></div>
                        <span className="text-gray-700 dark:text-gray-300">Çürük</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-gray-700 dark:text-gray-300">Dolgulu</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded"></div>
                        <span className="text-gray-700 dark:text-gray-300">Problemli</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded"></div>
                        <span className="text-gray-700 dark:text-gray-300">Sağlıklı</span>
                    </div>
                </div>
            </div>

            <svg
                viewBox="0 0 700 400"
                className="w-full h-auto bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
                {/* Upper jaw label */}
                <text x="350" y="20" textAnchor="middle" className="text-sm font-semibold" fill="#6B7280">
                    ÜST ÇENE
                </text>

                {/* Lower jaw label */}
                <text x="350" y="390" textAnchor="middle" className="text-sm font-semibold" fill="#6B7280">
                    ALT ÇENE
                </text>

                {/* Quadrant labels */}
                <text x="100" y="100" className="text-xs" fill="#9CA3AF">Sağ</text>
                <text x="600" y="100" className="text-xs" fill="#9CA3AF">Sol</text>

                {/* Center line */}
                <line x1="350" y1="40" x2="350" y2="180" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" />
                <line x1="350" y1="220" x2="350" y2="360" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" />

                {/* Upper teeth */}
                {/* Quadrant 1 (Upper right) */}
                {quadrant1.map((num, idx) => (
                    <Tooth key={num} number={num} x={320 - (idx * 40)} y={80} />
                ))}

                {/* Quadrant 2 (Upper left) */}
                {quadrant2.map((num, idx) => (
                    <Tooth key={num} number={num} x={380 + (idx * 40)} y={80} />
                ))}

                {/* Upper/Lower separator */}
                <line x1="50" y1="200" x2="650" y2="200" stroke="#9CA3AF" strokeWidth="3" />

                {/* Lower teeth */}
                {/* Quadrant 4 (Lower right) */}
                {quadrant4.map((num, idx) => (
                    <Tooth key={num} number={num} x={320 - (idx * 40)} y={280} />
                ))}

                {/* Quadrant 3 (Lower left) */}
                {quadrant3.map((num, idx) => (
                    <Tooth key={num} number={num} x={380 + (idx * 40)} y={280} />
                ))}
            </svg>
        </div>
    );
}
