import { useState, useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ArrowLeftRight,
  Users,
  Truck,
  Tags,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronRight,
  Check,
  RefreshCw,
  Leaf,
  ArrowDownLeft,
  Globe,
  Menu,
  PanelLeftClose,
} from "lucide-react";
import {
  api,
  explain,
  empty,
  money,
  date,
  type Data,
  type Employee,
  type Order,
  type Product,
  type Contact,
} from "./api";
import { Badge, Empty, ErrorBox, Field, Modal, Submit, Confirm } from "./UI";
import {
  ProductEditor,
  ContactEditor,
  StockEditor,
  OrderEditor,
  EmployeeEditor,
  PasswordEditor,
} from "./Editors";

const sections = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["Admin", "Sales", "Inventory"],
  },
  {
    id: "products",
    label: "Products",
    icon: Package,
    roles: ["Admin", "Sales", "Inventory"],
  },
  {
    id: "orders",
    label: "Sales orders",
    icon: ShoppingBag,
    roles: ["Admin", "Sales"],
  },
  {
    id: "inventory",
    label: "Stock & history",
    icon: ArrowLeftRight,
    roles: ["Admin", "Inventory"],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    roles: ["Admin", "Sales"],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: Truck,
    roles: ["Admin", "Inventory"],
  },
  { id: "categories", label: "Categories", icon: Tags, roles: ["Admin"] },
  {
    id: "currency",
    label: "Currency estimator",
    icon: Globe,
    roles: ["Admin", "Inventory"],
  },
  { id: "team", label: "Team & access", icon: ShieldCheck, roles: ["Admin"] },
];
const names: Record<string, string> = {
  dashboard: "A clear view of your business.",
  products: "Everything you sell, in one place.",
  orders: "From first draft to fulfilled sale.",
  inventory: "Know what came in. Know what went out.",
  customers: "Good business starts with good relationships.",
  suppliers: "Your partners behind the products.",
  categories: "A little structure goes a long way.",
  currency: "Plan your next purchase with confidence.",
  team: "The right access for every teammate.",
};
export default function App() {
  const [user, setUser] = useState<Employee | null>(null),
    [checking, setChecking] = useState(true),
    [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [page, setPage] = useState(location.hash.slice(1) || "dashboard"),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState<ReactNode>(null),
    [navOpen, setNavOpen] = useState(false);
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem("stockflow-theme") === "dark" ||
      (!localStorage.getItem("stockflow-theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches),
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("stockflow-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const change = () => {
      setPage(location.hash.slice(1) || "dashboard");
      setSearch("");
      setNavOpen(false);
    };
    window.addEventListener("hashchange", change);
    api
      .get<Employee>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {})
      .finally(() => setChecking(false));
    return () => window.removeEventListener("hashchange", change);
  }, []);
  async function load(current = user) {
    if (!current) return;
    setLoading(true);
    setError("");
    try {
      const paths = [
        "products",
        "categories",
        ...(current.role !== "Inventory" ? ["orders", "customers"] : []),
        ...(current.role !== "Sales"
          ? ["suppliers", "inventory/movements"]
          : []),
        ...(current.role === "Admin" ? ["users"] : []),
      ];
      const result = await Promise.all(paths.map((p) => api.get("/" + p)));
      const next = { ...empty };
      paths.forEach((p, i) => {
        const key = p === "inventory/movements" ? "movements" : p;
        next[key as keyof Data] = result[i].data;
      });
      setData(next);
    } catch (e) {
      setError(explain(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) void load(user);
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const close = () => setModal(null);
  const saved = async () => {
    setToast("Your changes have been saved.");
    await load();
  };
  const editorProps = { data, close, saved };
  const canSales = user?.role !== "Inventory",
    canStock = user?.role !== "Sales",
    admin = user?.role === "Admin";
  const low = data.products.filter((p) => p.stock <= p.reorderLevel),
    stockValue = data.products.reduce((v, p) => v + p.stock * p.price, 0),
    confirmed = data.orders.filter((o) => o.status === "Confirmed");
  const go = (id: string) => {
    location.hash = id;
  };
  const ask = (
    title: string,
    description: string,
    action: string,
    job: () => Promise<unknown>,
  ) =>
    setModal(
      <Confirm
        title={title}
        description={description}
        action={action}
        close={close}
        run={async () => {
          await job();
          await saved();
        }}
      />,
    );
  const editProduct = (p?: Product) =>
    setModal(<ProductEditor {...editorProps} product={p} />);
  const editContact = (
    kind: "categories" | "customers" | "suppliers",
    record?: Contact,
  ) => setModal(<ContactEditor {...editorProps} kind={kind} record={record} />);
  const editOrder = (o?: Order) =>
    setModal(<OrderEditor {...editorProps} order={o} />);
  function orderDetail(o: Order) {
    setModal(
      <Modal title={`Order SF-${String(o.id).padStart(4, "0")}`} close={close}>
        <div className="detail-top">
          <div>
            <strong>{o.customerName}</strong>
            <p>{date(o.createdAt)}</p>
          </div>
          <Badge value={o.status} />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Saved price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((i) => (
                <tr key={i.productId}>
                  <td>
                    <strong>{i.productName}</strong>
                    <small>{i.sku}</small>
                  </td>
                  <td>{i.quantity}</td>
                  <td>{money(i.unitPrice)}</td>
                  <td>{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="order-total">
          <span>Order total</span>
          <strong>{money(o.total)}</strong>
        </div>
        <p className="helper">
          {o.status === "Draft"
            ? "Drafts do not reserve stock. Confirmation checks current availability and records the sale."
            : o.status === "Confirmed"
              ? "Stock has been deducted. Canceling this order returns its stock once."
              : "This order is canceled. Its history is kept for your records."}
        </p>
        <div className="form-actions">
          {o.status === "Draft" && (
            <>
              <button onClick={() => editOrder(o)}>Edit draft</button>
              <button
                className="primary"
                onClick={() =>
                  ask(
                    "Confirm this order?",
                    `Confirm ${money(o.total)} for ${o.customerName}? Stock for all items will be deducted together. If any item is unavailable, nothing will change.`,
                    "Confirm order",
                    () => api.post(`/orders/${o.id}/confirm`),
                  )
                }
              >
                <Check size={17} /> Confirm order
              </button>
            </>
          )}
          {o.status !== "Canceled" && (
            <button
              className="text-danger"
              onClick={() =>
                ask(
                  "Cancel this order?",
                  o.status === "Confirmed"
                    ? "The items in this order will be returned to stock. The order remains in your history."
                    : "This draft will be canceled. No stock will change.",
                  "Cancel order",
                  () => api.post(`/orders/${o.id}/cancel`),
                )
              }
            >
              Cancel order
            </button>
          )}
          {o.status === "Draft" && (
            <button
              className="text-danger"
              onClick={() =>
                ask(
                  "Delete this draft?",
                  "This draft will be permanently removed. No stock will change.",
                  "Delete draft",
                  () => api.delete("/orders/" + o.id),
                )
              }
            >
              Delete draft
            </button>
          )}
        </div>
      </Modal>,
    );
  }
  if (checking)
    return (
      <div className="boot">
        <Leaf />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user)
    return (
      <Login onLogin={setUser} dark={dark} toggle={() => setDark(!dark)} />
    );
  const allowed = sections.filter((s) => s.roles.includes(user.role));
  const current = allowed.find((s) => s.id === page);
  const filtered = data.products.filter((p) =>
    `${p.name} ${p.sku} ${p.categoryName}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside className={"sidebar " + (navOpen ? "open" : "")}>
        <a className="brand" href="#dashboard">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          StockFlow<span className="brand-dot">.</span>
        </a>
        <p className="workspace-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {allowed.map(({ id, label, icon: Icon }) => (
            <a
              href={"#" + id}
              key={id}
              aria-current={page === id ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {id === "inventory" && low.length > 0 && (
                <span className="nav-count">{low.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-help">
          <span className="mini-icon">
            <ShieldCheck size={20} />
          </span>
          <strong>Everything stays in sync.</strong>
          <p>
            Products, stock and orders.
            <br />
            One connected workspace.
          </p>
        </div>
        <div className="profile">
          <button
            className="avatar"
            aria-label="Change your password"
            title="Change your password"
            onClick={() =>
              setModal(
                <PasswordEditor
                  close={close}
                  changed={() => {
                    setUser(null);
                    setData(empty);
                  }}
                />,
              )
            }
          >
            {user.displayName.charAt(0)}
          </button>
          <div>
            <strong>{user.displayName}</strong>
            <small>
              {user.role === "Admin" ? "Administrator" : user.role + " staff"}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              try {
                await api.post("/auth/logout");
                setUser(null);
                setData(empty);
              } catch (e) {
                setError(explain(e));
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <PanelLeftClose size={21} /> : <Menu size={21} />}
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />{" "}
            <strong>{current?.label || "Page not available"}</strong>
          </div>
          <div className="top-actions">
            <span className="connected">
              <span /> Connected workspace
            </span>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "dashboard"
                  ? "YOUR BUSINESS, AT A GLANCE"
                  : "STOCKFLOW WORKSPACE"}
              </p>
              <h1>{current?.label || "This page is not available"}</h1>
              <p>{names[page]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                aria-label="Refresh workspace"
                disabled={loading}
                onClick={() => load()}
              >
                <RefreshCw size={18} className={loading ? "spin" : ""} />
              </button>
              {(page === "dashboard" || page === "orders") && canSales && (
                <button className="primary" onClick={() => editOrder()}>
                  <Plus size={18} /> New order
                </button>
              )}
              {page === "products" && admin && (
                <button className="primary" onClick={() => editProduct()}>
                  <Plus size={18} /> Add product
                </button>
              )}
              {page === "inventory" && (
                <button
                  className="primary"
                  onClick={() => setModal(<StockEditor {...editorProps} />)}
                >
                  <Plus size={18} /> Record stock change
                </button>
              )}
              {["categories", "suppliers", "customers"].includes(page) && (
                <button
                  className="primary"
                  onClick={() =>
                    editContact(
                      page as "categories" | "suppliers" | "customers",
                    )
                  }
                >
                  <Plus size={18} /> Add{" "}
                  {page === "categories" ? "category" : page.slice(0, -1)}
                </button>
              )}
              {page === "team" && (
                <button
                  className="primary"
                  onClick={() => setModal(<EmployeeEditor {...editorProps} />)}
                >
                  <Plus size={18} /> Add team member
                </button>
              )}
            </div>
          </div>
          <ErrorBox message={error} />
          {error.includes("session") && (
            <button onClick={() => setUser(null)}>Return to sign in</button>
          )}
          {loading && (
            <p className="loading" role="status">
              Updating your workspace…
            </p>
          )}
          {page === "dashboard" && (
            <>
              <section className="welcome-banner">
                <div>
                  <span className="banner-label">
                    <span /> A LITTLE ORDER. A LOT OF CLARITY.
                  </span>
                  <h2>Ready for a productive day?</h2>
                  <p>
                    {low.length
                      ? `${low.length} ${low.length === 1 ? "product needs" : "products need"} a restock. Let’s keep your shelves ready.`
                      : "Your stock is looking healthy. You’re ready for the next sale."}
                  </p>
                  <button
                    onClick={() => go(canStock ? "inventory" : "products")}
                  >
                    Check your inventory <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-circle" />
                  <div className="art-box box-one">
                    <Package size={45} />
                  </div>
                  <div className="art-box box-two">
                    <Check size={29} />
                  </div>
                  <span className="art-pill">
                    <span /> All in one place
                  </span>
                </div>
              </section>
              <div className="stats-grid">
                <Stat
                  label="Active products"
                  value={data.products.length.toString()}
                  detail="Across your product catalog"
                  icon={<Package />}
                />
                <Stat
                  label="Stock value"
                  value={money(stockValue)}
                  detail="At current selling prices"
                  icon={<Tags />}
                />
                <Stat
                  label="Needs restocking"
                  value={low.length.toString()}
                  detail="At or below your reminder level"
                  icon={<ArrowDownLeft />}
                  warning={low.length > 0}
                />
                {canSales ? (
                  <Stat
                    label="Confirmed sales"
                    value={money(confirmed.reduce((s, o) => s + o.total, 0))}
                    detail={`${confirmed.length} confirmed orders · all time`}
                    icon={<ShoppingBag />}
                  />
                ) : (
                  <Stat
                    label="Recorded changes"
                    value={data.movements.length.toString()}
                    detail="In the latest 500 stock movements"
                    icon={<ArrowLeftRight />}
                  />
                )}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <PanelHeading
                    title="Keep an eye on these"
                    subtitle="A timely restock keeps business moving."
                    action="View products"
                    onAction={() => go("products")}
                  />
                  {low.length ? (
                    <div className="stock-list">
                      {low.slice(0, 5).map((p) => (
                        <div className="stock-row" key={p.id}>
                          <span className="product-icon">
                            <Package size={21} />
                          </span>
                          <div className="grow">
                            <strong>{p.name}</strong>
                            <small>
                              {p.sku} · {p.categoryName}
                            </small>
                          </div>
                          <div className="align-right">
                            <Badge
                              value={
                                p.stock === 0 ? "Out of stock" : "Low stock"
                              }
                            />
                            <small>
                              {p.stock} left · reminder at {p.reorderLevel}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty title="All stocked up">
                      No products are below their reminder level.
                    </Empty>
                  )}
                </section>
                <section className="panel quick-panel">
                  <PanelHeading
                    title="Make your next move"
                    subtitle="Everyday tasks, a click away."
                  />
                  {canSales && (
                    <Quick
                      icon={<ShoppingBag />}
                      title="Create a sales order"
                      description="Save a draft, then confirm when ready."
                      click={() => editOrder()}
                    />
                  )}
                  <Quick
                    icon={<Package />}
                    title="Browse your products"
                    description="Find prices and available quantities."
                    click={() => go("products")}
                  />
                  {canStock && (
                    <Quick
                      icon={<ArrowLeftRight />}
                      title="Receive or adjust stock"
                      description="Keep quantities accurate, with a reason."
                      click={() => setModal(<StockEditor {...editorProps} />)}
                    />
                  )}
                </section>
              </div>
              {canSales && (
                <section className="panel">
                  <PanelHeading
                    title="Recent orders"
                    subtitle="The latest activity from your sales desk."
                    action="All orders"
                    onAction={() => go("orders")}
                  />
                  <OrdersTable
                    orders={data.orders.slice(0, 5)}
                    open={orderDetail}
                  />
                </section>
              )}
            </>
          )}
          {page === "products" && (
            <section className="panel">
              <div className="table-toolbar">
                <div>
                  <h2>
                    Product catalog{" "}
                    <span className="count">{data.products.length}</span>
                  </h2>
                  <p>
                    Live quantities, updated when orders and stock changes are
                    recorded.
                  </p>
                </div>
                <SearchBox
                  value={search}
                  change={setSearch}
                  placeholder="Search products or codes"
                />
              </div>
              {filtered.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Available</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="product-cell">
                              <span className="product-icon">
                                <Package size={21} />
                              </span>
                              <div>
                                <strong>{p.name}</strong>
                                <small>{p.sku}</small>
                              </div>
                            </div>
                          </td>
                          <td>{p.categoryName}</td>
                          <td className="numeric">{money(p.price)}</td>
                          <td>
                            <strong>{p.stock}</strong>
                            <small>units</small>
                          </td>
                          <td>
                            <Badge
                              value={
                                p.stock === 0
                                  ? "Out of stock"
                                  : p.stock <= p.reorderLevel
                                    ? "Low stock"
                                    : "In stock"
                              }
                            />
                          </td>
                          <td>
                            <div className="row-actions">
                              {admin && (
                                <button onClick={() => editProduct(p)}>
                                  Edit<span className="sr-only"> {p.name}</span>
                                </button>
                              )}
                              {canStock && (
                                <button
                                  onClick={() =>
                                    setModal(
                                      <StockEditor
                                        {...editorProps}
                                        product={p}
                                      />,
                                    )
                                  }
                                >
                                  Stock
                                  <span className="sr-only"> for {p.name}</span>
                                </button>
                              )}
                              {admin && (
                                <button
                                  className="text-danger"
                                  onClick={() =>
                                    ask(
                                      "Archive this product?",
                                      `${p.name} will be removed from the active catalog. Existing order and stock history will be preserved.`,
                                      "Archive product",
                                      () => api.delete("/products/" + p.id),
                                    )
                                  }
                                >
                                  Archive
                                  <span className="sr-only"> {p.name}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={
                    search ? "No matching products" : "Your catalog starts here"
                  }
                >
                  Add a category and supplier, then add your first product.
                </Empty>
              )}
              <div className="table-footer">
                {filtered.length} products · Stock changes only when an order is
                confirmed or a movement is recorded.
              </div>
            </section>
          )}
          {page === "orders" && canSales && (
            <section className="panel">
              <div className="table-toolbar">
                <div>
                  <h2>Your sales orders</h2>
                  <p>
                    Drafts are editable. Confirmed and canceled orders keep
                    their history.
                  </p>
                </div>
                <SearchBox
                  value={search}
                  change={setSearch}
                  placeholder="Find a customer or status"
                />
              </div>
              <OrdersTable
                orders={data.orders.filter((o) =>
                  `${o.customerName} ${o.status} SF-${String(o.id).padStart(4, "0")}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )}
                open={orderDetail}
              />
            </section>
          )}
          {page === "inventory" && canStock && (
            <>
              <div className="notice">
                <ShieldCheck size={21} />
                <span>
                  Every stock change is recorded with a reason, time and
                  employee. Orders update stock automatically; you only need to
                  enter deliveries and corrections here.
                </span>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <div>
                    <h2>Stock movement history</h2>
                    <p>Latest 500 movements · Newest first</p>
                  </div>
                  <SearchBox
                    value={search}
                    change={setSearch}
                    placeholder="Search product or reason"
                  />
                </div>
                {data.movements.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Change</th>
                          <th>Reason</th>
                          <th>Recorded by</th>
                          <th>Date & time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.movements
                          .filter((m) =>
                            `${m.productName} ${m.reason}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map((m) => (
                            <tr key={m.id}>
                              <td>
                                <strong>{m.productName}</strong>
                                {m.salesOrderId && (
                                  <small>
                                    Order SF-
                                    {String(m.salesOrderId).padStart(4, "0")}
                                  </small>
                                )}
                              </td>
                              <td>
                                <span
                                  className={
                                    "delta " +
                                    (m.delta > 0 ? "positive" : "negative")
                                  }
                                >
                                  {m.delta > 0 ? "+" : ""}
                                  {m.delta}
                                </span>
                              </td>
                              <td>{m.reason}</td>
                              <td>{m.actorName}</td>
                              <td>{date(m.createdAt)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="No stock changes yet">
                    Record your first delivery to get started.
                  </Empty>
                )}
              </section>
            </>
          )}
          {(["customers", "suppliers", "categories"] as const)
            .filter((k) => k === page && current)
            .map((kind) => (
              <section className="panel" key={kind}>
                <div className="table-toolbar">
                  <div>
                    <h2>{current!.label}</h2>
                    <p>
                      Keep details current. Archived records remain in past
                      transactions.
                    </p>
                  </div>
                  <SearchBox
                    value={search}
                    change={setSearch}
                    placeholder={`Search ${kind}`}
                  />
                </div>
                {data[kind].length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          {kind !== "categories" && (
                            <>
                              <th>Email</th>
                              <th>Phone</th>
                            </>
                          )}
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data[kind]
                          .filter((c) =>
                            c.name.toLowerCase().includes(search.toLowerCase()),
                          )
                          .map((c) => (
                            <tr key={c.id}>
                              <td>
                                <strong>{c.name}</strong>
                              </td>
                              {kind !== "categories" && (
                                <>
                                  <td>{c.email || "—"}</td>
                                  <td>{c.phone || "—"}</td>
                                </>
                              )}
                              <td>
                                <div className="row-actions">
                                  <button onClick={() => editContact(kind, c)}>
                                    Edit
                                    <span className="sr-only"> {c.name}</span>
                                  </button>
                                  <button
                                    className="text-danger"
                                    onClick={() =>
                                      ask(
                                        "Archive this record?",
                                        `${c.name} will no longer appear as an option for new records. Past transactions will be preserved.`,
                                        "Archive record",
                                        () => api.delete(`/${kind}/${c.id}`),
                                      )
                                    }
                                  >
                                    Archive
                                    <span className="sr-only"> {c.name}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title={`No ${kind} yet`} />
                )}
              </section>
            ))}
          {page === "currency" && canStock && <Currency />}
          {page === "team" && admin && (
            <section className="panel">
              <PanelHeading
                title="Your team"
                subtitle="Roles are enforced by the server. Access changes end existing sessions."
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Access</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>
                            {u.displayName}
                            {u.id === user.id ? " (you)" : ""}
                          </strong>
                          <small>{u.email}</small>
                        </td>
                        <td>{u.role}</td>
                        <td>
                          <Badge value={u.active ? "Active" : "Disabled"} />
                        </td>
                        <td>
                          {u.id !== user.id && (
                            <button
                              onClick={() =>
                                setModal(
                                  <EmployeeEditor
                                    {...editorProps}
                                    employee={u}
                                  />,
                                )
                              }
                            >
                              Manage access
                              <span className="sr-only">
                                {" "}
                                for {u.displayName}
                              </span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {!current && (
            <Empty title="This page is not available for your role">
              <a href="#dashboard">Return to your overview</a>
            </Empty>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} /> StockFlow · Less guesswork. More growth.
            </span>
            <span>All prices in Philippine pesos unless stated otherwise.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  warning?: boolean;
}) {
  return (
    <section className={"stat " + (warning ? "warning-stat" : "")}>
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
function PanelHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
function Quick({
  icon,
  title,
  description,
  click,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  click: () => void;
}) {
  return (
    <button className="quick-action" onClick={click}>
      <span className="quick-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}
function SearchBox({
  value,
  change,
  placeholder,
}: {
  value: string;
  change: (s: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  );
}
function OrdersTable({
  orders,
  open,
}: {
  orders: Order[];
  open: (o: Order) => void;
}) {
  return orders.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Status</th>
            <th>Total</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>SF-{String(o.id).padStart(4, "0")}</strong>
                <small>
                  {o.items.length}{" "}
                  {o.items.length === 1 ? "product" : "products"}
                </small>
              </td>
              <td>{o.customerName}</td>
              <td>{date(o.createdAt)}</td>
              <td>
                <Badge value={o.status} />
              </td>
              <td className="numeric">{money(o.total)}</td>
              <td>
                <button onClick={() => open(o)}>
                  Review<span className="sr-only"> order {o.id}</span>
                  <ChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="No orders to show">
      Create a draft order to start your next sale.
    </Empty>
  );
}
function Login({
  onLogin,
  dark,
  toggle,
}: {
  onLogin: (u: Employee) => void;
  dark: boolean;
  toggle: () => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="brand" href="#">
          <span className="brand-mark">
            <Leaf />
          </span>
          StockFlow.
        </a>
        <div>
          <p className="eyebrow">SMALL BUSINESS. BIG POSSIBILITIES.</p>
          <h1>
            A little order.
            <br />A lot of clarity.
          </h1>
          <p>
            Know your stock. Keep sales moving.
            <br />
            Make room for what comes next.
          </p>
          <div className="login-feature">
            <Check /> Connected inventory & orders
          </div>
          <div className="login-feature">
            <Check /> Clear roles for your whole team
          </div>
          <div className="login-feature">
            <Check /> Simple tools for everyday business
          </div>
        </div>
        <small>Built for the people behind the business.</small>
      </section>
      <section className="login-form-side">
        <button
          className="icon-button login-theme"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggle}
        >
          {dark ? <Sun /> : <Moon />}
        </button>
        <form
          className="login-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await api.post("/auth/login", { email, password });
              onLogin(r.data);
            } catch (e) {
              setError(
                explain(e) === "Your session has ended. Please sign in again."
                  ? "Email or password is incorrect, or your account is temporarily locked. Please try again later."
                  : explain(e),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="login-leaf">
            <Leaf size={28} />
          </span>
          <h2>Welcome back.</h2>
          <p>Sign in to your StockFlow workspace.</p>
          <Field label="Email address">
            <input
              type="email"
              required
              autoComplete="username"
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorBox message={error} />
          <Submit busy={busy}>
            Sign in to workspace <ArrowUpRight size={17} />
          </Submit>
          <p className="login-help">
            <ShieldCheck size={16} /> Your workspace is for authorized
            employees.
            <br />
            Need an account? Ask your administrator.
          </p>
        </form>
      </section>
    </div>
  );
}
function Currency() {
  const [currency, setCurrency] = useState("USD"),
    [amount, setAmount] = useState("100"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  type Quote = {
    converted: number;
    rate: number;
    rateDate: string;
    isFallback: boolean;
    message: string;
    baseCurrency: string;
    amount: number;
  };
  const [quote, setQuote] = useState<Quote | null>(null);
  return (
    <div className="currency-grid">
      <section className="panel currency-form">
        <span className="quick-icon">
          <Globe />
        </span>
        <h2>What will it cost in pesos?</h2>
        <p>Turn a foreign supplier quote into a useful purchase estimate.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setQuote(null);
            try {
              setQuote(
                (
                  await api.get("/currency", {
                    params: { currency, amount: Number(amount) },
                  })
                ).data,
              );
            } catch (e) {
              setError(explain(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Supplier’s currency">
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setQuote(null);
              }}
            >
              {["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Quoted amount">
            <input
              type="number"
              required
              min={0}
              max={99999999}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
            />
          </Field>
          <Submit busy={busy}>
            Estimate in PHP <ArrowUpRight size={17} />
          </Submit>
          <ErrorBox message={error} />
        </form>
      </section>
      <section className="panel currency-result">
        {quote ? (
          <>
            <p className="eyebrow">ESTIMATED COST IN PHILIPPINE PESOS</p>
            <h2>{money(quote.converted)}</h2>
            <p>
              {quote.amount.toLocaleString()} {quote.baseCurrency} at{" "}
              {quote.rate} PHP per unit
            </p>
            <Badge value={quote.isFallback ? "Saved rate" : "Reference rate"} />
            <p>Rate date: {quote.rateDate}</p>
            <div className={"notice " + (quote.isFallback ? "warning" : "")}>
              <Globe size={20} />
              <span>{quote.message}</span>
            </div>
          </>
        ) : (
          <>
            <span className="currency-symbol">₱</span>
            <h2>A clearer picture of your costs.</h2>
            <p>Enter your supplier’s quote to see an estimate here.</p>
          </>
        )}
        <small>
          Source: Frankfurter · Indicative reference rates only. Bank charges,
          shipping and taxes are excluded. Currency estimates never change
          product prices or order totals.
        </small>
      </section>
    </div>
  );
}
