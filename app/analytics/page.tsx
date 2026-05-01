'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ANALYTICS, ZONES } from '@/lib/mock-data';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

function StatCard({ title, value, unit, change, changeType }: {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {change && (
        <div style={{
          fontSize: 12,
          color: changeType === 'positive' ? 'var(--ok)' : changeType === 'negative' ? 'var(--critical)' : 'var(--text-muted)',
          marginTop: 4,
        }}>
          {change}
        </div>
      )}
    </div>
  );
}

function WasteGenerationChart() {
  // Mock waste generation data by waste type
  const data = [
    { type: 'General', amount: 2450, percentage: 45 },
    { type: 'Recycling', amount: 1800, percentage: 33 },
    { type: 'Organic', amount: 950, percentage: 17 },
    { type: 'Hazardous', amount: 250, percentage: 5 },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Waste Generation by Type
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="type" stroke="var(--text-muted)" />
          <YAxis stroke="var(--text-muted)" />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FillRateHeatmap() {
  // Simplified heatmap using zones and their fill rates
  const zoneData = ZONES.map((zone, index) => ({
    zone: zone.name,
    fillRate: ANALYTICS.fillRateByZone.find(f => f.zone === zone.name)?.avg || 0,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Zone Fill Rate Heatmap
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {zoneData.map((zone) => (
          <div
            key={zone.zone}
            style={{
              padding: '16px',
              borderRadius: 8,
              background: `linear-gradient(135deg, ${zone.color}20, ${zone.color}10)`,
              border: `1px solid ${zone.color}30`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              {zone.zone}
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 700,
              color: zone.fillRate > 70 ? 'var(--critical)' : zone.fillRate > 50 ? 'var(--warning)' : 'var(--ok)',
            }}>
              {zone.fillRate}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Avg Fill Rate
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehicleUtilizationChart() {
  // Mock vehicle utilization data
  const data = [
    { vehicle: 'TRK-01', utilization: 85, routes: 12 },
    { vehicle: 'TRK-02', utilization: 72, routes: 9 },
    { vehicle: 'TRK-03', utilization: 91, routes: 15 },
    { vehicle: 'TRK-04', utilization: 68, routes: 8 },
    { vehicle: 'TRK-05', utilization: 78, routes: 11 },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Vehicle Utilization
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" stroke="var(--text-muted)" />
          <YAxis dataKey="vehicle" type="category" stroke="var(--text-muted)" width={60} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Bar dataKey="utilization" fill="var(--accent)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CollectionEfficiencyChart() {
  // Mock collection efficiency over time
  const data = [
    { week: 'Week 1', efficiency: 78, collections: 145 },
    { week: 'Week 2', efficiency: 82, collections: 152 },
    { week: 'Week 3', efficiency: 85, collections: 158 },
    { week: 'Week 4', efficiency: 79, collections: 141 },
    { week: 'Week 5', efficiency: 88, collections: 165 },
    { week: 'Week 6', efficiency: 91, collections: 172 },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Collection Efficiency Trend
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="week" stroke="var(--text-muted)" />
          <YAxis stroke="var(--text-muted)" />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="efficiency"
            stroke="var(--accent)"
            strokeWidth={3}
            dot={{ fill: 'var(--accent)', strokeWidth: 2, r: 4 }}
            name="Efficiency %"
          />
          <Line
            type="monotone"
            dataKey="collections"
            stroke="var(--ok)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: 'var(--ok)', strokeWidth: 2, r: 3 }}
            name="Collections"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AlertsBreakdownChart() {
  const data = ANALYTICS.alertsByType.map(item => ({
    name: item.type,
    value: item.count,
    color: item.type === 'critical' ? '#ef4444' : item.type === 'warning' ? '#f59e0b' : '#6b7280',
  }));

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Alerts Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div style={{ padding: '20px', background: 'var(--bg-app)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Analytics Dashboard
          </h1>
          <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>
            Monitor waste management performance and efficiency metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}>
          <StatCard
            title="Total Collections"
            value={ANALYTICS.totalCollectionsThisMonth}
            unit="this month"
            change="+12% from last month"
            changeType="positive"
          />
          <StatCard
            title="Avg Fill on Collection"
            value={ANALYTICS.avgFillOnCollection}
            unit="%"
            change="-5% efficiency gain"
            changeType="positive"
          />
          <StatCard
            title="Fuel Saved"
            value={ANALYTICS.fuelSavedLitres}
            unit="L"
            change="Environmental impact"
            changeType="neutral"
          />
          <StatCard
            title="CO2 Reduced"
            value={ANALYTICS.co2SavedKg}
            unit="kg"
            change="Carbon footprint"
            changeType="neutral"
          />
        </div>

        {/* Charts Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: 24,
          marginBottom: 24,
        }}>
          <WasteGenerationChart />
          <VehicleUtilizationChart />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: 24,
          marginBottom: 24,
        }}>
          <CollectionEfficiencyChart />
          <FillRateHeatmap />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 24,
        }}>
          <AlertsBreakdownChart />
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '20px',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Weekly Collections
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ANALYTICS.weeklyCollections}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}