'use client'

import { useMemo, useEffect, useState } from 'react'
import { X, Battery, Droplets, History, Activity, AlertCircle } from 'lucide-react'
import { useBinStore } from '@/store/binStore'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts'

export function BinDetailPanel() {
  const selectedBinId = useBinStore((s) => s.selectedBinId)
  const setSelectedBinId = useBinStore((s) => s.setSelectedBinId)
  const bins = useBinStore((s) => s.bins)

  const bin = useMemo(() => 
    selectedBinId ? bins.get(selectedBinId) : null
  , [selectedBinId, bins])

  // Mock historical data for the chart
  const historyData = useMemo(() => [
    { time: '00:00', level: 10 },
    { time: '04:00', level: 25 },
    { time: '08:00', level: 45 },
    { time: '12:00', level: 65 },
    { time: '16:00', level: 82 },
    { time: '20:00', level: 91 },
    { time: 'now',   level: bin?.fill_level_pct ?? 91 },
  ], [bin?.fill_level_pct])

  if (!selectedBinId) return null

  return (
    <div className="flex h-full w-80 flex-col border-l border-slate-200 bg-white/90 backdrop-blur-xl animate-in slide-in-from-right duration-300 dark:border-slate-800 dark:bg-slate-950/90">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-900">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Bin Telemetry
          </span>
          <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-slate-100">
            {bin?.bin_id}
          </h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedBinId(null)}
          className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4 pb-10">
          {/* Real-time Status Card */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-lg">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Saturation Level
                </span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black tabular-nums tracking-tighter">
                  {Math.round(bin?.fill_level_pct ?? 0)}%
                </span>
                <span className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                  Total Volume
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${bin?.fill_level_pct}%` }}
                />
              </div>
            </div>
            {/* Background pattern */}
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-500">
                <Battery className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Power</span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">84%</span>
            </Card>
            <Card className="flex flex-col gap-1 rounded-2xl border-slate-100 bg-slate-50/50 p-3 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-500">
                <Droplets className="h-3 w-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Weight</span>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {bin?.estimated_weight_kg.toFixed(1)} kg
              </span>
            </Card>
          </div>

          {/* Fill Rate Intelligence */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <History className="h-3 w-3" />
              Saturation Trends
            </h4>
            <div className="h-40 w-full rounded-2xl border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 9, fontWeight: 700}} 
                  />
                  <YAxis hide domain={[0, 100]} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="level" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorLevel)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="px-1 text-[10px] font-bold text-slate-400 italic">
              Predicted to reach 100% in approx. 4.2 hours.
            </p>
          </div>

          {/* Zone & Category Info */}
          <div className="space-y-3 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Zone Name</span>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">{bin?.zone_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Waste Type</span>
              <span className="text-xs font-black capitalize text-slate-900 dark:text-slate-100">{bin?.waste_category ?? 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Cluster</span>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100">{bin?.cluster_name}</span>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="border-t border-slate-100 p-4 dark:border-slate-900">
        <Button className="w-full rounded-xl bg-slate-900 py-6 font-bold shadow-lg transition-transform active:scale-95 dark:bg-emerald-600">
          <Activity className="mr-2 h-4 w-4" />
          Dispatch Collection
        </Button>
      </div>
    </div>
  )
}
