import React from 'react';
import {
  BookOpen,
  Target,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Flame,
  Award,
  Crosshair,
  BarChart2,
  Activity,
  Layers,
  Flag,
  Sparkles,
  Compass,
  Gauge,
  Scale,
  Clock,
  Rocket,
  CheckCircle2,
  Eye,
  Workflow,
  BrainCircuit,
  PieChart
} from 'lucide-react';

export const PLAYBOOK_ICONS = [
  { name: 'BookOpen', label: 'Playbook', component: BookOpen },
  { name: 'Target', label: 'Target', component: Target },
  { name: 'Zap', label: 'Fast / Momentum', component: Zap },
  { name: 'TrendingUp', label: 'Bullish', component: TrendingUp },
  { name: 'TrendingDown', label: 'Bearish', component: TrendingDown },
  { name: 'Crosshair', label: 'Sniper Entry', component: Crosshair },
  { name: 'Flame', label: 'Hot / Breakout', component: Flame },
  { name: 'ShieldCheck', label: 'Risk Protection', component: ShieldCheck },
  { name: 'BarChart2', label: 'Volume / Stats', component: BarChart2 },
  { name: 'Activity', label: 'Volatility', component: Activity },
  { name: 'Layers', label: 'Confluence', component: Layers },
  { name: 'Award', label: 'A+ Setup', component: Award },
  { name: 'Rocket', label: 'Expansion', component: Rocket },
  { name: 'Sparkles', label: 'Edge', component: Sparkles },
  { name: 'Compass', label: 'Trend Direction', component: Compass },
  { name: 'Gauge', label: 'Indicators', component: Gauge },
  { name: 'Scale', label: 'Risk / Reward', component: Scale },
  { name: 'Clock', label: 'Opening / Timing', component: Clock },
  { name: 'CheckCircle2', label: 'Rules Confirmed', component: CheckCircle2 },
  { name: 'Flag', label: 'Flag Pattern', component: Flag },
  { name: 'Eye', label: 'Watchlist', component: Eye },
  { name: 'Workflow', label: 'Algorithmic', component: Workflow },
  { name: 'BrainCircuit', label: 'Psychology', component: BrainCircuit },
  { name: 'PieChart', label: 'Position Sizing', component: PieChart }
];

export const PLAYBOOK_COLORS = [
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Rose' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#f97316', label: 'Orange' }
];

export const PLAYBOOK_ICON_MAP = PLAYBOOK_ICONS.reduce((acc, item) => {
  acc[item.name] = item.component;
  return acc;
}, {});

export function PlaybookIconView({
  name,
  size = 16,
  color = 'var(--text-secondary)',
  strokeWidth = 2.2,
  style = {}
}) {
  const IconComp = (name && PLAYBOOK_ICON_MAP[name]) ? PLAYBOOK_ICON_MAP[name] : Target;
  return (
    <IconComp
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={{ flexShrink: 0, ...style }}
    />
  );
}
