import React from 'react';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { ProgressBar as AstryxProgressBar } from '@astryxdesign/core/ProgressBar';
import { Icon, type IconName } from './icons';

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
      width={wide ? 'min(720px, calc(100vw - 32px))' : 'min(480px, calc(100vw - 32px))'}
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
  return (
    <span title={title} className={`badge badge-${tone}`}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }): React.ReactElement {
  return (
    <div className="spinner" role="status">
      <span />
      {label}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  actions,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </div>
      <h2>{title}</h2>
      {children ? <div className="empty-body">{children}</div> : null}
      {actions ? <div className="empty-actions">{actions}</div> : null}
    </div>
  );
}

export function Toast({
  message,
  tone = 'info',
  onClose,
}: {
  message: string;
  tone?: 'info' | 'ok' | 'error' | 'warn';
  onClose: () => void;
}): React.ReactElement {
  const icon: IconName = tone === 'ok' ? 'check' : tone === 'error' || tone === 'warn' ? 'alert' : 'info';
  return (
    <div className={`toast toast-${tone}`} role="status">
      <span className="toast-icon" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span className="toast-body">{message}</span>
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onClose}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export function ProgressBar({ percent, tone = 'info' }: { percent: number; tone?: 'info' | 'warn' | 'error' | 'ok' }): React.ReactElement {
  const variant = tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : tone === 'error' ? 'error' : 'accent';
  return (
    <div className="progress-wrap">
      <AstryxProgressBar value={Math.min(100, Math.max(0, percent))} max={100} label="Progress" isLabelHidden variant={variant} />
    </div>
  );
}
