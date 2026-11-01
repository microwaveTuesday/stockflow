import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  api,
  explain,
  money,
  type Data,
  type Product,
  type Contact,
  type Order,
  type Employee,
  type Role,
} from "./api";
import { Modal, Field, ErrorBox, Submit } from "./UI";
type Props = { data: Data; close: () => void; saved: () => Promise<void> };
function useSave(close: () => void, saved: () => Promise<void>) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(job: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await job();
      await saved();
      close();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, save };
}
export function PasswordEditor({
  close,
  changed,
}: {
  close: () => void;
  changed: () => void;
}) {
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Change your password" close={close}>
      <p className="dialog-copy">
        Use 12 or more characters with uppercase, lowercase, a number and a
        symbol. You will sign in again after saving.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post("/auth/password", { currentPassword, newPassword });
            close();
            changed();
          } catch (e) {
            setError(explain(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Current password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </Field>
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Save password</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function ProductEditor({
  data,
  close,
  saved,
  product,
}: { product?: Product } & Props) {
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    price: product?.price ?? 0,
    reorderLevel: product?.reorderLevel ?? 10,
    categoryId: product?.categoryId || data.categories[0]?.id || 0,
    supplierId: product?.supplierId || data.suppliers[0]?.id || 0,
  });
  const { busy, error, save } = useSave(close, saved);
  return (
    <Modal title={product ? "Edit product" : "Add a product"} close={close}>
      <p className="dialog-copy">
        Keep product details here. Record quantities separately in Stock &
        history so every change is traceable.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(() =>
            product
              ? api.put("/products/" + product.id, form)
              : api.post("/products", form),
          );
        }}
      >
        <div className="form-grid">
          <Field label="Product name">
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field
            label="Product code (SKU)"
            hint="A unique short code, such as BN-001."
          >
            <input
              required
              pattern="[A-Za-z0-9_-]{2,40}"
              maxLength={40}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>
          <Field label="Selling price (PHP)">
            <input
              type="number"
              required
              min={0}
              max={99999999}
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Low-stock reminder at">
            <input
              type="number"
              required
              min={0}
              max={1000000}
              value={form.reorderLevel}
              onChange={(e) =>
                setForm({ ...form, reorderLevel: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Category">
            <select
              required
              value={form.categoryId}
              onChange={(e) =>
                setForm({ ...form, categoryId: Number(e.target.value) })
              }
            >
              <option value="">Choose a category</option>
              {data.categories.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <select
              required
              value={form.supplierId}
              onChange={(e) =>
                setForm({ ...form, supplierId: Number(e.target.value) })
              }
            >
              <option value="">Choose a supplier</option>
              {data.suppliers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Save product</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function ContactEditor({
  kind,
  record,
  close,
  saved,
}: {
  kind: "categories" | "customers" | "suppliers";
  record?: Contact;
} & Props) {
  const [name, setName] = useState(record?.name || ""),
    [email, setEmail] = useState(record?.email || ""),
    [phone, setPhone] = useState(record?.phone || "");
  const { busy, error, save } = useSave(close, saved);
  const singular = kind === "categories" ? "category" : kind.slice(0, -1);
  return (
    <Modal title={`${record ? "Edit" : "Add"} ${singular}`} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body =
            kind === "categories"
              ? { name }
              : { name, email: email || null, phone: phone || null };
          save(() =>
            record
              ? api.put(`/${kind}/${record.id}`, body)
              : api.post("/" + kind, body),
          );
        }}
      >
        <Field label="Name">
          <input
            required
            minLength={2}
            maxLength={kind === "categories" ? 80 : 120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {kind !== "categories" && (
          <>
            <Field label="Email (optional)">
              <input
                type="email"
                maxLength={180}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone (optional)">
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </>
        )}
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy}>Save {singular}</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function StockEditor({
  data,
  product,
  close,
  saved,
}: Props & { product?: Product }) {
  const [id, setId] = useState(product?.id || data.products[0]?.id || 0),
    [delta, setDelta] = useState(1),
    [reason, setReason] = useState("");
  const { busy, error, save } = useSave(close, saved);
  const p = data.products.find((x) => x.id === id);
  return (
    <Modal title="Record a stock change" close={close}>
      <p className="dialog-copy">
        Receiving a delivery? Enter a positive quantity. Correcting missing or
        damaged stock? Enter a negative quantity.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (delta === 0) return;
          save(() => api.post(`/inventory/${id}/adjust`, { delta, reason }));
        }}
      >
        <Field label="Product">
          <select
            required
            value={id}
            onChange={(e) => setId(Number(e.target.value))}
          >
            {data.products.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · {x.stock} available
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Quantity to add or remove"
          hint={
            p
              ? `After this change: ${p.stock + delta} units`
              : "Choose a product first."
          }
        >
          <input
            type="number"
            required
            min={Math.max(-1000000, -(p?.stock || 0))}
            max={1000000}
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
          />
        </Field>
        <Field
          label="Reason for this change"
          hint="For example: Delivery from Evergreen, invoice 1042."
        >
          <textarea
            required
            minLength={5}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy || !p || delta === 0}>Record stock change</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function OrderEditor({
  data,
  order,
  close,
  saved,
}: Props & { order?: Order }) {
  const [customerId, setCustomerId] = useState(
      order?.customerId || data.customers[0]?.id || 0,
    ),
    [items, setItems] = useState(
      order?.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })) || [{ productId: data.products[0]?.id || 0, quantity: 1 }],
    );
  const { busy, error, save } = useSave(close, saved);
  const total = items.reduce(
    (s, i) =>
      s +
      (data.products.find((x) => x.id === i.productId)?.price || 0) *
        i.quantity,
    0,
  );
  return (
    <Modal
      title={
        order
          ? `Edit draft SF-${String(order.id).padStart(4, "0")}`
          : "Create a sales order"
      }
      close={close}
    >
      <p className="dialog-copy">
        Save a draft first. Stock stays available until you review and confirm
        the order. Prices are saved with the draft; editing refreshes them to
        current prices.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(() =>
            order
              ? api.put("/orders/" + order.id, { customerId, items })
              : api.post("/orders", { customerId, items }),
          );
        }}
      >
        <Field label="Customer">
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(Number(e.target.value))}
          >
            <option value="">Choose a customer</option>
            {data.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="line-heading">
          <h3>Order items</h3>
          <span>PHP</span>
        </div>
        {items.map((item, index) => (
          <div className="order-line" key={index}>
            <Field label={`Product ${index + 1}`}>
              <select
                required
                value={item.productId}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, productId: Number(e.target.value) }
                        : i,
                    ),
                  )
                }
              >
                <option value="">Choose product</option>
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.stock} in stock · {money(p.price)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                required
                min={1}
                max={1000000}
                value={item.quantity}
                onChange={(e) =>
                  setItems(
                    items.map((i, n) =>
                      n === index
                        ? { ...i, quantity: Number(e.target.value) }
                        : i,
                    ),
                  )
                }
              />
            </Field>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove product ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== index))}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={items.length >= 100}
          onClick={() => setItems([...items, { productId: 0, quantity: 1 }])}
        >
          <Plus size={16} /> Add another product
        </button>
        <div className="order-total">
          <span>Draft total</span>
          <strong>{money(total)}</strong>
        </div>
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy || !customerId}>Save draft order</Submit>
        </div>
      </form>
    </Modal>
  );
}
export function EmployeeEditor({
  data,
  employee,
  close,
  saved,
}: Props & { employee?: Employee }) {
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: employee?.role || ("Sales" as Role),
    active: employee?.active ?? true,
  });
  const { busy, error, save } = useSave(close, saved);
  return (
    <Modal
      title={
        employee ? `Manage ${employee.displayName}` : "Invite a team member"
      }
      close={close}
    >
      <p className="dialog-copy">
        {employee
          ? "Role changes end this employee’s current session."
          : "Create an employee account. Share the initial password privately."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(() =>
            employee
              ? api.put("/users/" + employee.id, {
                  role: form.role,
                  active: form.active,
                })
              : api.post("/users", form),
          );
        }}
      >
        {!employee && (
          <>
            <Field label="Full name">
              <input
                required
                minLength={2}
                maxLength={100}
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
            </Field>
            <Field label="Work email">
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field
              label="Initial password"
              hint="12 or more characters, with uppercase, lowercase, a number and a symbol."
            >
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
          </>
        )}
        <Field label="Role">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option>Sales</option>
            <option>Inventory</option>
            <option>Admin</option>
          </select>
        </Field>
        <p className="helper">
          Sales handles customers and orders. Inventory handles supplies and
          stock. Admin has full access.
        </p>
        {employee && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Allow this employee to sign in
          </label>
        )}
        <ErrorBox message={error} />
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <Submit busy={busy || data.users.length > 1000}>Save employee</Submit>
        </div>
      </form>
    </Modal>
  );
}
