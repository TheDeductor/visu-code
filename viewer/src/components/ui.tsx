import React, { useEffect } from 'react';
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
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={classNames('modal', wide && 'modal-wide')} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
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
    <span className={`badge badge-${tone}`} title={title}>
      {children}
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
  return (
    <div className={`toast toast-${tone}`} role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
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
