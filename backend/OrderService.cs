using Microsoft.EntityFrameworkCore;
namespace StockFlow;

public class OrderService(StockDb db)
{
    public IQueryable<SalesOrder> Query => db.Orders.AsNoTracking().Include(x => x.Customer).Include(x => x.Items);
    public static object View(SalesOrder o) => new { o.Id, o.CustomerId, CustomerName = o.Customer.Name, o.CreatedAt, o.CreatedById, o.Status, o.Total, Items = o.Items.Select(i => new { i.ProductId, i.ProductName, i.Sku, i.Quantity, i.UnitPrice, Total = i.Quantity * i.UnitPrice }) };
    async Task<SalesOrder> Locked(int id)
    {
        var o = await db.Orders.FromSqlInterpolated($"SELECT * FROM \"Orders\" WHERE \"Id\"={id} FOR UPDATE").SingleOrDefaultAsync() ?? throw new RuleException(404, "This order could not be found.");
        await db.Entry(o).Collection(x => x.Items).LoadAsync(); await db.Entry(o).Reference(x => x.Customer).LoadAsync(); return o;
    }
    async Task<List<OrderItem>> Items(OrderRequest r)
    {
        if (r.Items is null || r.Items.Count is < 1 or > 100 || r.Items.Any(x => x.Quantity is < 1 or > 1000000) || r.Items.Select(x => x.ProductId).Distinct().Count() != r.Items.Count) throw new RuleException(400, "Add 1–100 different products with positive quantities.");
        if (!await db.Customers.AnyAsync(x => x.Id == r.CustomerId && x.Active)) throw new RuleException(400, "Choose an active customer.");
        var ids = r.Items.Select(x => x.ProductId).ToArray(); var products = await db.Products.Where(x => ids.Contains(x.Id) && x.Active).ToDictionaryAsync(x => x.Id);
        if (products.Count != ids.Length) throw new RuleException(400, "One or more products are no longer available. Refresh the product list.");
        return r.Items.Select(i => new OrderItem { ProductId = i.ProductId, ProductName = products[i.ProductId].Name, Sku = products[i.ProductId].Sku, Quantity = i.Quantity, UnitPrice = products[i.ProductId].Price }).ToList();
    }
    public async Task<int> Save(int? id, OrderRequest r, string actor)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var o = id.HasValue ? await Locked(id.Value) : new SalesOrder { CreatedById = actor };
        if (o.Status != "Draft") throw new RuleException(409, "Only a draft order can be changed.");
        var items = await Items(r); db.RemoveRange(o.Items); o.Items = items; o.CustomerId = r.CustomerId;
        if (!id.HasValue) db.Orders.Add(o); await db.SaveChangesAsync(); await tx.CommitAsync(); return o.Id;
    }
    public async Task Transition(int id, bool confirm, string actor)
    {
        await using var tx = await db.Database.BeginTransactionAsync(); var o = await Locked(id);
        if (confirm && o.Status == "Confirmed" || !confirm && o.Status == "Canceled") { await tx.CommitAsync(); return; }
        if (confirm && o.Status != "Draft") throw new RuleException(409, "A canceled order cannot be confirmed. Create a new order instead.");
        if (confirm || o.Status == "Confirmed")
        {
            foreach (var item in o.Items.OrderBy(x => x.ProductId))
            {
                int delta = confirm ? -item.Quantity : item.Quantity;
                var q = db.Products.Where(x => x.Id == item.ProductId);
                if (confirm) q = q.Where(x => x.Active && x.Stock >= item.Quantity);
                else q = q.Where(x => x.Stock <= int.MaxValue - item.Quantity);
                if (await q.ExecuteUpdateAsync(s => s.SetProperty(x => x.Stock, x => x.Stock + delta)) != 1) throw new RuleException(409, $"There is not enough available stock for {item.ProductName}. Review the stock levels and try again.");
                db.Movements.Add(new StockMovement { ProductId = item.ProductId, Delta = delta, Reason = confirm ? "Order confirmed" : "Order canceled — stock returned", ActorId = actor, SalesOrderId = id });
            }
        }
        o.Status = confirm ? "Confirmed" : "Canceled"; await db.SaveChangesAsync(); await tx.CommitAsync();
    }
    public async Task Delete(int id)
    {
        await using var tx = await db.Database.BeginTransactionAsync(); var o = await Locked(id);
        if (o.Status != "Draft") throw new RuleException(409, "Only draft orders can be deleted. Cancel this order to preserve its history.");
        db.Orders.Remove(o); await db.SaveChangesAsync(); await tx.CommitAsync();
    }
    public async Task Adjust(int id, StockRequest r, string actor)
    {
        if (r.Delta == 0) throw new RuleException(400, "Enter a quantity other than zero.");
        await using var tx = await db.Database.BeginTransactionAsync();
        var q = db.Products.Where(x => x.Id == id && x.Active && (long)x.Stock + r.Delta >= 0 && (long)x.Stock + r.Delta <= int.MaxValue);
        if (await q.ExecuteUpdateAsync(s => s.SetProperty(x => x.Stock, x => x.Stock + r.Delta)) != 1) throw new RuleException(409, "Stock cannot fall below zero. Check the product and quantity.");
        db.Movements.Add(new StockMovement { ProductId = id, Delta = r.Delta, Reason = r.Reason.Trim(), ActorId = actor }); await db.SaveChangesAsync(); await tx.CommitAsync();
    }
}
