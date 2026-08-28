import React from 'react';

interface MethodBadgeProps {
  method: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MethodBadge({ method, size = 'md' }: MethodBadgeProps) {
  const m = method.toUpperCase();

  const getStyles = () => {
    switch (m) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PUT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'PATCH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 font-mono font-semibold tracking-wider rounded',
    md: 'text-xs px-2.5 py-1 font-mono font-bold tracking-wider rounded-md',
    lg: 'text-sm px-3 py-1.5 font-mono font-bold tracking-wider rounded-md',
  };

  return (
    <span
      className={`inline-flex items-center justify-center uppercase border transition-colors ${getStyles()} ${sizeStyles[size]}`}
    >
      {m}
    </span>
  );
}
