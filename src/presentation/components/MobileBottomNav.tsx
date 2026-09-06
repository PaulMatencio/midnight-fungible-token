'use client';

import React from 'react';
import { Zap, Database, History, Server, Settings } from 'lucide-react';
import type { ActiveNavTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  onOpenSettings: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
}) => {
  const tabs = [
    { id: 'actions' as ActiveNavTab, label: 'Actions', icon: Zap },
    { id: 'ledger' as ActiveNavTab, label: 'Shares', icon: Database },
    { id: 'activity' as ActiveNavTab, label: 'Activity', icon: History },
    { id: 'diagnostics' as ActiveNavTab, label: 'Nodes', icon: Server },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around safe-bottom shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all min-w-[56px] min-h-[44px] ${
              isActive ? 'text-cyan-400 font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-cyan-400 animate-pulse' : ''}`} />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}

      {/* Settings Button */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-slate-400 hover:text-cyan-300 transition-all min-w-[56px] min-h-[44px]"
      >
        <Settings className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Settings</span>
      </button>
    </nav>
  );
};
