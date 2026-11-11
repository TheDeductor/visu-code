import React from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Badge as AstryxBadge } from '@astryxdesign/core/Badge';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Toast as AstryxToast } from '@astryxdesign/core/Toast';
import { classNames } from '../util';

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}): React.ReactElement {
  return (
    <Dialog
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      width={wide ? 720 : 480}
    >
      <DialogHeader
        title={title}
        subtitle={subtitle}
        hasDivider
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      />
      <div className="modal-body">{children}</div>
      {footer ? <footer className="modal-foot">{footer}</footer> : null}
    </Dialog>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'error' | 'info' | 'planned';
  title?: string;
}): React.ReactElement {
  const variantMap: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'purple'> = {
    neutral: 'neutral',
    ok: 'success',
    warn: 'warning',
    error: 'error',
    info: 'info',
    planned: 'purple',
  };
  return (
    <span title={title} className="badge-wrap">
      <AstryxBadge label={children} variant={variantMap[tone] ?? 'neutral'} />
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }): React.ReactElement {
  return (
    <div className="spinner" role="status">
      <span />
      {label}
    </div>
  );
}

export function EmptyState({
  icon = '◇',
  title,
  children,
  actions,
}: {
  icon?: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {children ? <div className="empty-body">{children}</div> : null}
      {actions ? <div className="empty-actions">{actions}</div> : null}
    </div>
  );
}

export function Toast({ message, tone = 'info', onClose }: { message: string; tone?: 'info' | 'ok' | 'error' | 'warn'; onClose: () => void }): React.ReactElement {
  const type = tone === 'error' ? 'error' : 'info';
  return (
    <div style={{ position: 'fixed', right: '18px', bottom: '18px', zIndex: 200 }}>
      <AstryxToast
        type={type}
        body={message}
        isAutoHide={true}
        autoHideDuration={4500}
        onDismiss={() => onClose()}
      />
    </div>
  );
}

export function ProgressBar({ percent, tone = 'info' }: { percent: number; tone?: 'info' | 'warn' | 'error' | 'ok' }): React.ReactElement {
  return (
    <div className="progress" aria-label={`${percent}%`}>
      <span className={`progress-fill progress-${tone}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}
