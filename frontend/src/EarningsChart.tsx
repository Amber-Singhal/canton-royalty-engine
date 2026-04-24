import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Payment } from '@daml.js/canton-royalty-engine-0.1.0/lib/PaymentSplit';
import { Party } from '@daml/types';

// Helper to generate a consistent color based on a string (party ID)
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

// Helper to format Party ID for display
const formatParty = (party: Party): string => {
  // Party format is "DisplayName::fingerprint"
  return party.split('::')[0];
};

interface EarningsChartProps {
  payments: readonly Payment[];
  currencySymbol?: string;
}

interface ChartDataPoint {
  date: string;
  [payee: Party]: number | string;
}

const EarningsChart: React.FC<EarningsChartProps> = ({ payments, currencySymbol = '$' }) => {

  const { chartData, payees } = useMemo(() => {
    if (!payments || payments.length === 0) {
      return { chartData: [], payees: [] };
    }

    const uniquePayees = Array.from(new Set(payments.map(p => p.payee)));

    const earningsByDate: Record<string, Record<Party, number>> = {};

    payments.forEach(payment => {
      const date = new Date(payment.paymentTime).toISOString().split('T')[0];
      const amount = parseFloat(payment.paymentAmount);

      if (!earningsByDate[date]) {
        earningsByDate[date] = {};
      }

      const currentEarnings = earningsByDate[date][payment.payee] || 0;
      earningsByDate[date][payment.payee] = currentEarnings + amount;
    });

    const formattedChartData: ChartDataPoint[] = Object.entries(earningsByDate)
      .map(([date, dailyEarnings]) => ({
        date,
        ...dailyEarnings,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { chartData: formattedChartData, payees: uniquePayees };
  }, [payments]);

  if (payments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
        <h3>Royalty Earnings Over Time</h3>
        <p>No payment data available to display.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 400 }}>
        <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Royalty Earnings Over Time</h3>
        <ResponsiveContainer>
            <LineChart
                data={chartData}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `${currencySymbol}${value.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value: number, name: Party) => [`${currencySymbol}${value.toFixed(2)}`, formatParty(name)]}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend formatter={(value) => formatParty(value as Party)} />
                {payees.map(payee => (
                    <Line
                        key={payee}
                        type="monotone"
                        dataKey={payee}
                        stroke={stringToColor(payee)}
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                        dot={false}
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default EarningsChart;