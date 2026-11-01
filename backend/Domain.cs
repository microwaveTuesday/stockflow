using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace StockFlow;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public class MoneyAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is decimal n && decimal.Round(n, 2) == n;
    public override string FormatErrorMessage(string name) => $"{name} must have at most two decimal places.";
}
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public class TrimmedLengthAttribute(int minimum) : ValidationAttribute
{
    public override bool IsValid(object? value) => value is string s && s.Trim().Length >= minimum;
    public override string FormatErrorMessage(string name) => $"{name} needs at least {minimum} characters, excluding surrounding spaces.";
}
public class Employee : IdentityUser { public string DisplayName { get; set; } = ""; public bool Active { get; set; } = true; }
public class Category { public int Id { get; set; } public string Name { get; set; } = ""; public bool Active { get; set; } = true; }
public class Supplier { public int Id { get; set; } public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Phone { get; set; } = ""; public bool Active { get; set; } = true; }
public class Customer { public int Id { get; set; } public string Name { get; set; } = ""; public string Email { get; set; } = ""; public string Phone { get; set; } = ""; public bool Active { get; set; } = true; }
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = ""; public string Sku { get; set; } = "";
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public int SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public int ReorderLevel { get; set; }
    public bool Active { get; set; } = true;
}
public class SalesOrder
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public string CreatedById { get; set; } = ""; public Employee CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow; public string Status { get; set; } = "Draft";
    public List<OrderItem> Items { get; set; } = []; public decimal Total => Items.Sum(i => i.UnitPrice * i.Quantity);
}
public class OrderItem
{
    public int Id { get; set; }
    public int SalesOrderId { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string ProductName { get; set; } = ""; public string Sku { get; set; } = ""; public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
}
public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int Delta { get; set; }
    public string Reason { get; set; } = ""; public string ActorId { get; set; } = ""; public Employee Actor { get; set; } = null!;
    public int? SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
public record LoginRequest([Required, EmailAddress] string Email, [Required] string Password);
public record PasswordRequest([Required] string CurrentPassword, [Required, MinLength(12)] string NewPassword);
public record PersonRequest([Required, TrimmedLength(2), StringLength(120, MinimumLength = 2)] string Name, [EmailAddress, StringLength(180)] string? Email, [StringLength(40)] string? Phone);
public record CategoryRequest([Required, TrimmedLength(2), StringLength(80, MinimumLength = 2)] string Name);
public record ProductRequest([Required, TrimmedLength(2), StringLength(120, MinimumLength = 2)] string Name, [Required, RegularExpression(@"^[A-Za-z0-9_-]{2,40}$")] string Sku, [Range(1, int.MaxValue)] int CategoryId, [Range(1, int.MaxValue)] int SupplierId, [Money, Range(0, 99999999)] decimal Price, [Range(0, 1000000)] int ReorderLevel);
public record StockRequest([Range(-1000000, 1000000)] int Delta, [Required, TrimmedLength(5), StringLength(300, MinimumLength = 5)] string Reason);
public record ItemRequest([Range(1, int.MaxValue)] int ProductId, [Range(1, 1000000)] int Quantity);
public record OrderRequest([Range(1, int.MaxValue)] int CustomerId, [Required, MinLength(1), MaxLength(100)] List<ItemRequest> Items);
public record EmployeeRequest([Required, EmailAddress] string Email, [Required, StringLength(100, MinimumLength = 2)] string DisplayName, [Required, MinLength(12)] string Password, [Required, RegularExpression("^(Admin|Sales|Inventory)$")] string Role);
public record RoleRequest([Required, RegularExpression("^(Admin|Sales|Inventory)$")] string Role, bool Active);
public class RuleException(int status, string message) : Exception(message) { public int Status { get; } = status; }
