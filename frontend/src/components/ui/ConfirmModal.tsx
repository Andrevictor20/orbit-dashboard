import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = true,
  children
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-slide-up relative">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-rose-500/20 text-rose-500' : 'bg-orbit-500/20 text-orbit-500'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-secondary hover:text-primary transition-colors rounded-lg hover:bg-accent"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-6 text-secondary text-sm">
            {message}
          </div>

          {children && (
            <div className="mb-6 space-y-3">
              {children}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-secondary hover:text-primary hover:bg-accent transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                isDestructive 
                  ? 'bg-rose-500 hover:bg-rose-600' 
                  : 'bg-orbit-600 hover:bg-orbit-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
