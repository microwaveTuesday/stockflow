using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
namespace StockFlow;

[ApiController, Route("api/auth")]
public class AuthController(UserManager<Employee> users, SignInManager<Employee> signIn) : ControllerBase
{
    [HttpPost("login"), EnableRateLimiting("login")]
    public async Task<IActionResult> Login(LoginRequest r)
    {
        var u = await users.FindByEmailAsync(r.Email);
        if (u is null || !u.Active) throw new RuleException(401, "Email or password is incorrect.");
        var result = await signIn.PasswordSignInAsync(u, r.Password, false, true);
        if (!result.Succeeded) throw new RuleException(401, "Email or password is incorrect, or this account is temporarily locked. Try again in 10 minutes.");
        return Ok(new { u.Id, u.Email, u.DisplayName, Role = (await users.GetRolesAsync(u)).Single() });
    }
    [Authorize, HttpGet("me")] public async Task<IActionResult> Me() { var u = (await users.GetUserAsync(User))!; return Ok(new { u.Id, u.Email, u.DisplayName, Role = (await users.GetRolesAsync(u)).Single() }); }
    [Authorize, HttpPost("logout")] public async Task<IActionResult> Logout() { await signIn.SignOutAsync(); return NoContent(); }
    [Authorize, HttpPost("password")]
    public async Task<IActionResult> Password(PasswordRequest r)
    {
        var u = (await users.GetUserAsync(User))!; var result = await users.ChangePasswordAsync(u, r.CurrentPassword, r.NewPassword);
        if (!result.Succeeded) throw new RuleException(400, string.Join(" ", result.Errors.Select(x => x.Description)));
        await signIn.SignOutAsync(); return NoContent();
    }
}
[ApiController, Authorize, Route("api/products")]
public class ProductsController(StockDb db) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List(string? search = null, bool includeInactive = false) => Ok(await db.Products.AsNoTracking().Where(x => (includeInactive || x.Active) && (search == null || x.Name.ToLower().Contains(search.ToLower()) || x.Sku.ToLower().Contains(search.ToLower()))).OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Sku, x.Price, x.Stock, x.ReorderLevel, x.Active, x.CategoryId, CategoryName = x.Category.Name, x.SupplierId, SupplierName = x.Supplier.Name }).ToListAsync());
    [HttpGet("{id:int}")] public async Task<IActionResult> Get(int id) => Ok(await db.Products.AsNoTracking().Where(x => x.Id == id).Select(x => new { x.Id, x.Name, x.Sku, x.Price, x.Stock, x.ReorderLevel, x.Active, x.CategoryId, x.SupplierId }).SingleOrDefaultAsync() ?? throw new RuleException(404, "Product not found."));
    async Task<Product> Assign(Product p, ProductRequest r)
    {
        if (!await db.Categories.AnyAsync(x => x.Id == r.CategoryId && x.Active) || !await db.Suppliers.AnyAsync(x => x.Id == r.SupplierId && x.Active)) throw new RuleException(400, "Choose an active category and supplier.");
        p.Name = r.Name.Trim(); p.Sku = r.Sku.Trim().ToUpperInvariant(); p.Price = r.Price; p.CategoryId = r.CategoryId; p.SupplierId = r.SupplierId; p.ReorderLevel = r.ReorderLevel; return p;
    }
    [HttpPost, Authorize(Roles = "Admin")] public async Task<IActionResult> Create(ProductRequest r) { var p = await Assign(new Product(), r); db.Products.Add(p); await db.SaveChangesAsync(); return Created($"/api/products/{p.Id}", new { p.Id }); }
    [HttpPut("{id:int}"), Authorize(Roles = "Admin")] public async Task<IActionResult> Update(int id, ProductRequest r) { var p = await db.Products.FindAsync(id) ?? throw new RuleException(404, "Product not found."); await Assign(p, r); await db.SaveChangesAsync(); return NoContent(); }
    [HttpDelete("{id:int}"), Authorize(Roles = "Admin")] public async Task<IActionResult> Delete(int id) { var p = await db.Products.FindAsync(id) ?? throw new RuleException(404, "Product not found."); p.Active = false; await db.SaveChangesAsync(); return NoContent(); }
}
[ApiController, Authorize, Route("api")]
public class DirectoryController(StockDb db) : ControllerBase
{
    [HttpGet("categories")] public async Task<IActionResult> Categories() => Ok(await db.Categories.AsNoTracking().Where(x => x.Active).OrderBy(x => x.Name).ToListAsync());
    [HttpPost("categories"), Authorize(Roles = "Admin")] public async Task<IActionResult> CategoryCreate(CategoryRequest r) { var c = new Category { Name = r.Name.Trim() }; db.Categories.Add(c); await db.SaveChangesAsync(); return Created($"/api/categories/{c.Id}", c); }
    [HttpPut("categories/{id:int}"), Authorize(Roles = "Admin")] public async Task<IActionResult> CategoryEdit(int id, CategoryRequest r) { var c = await db.Categories.FindAsync(id) ?? throw new RuleException(404, "Category not found."); c.Name = r.Name.Trim(); await db.SaveChangesAsync(); return NoContent(); }
    [HttpDelete("categories/{id:int}"), Authorize(Roles = "Admin")] public async Task<IActionResult> CategoryDelete(int id) { var c = await db.Categories.FindAsync(id) ?? throw new RuleException(404, "Category not found."); if (await db.Products.AnyAsync(x => x.CategoryId == id && x.Active)) throw new RuleException(409, "Move active products to another category first."); c.Active = false; await db.SaveChangesAsync(); return NoContent(); }
    [HttpGet("suppliers"), Authorize(Roles = "Admin,Inventory")] public async Task<IActionResult> Suppliers() => Ok(await db.Suppliers.AsNoTracking().Where(x => x.Active).OrderBy(x => x.Name).ToListAsync());
    [HttpPost("suppliers"), Authorize(Roles = "Admin,Inventory")] public async Task<IActionResult> SupplierCreate(PersonRequest r) { var p = new Supplier { Name = r.Name.Trim(), Email = r.Email ?? "", Phone = r.Phone ?? "" }; db.Suppliers.Add(p); await db.SaveChangesAsync(); return Created($"/api/suppliers/{p.Id}", p); }
    [HttpPut("suppliers/{id:int}"), Authorize(Roles = "Admin,Inventory")] public async Task<IActionResult> SupplierEdit(int id, PersonRequest r) { var p = await db.Suppliers.FindAsync(id) ?? throw new RuleException(404, "Supplier not found."); p.Name = r.Name.Trim(); p.Email = r.Email ?? ""; p.Phone = r.Phone ?? ""; await db.SaveChangesAsync(); return NoContent(); }
    [HttpDelete("suppliers/{id:int}"), Authorize(Roles = "Admin,Inventory")] public async Task<IActionResult> SupplierDelete(int id) { var p = await db.Suppliers.FindAsync(id) ?? throw new RuleException(404, "Supplier not found."); if (await db.Products.AnyAsync(x => x.SupplierId == id && x.Active)) throw new RuleException(409, "Assign active products to another supplier first."); p.Active = false; await db.SaveChangesAsync(); return NoContent(); }
    [HttpGet("customers"), Authorize(Roles = "Admin,Sales")] public async Task<IActionResult> Customers() => Ok(await db.Customers.AsNoTracking().Where(x => x.Active).OrderBy(x => x.Name).ToListAsync());
    [HttpPost("customers"), Authorize(Roles = "Admin,Sales")] public async Task<IActionResult> CustomerCreate(PersonRequest r) { var p = new Customer { Name = r.Name.Trim(), Email = r.Email ?? "", Phone = r.Phone ?? "" }; db.Customers.Add(p); await db.SaveChangesAsync(); return Created($"/api/customers/{p.Id}", p); }
    [HttpPut("customers/{id:int}"), Authorize(Roles = "Admin,Sales")] public async Task<IActionResult> CustomerEdit(int id, PersonRequest r) { var p = await db.Customers.FindAsync(id) ?? throw new RuleException(404, "Customer not found."); p.Name = r.Name.Trim(); p.Email = r.Email ?? ""; p.Phone = r.Phone ?? ""; await db.SaveChangesAsync(); return NoContent(); }
    [HttpDelete("customers/{id:int}"), Authorize(Roles = "Admin,Sales")] public async Task<IActionResult> CustomerDelete(int id) { var p = await db.Customers.FindAsync(id) ?? throw new RuleException(404, "Customer not found."); p.Active = false; await db.SaveChangesAsync(); return NoContent(); }
}
[ApiController, Authorize(Roles = "Admin,Sales"), Route("api/orders")]
public class OrdersController(OrderService service) : ControllerBase
{
    string Actor => User.FindFirstValue(ClaimTypes.NameIdentifier)!;
    [HttpGet] public async Task<IActionResult> List() => Ok((await service.Query.OrderByDescending(x => x.Id).ToListAsync()).Select(OrderService.View));
    [HttpGet("{id:int}")] public async Task<IActionResult> Get(int id) => Ok(OrderService.View(await service.Query.SingleOrDefaultAsync(x => x.Id == id) ?? throw new RuleException(404, "Order not found.")));
    [HttpPost] public async Task<IActionResult> Create(OrderRequest r) { var id = await service.Save(null, r, Actor); return Created($"/api/orders/{id}", new { Id = id }); }
    [HttpPut("{id:int}")] public async Task<IActionResult> Edit(int id, OrderRequest r) { await service.Save(id, r, Actor); return NoContent(); }
    [HttpDelete("{id:int}")] public async Task<IActionResult> Delete(int id) { await service.Delete(id); return NoContent(); }
    [HttpPost("{id:int}/confirm")] public async Task<IActionResult> Confirm(int id) { await service.Transition(id, true, Actor); return NoContent(); }
    [HttpPost("{id:int}/cancel")] public async Task<IActionResult> Cancel(int id) { await service.Transition(id, false, Actor); return NoContent(); }
}
[ApiController, Authorize(Roles = "Admin,Inventory"), Route("api/inventory")]
public class InventoryController(StockDb db, OrderService service) : ControllerBase
{
    [HttpGet("movements")] public async Task<IActionResult> List(int? productId = null) => Ok(await db.Movements.AsNoTracking().Where(x => productId == null || x.ProductId == productId).OrderByDescending(x => x.Id).Take(500).Select(x => new { x.Id, x.ProductId, ProductName = x.Product.Name, x.Delta, x.Reason, x.SalesOrderId, x.CreatedAt, ActorName = x.Actor.DisplayName }).ToListAsync());
    [HttpPost("{id:int}/adjust")] public async Task<IActionResult> Adjust(int id, StockRequest r) { await service.Adjust(id, r, User.FindFirstValue(ClaimTypes.NameIdentifier)!); return NoContent(); }
}
[ApiController, Authorize(Roles = "Admin,Inventory"), Route("api/currency")]
public class CurrencyController(CurrencyService service) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Quote(string currency = "USD", decimal amount = 1) => Ok(await service.Quote(currency, amount));
}
[ApiController, Authorize(Roles = "Admin"), Route("api/users")]
public class UsersController(UserManager<Employee> users, StockDb db) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> List() { var result = new List<object>(); foreach (var u in await users.Users.OrderBy(x => x.Email).ToListAsync()) result.Add(new { u.Id, u.Email, u.DisplayName, u.Active, Role = (await users.GetRolesAsync(u)).Single() }); return Ok(result); }
    [HttpPost] public async Task<IActionResult> Create(EmployeeRequest r) { var u = new Employee { Email = r.Email, UserName = r.Email, DisplayName = r.DisplayName.Trim() }; var result = await users.CreateAsync(u, r.Password); if (!result.Succeeded) throw new RuleException(400, string.Join(" ", result.Errors.Select(x => x.Description))); await users.AddToRoleAsync(u, r.Role); return Created($"/api/users/{u.Id}", new { u.Id }); }
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, RoleRequest r)
    {
        if (id == User.FindFirstValue(ClaimTypes.NameIdentifier)) throw new RuleException(409, "Ask another administrator to change your access. This protects your ability to sign in.");
        await using var tx = await db.Database.BeginTransactionAsync();
        // Serialize administrative access changes, including the last-administrator check.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(783041)");
        var actor = await users.GetUserAsync(User);
        if (actor is null || !actor.Active || !await users.IsInRoleAsync(actor, "Admin")) throw new RuleException(403, "Your administrator access has changed. Sign in again.");
        var u = await users.FindByIdAsync(id) ?? throw new RuleException(404, "Employee not found.");
        if (await users.IsInRoleAsync(u, "Admin") && (!r.Active || r.Role != "Admin") && (await users.GetUsersInRoleAsync("Admin")).Count(x => x.Active) <= 1) throw new RuleException(409, "Keep at least one active administrator.");
        static void Check(IdentityResult result) { if (!result.Succeeded) throw new RuleException(409, "This employee changed while you were editing. Refresh and try again."); }
        Check(await users.RemoveFromRolesAsync(u, await users.GetRolesAsync(u))); Check(await users.AddToRoleAsync(u, r.Role)); u.Active = r.Active; Check(await users.UpdateSecurityStampAsync(u)); Check(await users.UpdateAsync(u)); await tx.CommitAsync(); return NoContent();
    }
}
