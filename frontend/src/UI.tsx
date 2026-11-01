import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, AlertCircle, PackageOpen, LoaderCircle } from "lucide-react";
import { explain } from "./api";
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      trigger.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          aria-label="Close dialog"
          className="icon-button"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div className="notice error" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={36} />
      <h3>{title}</h3>
      <p>{children || "Your records will appear here when you add them."}</p>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={"badge " + value.toLowerCase().replaceAll(" ", "-")}>
      {value}
    </span>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="primary" type="submit" disabled={busy}>
      {busy && <LoaderCircle className="spin" size={17} />}{" "}
      {busy ? "Saving…" : children}
    </button>
  );
}
export function Confirm({
  title,
  description,
  action,
  close,
  run,
}: {
  title: string;
  description: string;
  action: string;
  close: () => void;
  run: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={title}
      close={() => {
        if (!busy) close();
      }}
    >
      <p className="dialog-copy">{description}</p>
      <ErrorBox message={error} />
      <div className="form-actions">
        <button disabled={busy} onClick={close}>
          Go back
        </button>
        <button
          className={action.startsWith("Confirm") ? "primary" : "danger"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await run();
              close();
            } catch (e) {
              setError(explain(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : action}
        </button>
      </div>
    </Modal>
  );
}
