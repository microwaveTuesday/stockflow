using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace StockFlow;

public static class Seeder
{
    public static async Task Run(IServiceProvider services, IConfiguration config)
    {
        var db = services.GetRequiredService<StockDb>(); await db.Database.MigrateAsync();
        var users = services.GetRequiredService<UserManager<Employee>>(); var roles = services.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Admin", "Sales", "Inventory" }) if (!await roles.RoleExistsAsync(role)) await roles.CreateAsync(new IdentityRole(role));
        var password = config["Seed:Password"];
        if (!await users.Users.AnyAsync())
        {
            if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Set Seed__Password to a strong initial password (12+ characters, uppercase, lowercase, number, symbol).");
            foreach (var role in new[] { "Admin", "Sales", "Inventory" })
            {
                var user = new Employee { UserName = $"{role.ToLower()}@stockflow.local", Email = $"{role.ToLower()}@stockflow.local", DisplayName = $"{role} employee" };
                var result = await users.CreateAsync(user, password); if (!result.Succeeded) throw new InvalidOperationException(string.Join(" ", result.Errors.Select(x => x.Description))); await users.AddToRoleAsync(user, role);
            }
        }
        if (!config.GetValue<bool>("Seed:Demo") || await db.Products.AnyAsync()) return;
        var c = new Category { Name = "Everyday essentials" }; var s = new Supplier { Name = "Evergreen Supply Co.", Email = "orders@example.com", Phone = "0917 555 0101" };
        db.Categories.AddRange(c, new Category { Name = "Office & packaging" }); db.Suppliers.Add(s); db.Customers.Add(new Customer { Name = "Riverstone Corner Store", Email = "hello@example.com", Phone = "0917 555 0120" });
        var products = new[] { new Product { Name = "Bamboo notebook", Sku = "BN-001", Price = 149, Stock = 48, ReorderLevel = 10, Category = c, Supplier = s }, new Product { Name = "Reusable canvas tote", Sku = "CT-002", Price = 249, Stock = 8, ReorderLevel = 15, Category = c, Supplier = s }, new Product { Name = "Insulated water bottle", Sku = "WB-003", Price = 599, Stock = 26, ReorderLevel = 8, Category = c, Supplier = s }, new Product { Name = "Kraft gift bag", Sku = "KB-004", Price = 35, Stock = 120, ReorderLevel = 30, Category = c, Supplier = s } };
        db.Products.AddRange(products); await db.SaveChangesAsync(); var admin = (await users.FindByEmailAsync("admin@stockflow.local"))!;
        foreach (var p in products) db.Movements.Add(new StockMovement { ProductId = p.Id, Delta = p.Stock, Reason = "Opening stock — demonstration data", ActorId = admin.Id }); await db.SaveChangesAsync();
    }
}
