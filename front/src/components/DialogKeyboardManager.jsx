import { useEffect } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function DialogKeyboardManager() {
    useEffect(() => {
        let restoreTarget = null;
        let activeDialog = null;

        function currentDialog() {
            const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
            return dialogs[dialogs.length - 1] || null;
        }

        function syncDialog() {
            const dialog = currentDialog();
            if (dialog === activeDialog) return;
            if (activeDialog && !dialog && restoreTarget instanceof HTMLElement) {
                restoreTarget.focus({ preventScroll: true });
            }
            activeDialog = dialog;
            if (dialog) {
                restoreTarget = document.activeElement;
                window.requestAnimationFrame(() => dialog.querySelector(FOCUSABLE)?.focus({ preventScroll: true }));
            }
        }

        function closeDialog(dialog) {
            const buttons = [...dialog.querySelectorAll('button')];
            const close = dialog.querySelector('[data-dialog-close], [aria-label*="close" i]')
                || buttons.find((button) => /^(close|cancel|dismiss|x|×)$/i.test(button.textContent.trim()));
            close?.click();
        }

        function onKeyDown(event) {
            const dialog = currentDialog();
            if (!dialog) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                closeDialog(dialog);
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => element.getClientRects().length > 0);
            if (!focusable.length) {
                event.preventDefault();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        const observer = new MutationObserver(syncDialog);
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', onKeyDown);
        syncDialog();
        return () => {
            observer.disconnect();
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    return null;
}
