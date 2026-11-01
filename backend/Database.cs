using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
namespace StockFlow;

public class StockDb(DbContextOptions<StockDb> options) : IdentityDbContext<Employee>(options)
{
    public DbSet<Product> Products => Set<Product>(); public DbSet<Category> Categories => Set<Category>(); public DbSet<Supplier> Suppliers => Set<Supplier>(); public DbSet<Customer> Customers => Set<Customer>(); public DbSet<SalesOrder> Orders => Set<SalesOrder>(); public DbSet<StockMovement> Movements => Set<StockMovement>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        b.Entity<Product>().HasIndex(x => x.Sku).IsUnique(); b.Entity<Category>().HasIndex(x => x.Name).IsUnique();
        b.Entity<Product>().Property(x => x.Price).HasPrecision(14, 2); b.Entity<OrderItem>().Property(x => x.UnitPrice).HasPrecision(14, 2);
        b.Entity<Product>().ToTable(t => { t.HasCheckConstraint("stock_nonnegative", "\"Stock\" >= 0"); t.HasCheckConstraint("price_nonnegative", "\"Price\" >= 0"); });
        b.Entity<OrderItem>().ToTable(t => t.HasCheckConstraint("positive_quantity", "\"Quantity\" > 0"));
        b.Entity<SalesOrder>().ToTable(t => t.HasCheckConstraint("valid_status", "\"Status\" IN ('Draft','Confirmed','Canceled')"));
        b.Entity<SalesOrder>().Ignore(x => x.Total);
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(x => x.GetForeignKeys())) fk.DeleteBehavior = DeleteBehavior.Restrict;
        b.Entity<SalesOrder>().HasMany(x => x.Items).WithOne().HasForeignKey(x => x.SalesOrderId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<StockMovement>().HasIndex(x => new { x.ProductId, x.CreatedAt });
    }
}
